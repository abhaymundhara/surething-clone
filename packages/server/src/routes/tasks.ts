import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { tasks, drafts } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { broadcast } from '../lib/websocket.js';
import { scheduleTask, cancelScheduledTask } from '../agent/scheduler.js';

const taskRoutes = new Hono();

const createTaskSchema = z.object({
  cellId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  executor: z.enum(['ai', 'human']),
  action: z.string().optional(),
  actionContext: z.record(z.unknown()).optional(),
  triggerType: z.enum(['delay', 'cron', 'event']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  whyHuman: z.string().optional(),
});

// List tasks
taskRoutes.get('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const cellId = c.req.query('cellId');
  const status = c.req.query('status');

  const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));

  let filtered = allTasks;
  if (cellId) filtered = filtered.filter(t => t.cellId === cellId);
  if (status) filtered = filtered.filter(t => t.status === status);

  return c.json({ success: true, data: filtered });
});

// Create task
taskRoutes.post('/', async (c) => {
  const userId = c.get('userId' as never) as string;
  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message }, 400);
  }

  const [task] = await db.insert(tasks).values(parsed.data).returning();

  // Schedule if has trigger
  if (task.triggerType) {
    await scheduleTask(task.id);
  }

  broadcast(userId, { type: 'task_update', payload: task });
  return c.json({ success: true, data: task }, 201);
});

// Batch create tasks
taskRoutes.post('/batch', async (c) => {
  const body = await c.req.json();
  const userId = c.get('userId' as never) as string;

  if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
    return c.json({ success: false, error: 'tasks array required' }, 400);
  }

  const created = await db.insert(tasks).values(body.tasks).returning();

  for (const task of created) {
    if (task.triggerType) await scheduleTask(task.id);
    broadcast(userId, { type: 'task_update', payload: task });
  }

  return c.json({ success: true, data: created }, 201);
});

// Update task
taskRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId' as never) as string;
  const taskId = c.req.param('id');
  const updates = await c.req.json();

  if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'skipped') {
    updates.completedAt = new Date();
    // Cancel any scheduled jobs
    await cancelScheduledTask(taskId);
    // If skipping, also cancel associated draft
    if (updates.status === 'skipped' && updates.actionContext?.draftId) {
      await db.update(drafts).set({ status: 'cancelled' }).where(eq(drafts.id, updates.actionContext.draftId));
    }
  }

  if (updates.status === 'paused') {
    await cancelScheduledTask(taskId);
  }

  const [updated] = await db.update(tasks)
    .set(updates)
    .where(eq(tasks.id, taskId))
    .returning();

  if (!updated) return c.json({ success: false, error: 'Task not found' }, 404);
  broadcast(userId, { type: 'task_update', payload: updated });
  return c.json({ success: true, data: updated });
});

// Delete task
taskRoutes.delete('/:id', async (c) => {
  const taskId = c.req.param('id');
  await cancelScheduledTask(taskId);
  const [deleted] = await db.delete(tasks).where(eq(tasks.id, taskId)).returning();
  if (!deleted) return c.json({ success: false, error: 'Task not found' }, 404);
  return c.json({ success: true, data: { deleted: true } });
});

// Approve HITL task
taskRoutes.post('/:id/approve', async (c) => {
  const userId = c.get('userId' as never) as string;
  const taskId = c.req.param('id');

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return c.json({ success: false, error: 'Task not found' }, 404);
  if (task.status !== 'awaiting_user_action') {
    return c.json({ success: false, error: 'Task is not awaiting approval' }, 400);
  }

  // Get the associated draft
  const draftId = (task.actionContext as any)?.draftId;
  if (draftId) {
    await db.update(drafts).set({ status: 'confirmed' }).where(eq(drafts.id, draftId));
  }

  await db.update(tasks).set({ status: 'completed', completedAt: new Date() }).where(eq(tasks.id, taskId));
  broadcast(userId, { type: 'task_approved', payload: { taskId, draftId } });
  return c.json({ success: true, data: { approved: true } });
});

// Reject/cancel HITL task
taskRoutes.post('/:id/reject', async (c) => {
  const userId = c.get('userId' as never) as string;
  const taskId = c.req.param('id');

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return c.json({ success: false, error: 'Task not found' }, 404);

  const draftId = (task.actionContext as any)?.draftId;
  if (draftId) {
    await db.update(drafts).set({ status: 'cancelled' }).where(eq(drafts.id, draftId));
  }

  await db.update(tasks).set({ status: 'skipped', completedAt: new Date() }).where(eq(tasks.id, taskId));
  broadcast(userId, { type: 'task_rejected', payload: { taskId } });
  return c.json({ success: true, data: { rejected: true } });
});

// Run task immediately
taskRoutes.post('/:id/run', async (c) => {
  const taskId = c.req.param('id');
  const { taskQueue } = await import('../lib/queue.js');
  await taskQueue.add('execute-task', { taskId }, { jobId: `manual-${taskId}-${Date.now()}` });
  return c.json({ success: true, data: { queued: true } });
});

export default taskRoutes;
