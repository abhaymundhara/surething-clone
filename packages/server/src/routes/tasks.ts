import { Hono } from 'hono';
import { db } from '../db/index.js';
import { tasks, drafts } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { scheduleTask, cancelScheduledTask } from '../agent/scheduler.js';
import { broadcast } from '../lib/websocket.js';

// ═══════════════════════════════════════════════════════
// TASKS — CRUD + scheduling + HITL approval
// ═══════════════════════════════════════════════════════

const app = new Hono();

const createTaskSchema = z.object({
  title: z.string().min(1),
  cellId: z.string().uuid(),
  executor: z.enum(['ai', 'human']).default('ai'),
  action: z.string().optional(),
  triggerType: z.enum(['delay', 'cron', 'event']).optional(),
  triggerConfig: z.record(z.any()).optional(),
  whyHuman: z.string().optional(),
  actionContext: z.record(z.any()).optional(),
});

// List tasks (optionally by cell)
app.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const cellId = c.req.query('cellId');

  const conditions = [eq(tasks.userId, userId)];
  if (cellId) conditions.push(eq(tasks.cellId, cellId));

  const result = await db.select().from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .limit(50);

  return c.json(result);
});

// Create single task
app.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid task data', details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const [task] = await db.insert(tasks).values({
    userId,
    cellId: data.cellId,
    title: data.title,
    executor: data.executor,
    action: data.action,
    triggerType: data.triggerType || null,
    triggerConfig: data.triggerConfig || null,
    whyHuman: data.whyHuman,
    actionContext: data.actionContext || null,
    status: data.executor === 'human' ? 'awaiting_user_action' : 'pending',
  }).returning();

  // Schedule if it has a trigger
  if (task.triggerType && task.triggerType !== 'event') {
    await scheduleTask(task.id);
  }

  broadcast(userId, { type: 'task_update', payload: task });
  return c.json(task, 201);
});

// Batch create tasks
app.post('/batch', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (!body.tasks || !Array.isArray(body.tasks) || body.tasks.length === 0) {
    return c.json({ error: 'tasks array is required' }, 400);
  }

  const results = [];
  for (const taskData of body.tasks) {
    const parsed = createTaskSchema.safeParse(taskData);
    if (!parsed.success) {
      return c.json({ error: 'Invalid task in batch', details: parsed.error.flatten(), task: taskData }, 400);
    }

    const data = parsed.data;
    const [task] = await db.insert(tasks).values({
      userId,
      cellId: data.cellId,
      title: data.title,
      executor: data.executor,
      action: data.action,
      triggerType: data.triggerType || null,
      triggerConfig: data.triggerConfig || null,
      whyHuman: data.whyHuman,
      actionContext: data.actionContext || null,
      status: data.executor === 'human' ? 'awaiting_user_action' : 'pending',
    }).returning();

    if (task.triggerType && task.triggerType !== 'event') {
      await scheduleTask(task.id);
    }
    results.push(task);
  }

  broadcast(userId, { type: 'tasks_created', payload: results });
  return c.json(results, 201);
});

// Update task
app.patch('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');
  const body = await c.req.json();

  // Verify ownership
  const [existing] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!existing) return c.json({ error: 'Task not found' }, 404);

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (body.status) updates.status = body.status;
  if (body.title) updates.title = body.title;
  if (body.action) updates.action = body.action;
  if (body.actionContext) updates.actionContext = body.actionContext;

  // Handle status transitions
  if (body.status === 'skipped' || body.status === 'paused') {
    await cancelScheduledTask(taskId);

    // Cancel associated draft
    if (existing.actionContext && (existing.actionContext as any).draftId) {
      const draftId = (existing.actionContext as any).draftId;
      await db.update(drafts)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(drafts.id, draftId), eq(drafts.userId, userId)));
    }
  }

  const [updated] = await db.update(tasks)
    .set(updates)
    .where(eq(tasks.id, taskId))
    .returning();

  broadcast(userId, { type: 'task_update', payload: updated });
  return c.json(updated);
});

// Approve a HITL task
app.post('/:id/approve', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');

  const [task] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.status !== 'awaiting_user_action') {
    return c.json({ error: 'Task is not awaiting approval' }, 400);
  }

  // Update draft if exists
  if (task.actionContext && (task.actionContext as any).draftId) {
    const draftId = (task.actionContext as any).draftId;
    await db.update(drafts)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(eq(drafts.id, draftId), eq(drafts.userId, userId)));
  }

  const [updated] = await db.update(tasks)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  broadcast(userId, { type: 'task_approved', payload: updated });
  return c.json(updated);
});

// Reject a HITL task
app.post('/:id/reject', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');

  const [task] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task) return c.json({ error: 'Task not found' }, 404);

  if (task.actionContext && (task.actionContext as any).draftId) {
    const draftId = (task.actionContext as any).draftId;
    await db.update(drafts)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(drafts.id, draftId), eq(drafts.userId, userId)));
  }

  const [updated] = await db.update(tasks)
    .set({ status: 'skipped', updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  broadcast(userId, { type: 'task_rejected', payload: updated });
  return c.json(updated);
});

// Run task manually
app.post('/:id/run', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');

  const [task] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task) return c.json({ error: 'Task not found' }, 404);

  // Import and run immediately
  const { taskQueue } = await import('../lib/queue.js');
  await taskQueue.add(`manual:${taskId}`, {
    taskId,
    userId,
    cellId: task.cellId,
  }, {
    removeOnComplete: true,
    removeOnFail: 5,
  });

  return c.json({ message: 'Task queued for execution' });
});

// Delete task
app.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const taskId = c.req.param('id');

  const [task] = await db.select().from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task) return c.json({ error: 'Task not found' }, 404);

  await cancelScheduledTask(taskId);
  await db.delete(tasks).where(eq(tasks.id, taskId));
  return c.json({ success: true });
});

export default app;
