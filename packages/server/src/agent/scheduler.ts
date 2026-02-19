import { db } from '../db/index.js';
import { tasks, taskRuns, cells } from '../db/schema.js';
import { eq, and, isNotNull } from 'drizzle-orm';
import { taskQueue, heartbeatQueue, createTaskWorker, createHeartbeatWorker } from '../lib/queue.js';
import { runConductor, type Signal } from './conductor.js';
import { runHeartbeat } from './heartbeat.js';
import { broadcast } from '../lib/websocket.js';
import type { Job } from 'bullmq';

// ═══════════════════════════════════════════════════════
// TASK SCHEDULER — BullMQ integration
// Handles delayed, cron, and event-triggered tasks
// ═══════════════════════════════════════════════════════

export async function scheduleTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || !task.triggerType) return;

  const config = task.triggerConfig as Record<string, unknown>;

  if (task.triggerType === 'delay') {
    const delay = config.delay as { value: number; unit: string };
    let ms = delay.value;
    if (delay.unit === 'minutes') ms *= 60_000;
    else if (delay.unit === 'hours') ms *= 3_600_000;
    else if (delay.unit === 'days') ms *= 86_400_000;

    await taskQueue.add('execute-task', { taskId }, {
      delay: ms,
      jobId: `task-${taskId}`,
      removeOnComplete: true,
    });
    console.log(`[Scheduler] Delayed task ${taskId} by ${delay.value} ${delay.unit}`);
  }

  if (task.triggerType === 'cron') {
    const expression = config.expression as string;
    const timezone = (config as Record<string, string>).timezone || 'UTC';

    await taskQueue.upsertJobScheduler(
      `cron-${taskId}`,
      { pattern: expression, tz: timezone },
      { name: 'execute-task', data: { taskId } }
    );
    console.log(`[Scheduler] Cron task ${taskId}: ${expression} (${timezone})`);
  }
}

export async function cancelScheduledTask(taskId: string): Promise<void> {
  try {
    // Remove delayed job
    const job = await taskQueue.getJob(`task-${taskId}`);
    if (job) await job.remove();

    // Remove cron scheduler
    await taskQueue.removeJobScheduler(`cron-${taskId}`);

    console.log(`[Scheduler] Cancelled scheduled task ${taskId}`);
  } catch (e) {
    console.warn(`[Scheduler] Cancel failed for ${taskId}:`, (e as Error).message);
  }
}

// ─── Task Worker ─────────────────────────────────────────

async function processTaskJob(job: Job): Promise<void> {
  const { taskId } = job.data;
  console.log(`[Scheduler] Executing task ${taskId}`);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) {
    console.warn(`[Scheduler] Task ${taskId} not found`);
    return;
  }

  // Skip if already completed/skipped
  if (['completed', 'failed', 'skipped'].includes(task.status)) {
    console.log(`[Scheduler] Task ${taskId} already ${task.status}, skipping`);
    return;
  }

  // Get cell owner
  const [cell] = await db.select().from(cells).where(eq(cells.id, task.cellId));
  if (!cell) return;

  // Create task run record
  const [run] = await db.insert(taskRuns).values({
    taskId,
    status: 'running',
  }).returning();

  // Update task status
  await db.update(tasks).set({ status: 'in_progress' }).where(eq(tasks.id, taskId));

  try {
    if (task.executor === 'human') {
      // Human tasks: just notify, don't execute
      await db.update(tasks).set({ status: 'awaiting_user_action' }).where(eq(tasks.id, taskId));
      broadcast(cell.userId, { type: 'task_update', payload: { ...task, status: 'awaiting_user_action' } });
      await db.update(taskRuns).set({ status: 'waiting_human', completedAt: new Date() }).where(eq(taskRuns.id, run.id));
      return;
    }

    // AI tasks: run through conductor
    const signal: Signal = {
      type: 'timer',
      userId: cell.userId,
      cellId: task.cellId,
      conversationId: task.conversationId || undefined,
      content: task.action || `Execute task: ${task.title}`,
    };

    const result = await runConductor(signal);

    // For non-recurring tasks, mark completed
    if (task.triggerType !== 'cron') {
      await db.update(tasks).set({ status: 'completed', completedAt: new Date() }).where(eq(tasks.id, taskId));
    }

    await db.update(taskRuns).set({
      status: 'completed',
      result: { response: result.response, toolsUsed: result.toolsUsed },
      completedAt: new Date(),
    }).where(eq(taskRuns.id, run.id));

    broadcast(cell.userId, { type: 'task_update', payload: { ...task, status: 'completed' } });

  } catch (e) {
    console.error(`[Scheduler] Task ${taskId} failed:`, (e as Error).message);

    if (task.triggerType !== 'cron') {
      await db.update(tasks).set({ status: 'failed' }).where(eq(tasks.id, taskId));
    }
    await db.update(taskRuns).set({
      status: 'failed',
      result: { error: (e as Error).message },
      completedAt: new Date(),
    }).where(eq(taskRuns.id, run.id));
  }
}

// ─── Heartbeat Worker ────────────────────────────────────

async function processHeartbeatJob(job: Job): Promise<void> {
  const { cellId, userId } = job.data;
  await runHeartbeat(cellId, userId);
}

// ─── Initialize Workers ──────────────────────────────────

export function initializeScheduler(): void {
  const taskWorker = createTaskWorker(processTaskJob);
  const heartbeatWorker = createHeartbeatWorker(processHeartbeatJob);

  taskWorker.on('failed', (job, err) => {
    console.error(`[Scheduler] Task job ${job?.id} failed:`, err.message);
  });

  heartbeatWorker.on('failed', (job, err) => {
    console.error(`[Scheduler] Heartbeat job ${job?.id} failed:`, err.message);
  });

  console.log('[Scheduler] Task and heartbeat workers initialized');
}

// ─── Schedule all existing cron tasks on startup ─────────

export async function restoreScheduledTasks(): Promise<void> {
  const cronTasks = await db.select().from(tasks)
    .where(and(
      eq(tasks.triggerType, 'cron'),
      eq(tasks.status, 'pending')
    ));

  for (const task of cronTasks) {
    await scheduleTask(task.id);
  }

  console.log(`[Scheduler] Restored ${cronTasks.length} cron tasks`);
}
