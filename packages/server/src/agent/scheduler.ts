import { db } from '../db/index.js';
import { tasks, taskRuns, drafts } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { taskQueue, Worker, redis } from '../lib/queue.js';
import { runConductor } from './conductor.js';
import { broadcast } from '../lib/websocket.js';
import { logAgentAction } from '../services/agent-log.js';

// ═══════════════════════════════════════════════════════
// TASK SCHEDULER — BullMQ-based task scheduling
// Handles delay (one-time) and cron (recurring) tasks
// ═══════════════════════════════════════════════════════

export async function scheduleTask(taskId: string): Promise<void> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const triggerConfig = task.triggerConfig as Record<string, any> | null;
  if (!triggerConfig || !task.triggerType) return;

  const jobData = { taskId, userId: task.userId, cellId: task.cellId };

  if (task.triggerType === 'delay') {
    const delay = triggerConfig.delay;
    if (!delay?.value || !delay?.unit) {
      throw new Error(`Invalid delay config for task ${taskId}`);
    }
    const ms = toMilliseconds(delay.value, delay.unit);
    await taskQueue.add(`task:${taskId}`, jobData, {
      delay: ms,
      jobId: `delay-${taskId}`,
      removeOnComplete: true,
      removeOnFail: 5,
    });
    console.log(`[Scheduler] Scheduled delay task ${taskId}: ${delay.value} ${delay.unit}`);

  } else if (task.triggerType === 'cron') {
    const expression = triggerConfig.expression;
    const timezone = triggerConfig.timezone || 'UTC';
    if (!expression) {
      throw new Error(`Invalid cron config for task ${taskId}`);
    }
    await taskQueue.add(`task:${taskId}`, jobData, {
      repeat: {
        pattern: expression,
        tz: timezone,
      },
      jobId: `cron-${taskId}`,
      removeOnComplete: true,
      removeOnFail: 5,
    });
    console.log(`[Scheduler] Scheduled cron task ${taskId}: ${expression} (${timezone})`);
  }
}

export async function cancelScheduledTask(taskId: string): Promise<void> {
  try {
    // Remove delayed job
    const delayedJob = await taskQueue.getJob(`delay-${taskId}`);
    if (delayedJob) {
      await delayedJob.remove();
      console.log(`[Scheduler] Removed delayed job for task ${taskId}`);
    }

    // Remove repeatable (cron) jobs
    const repeatableJobs = await taskQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === `cron-${taskId}` || job.name === `task:${taskId}`) {
        await taskQueue.removeRepeatableByKey(job.key);
        console.log(`[Scheduler] Removed repeatable job for task ${taskId}`);
      }
    }
  } catch (e) {
    console.warn(`[Scheduler] Failed to cancel task ${taskId}:`, (e as Error).message);
  }
}

function toMilliseconds(value: number, unit: string): number {
  switch (unit) {
    case 'minutes': return value * 60 * 1000;
    case 'hours': return value * 60 * 60 * 1000;
    case 'days': return value * 24 * 60 * 60 * 1000;
    default: return value * 60 * 1000; // default to minutes
  }
}

// ─── Task Worker ─────────────────────────────
export function startTaskWorker() {
  const worker = new Worker('tasks', async (job) => {
    const { taskId, userId, cellId } = job.data;
    console.log(`[TaskWorker] Processing task ${taskId}`);

    try {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task) {
        console.warn(`[TaskWorker] Task ${taskId} not found, skipping`);
        return;
      }

      // Skip if task has been paused/skipped/completed
      if (['paused', 'skipped', 'completed', 'failed'].includes(task.status)) {
        console.log(`[TaskWorker] Task ${taskId} is ${task.status}, skipping execution`);
        return;
      }

      // Update status to in_progress
      await db.update(tasks)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      // Log the run
      const [run] = await db.insert(taskRuns).values({
        taskId,
        status: 'running',
        startedAt: new Date(),
      }).returning();

      // Execute via conductor
      const result = await runConductor({
        type: 'timer',
        userId,
        cellId,
        content: task.action || `Execute task: ${task.title}`,
        metadata: { taskId, runId: run.id },
      });

      // Update run as successful
      await db.update(taskRuns)
        .set({
          status: 'completed',
          completedAt: new Date(),
          result: { response: result.response, toolsUsed: result.toolsUsed },
        })
        .where(eq(taskRuns.id, run.id));

      // For non-recurring tasks, mark as completed
      if (task.triggerType !== 'cron' && task.triggerType !== 'event') {
        await db.update(tasks)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(tasks.id, taskId));
      } else {
        // Recurring: reset to pending for next execution
        await db.update(tasks)
          .set({ status: 'pending', updatedAt: new Date() })
          .where(eq(tasks.id, taskId));
      }

      broadcast(userId, { type: 'task_update', payload: { taskId, status: 'completed' } });

      await logAgentAction(userId, cellId, 'execute_task', {
        taskId,
        runId: run.id,
        title: task.title,
        success: true,
      });

    } catch (e) {
      console.error(`[TaskWorker] Task ${taskId} failed:`, (e as Error).message);

      // Update task status
      await db.update(tasks)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      broadcast(userId, { type: 'task_update', payload: { taskId, status: 'failed', error: (e as Error).message } });
    }
  }, {
    connection: redis,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 60000, // Max 10 tasks per minute
    },
  });

  worker.on('failed', (job, err) => {
    console.error(`[TaskWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[TaskWorker] Worker error:', err.message);
  });

  console.log('[Scheduler] Task worker started');
  return worker;
}
