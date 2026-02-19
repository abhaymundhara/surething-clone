import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

// Task execution queue
export const taskQueue = new Queue('tasks', { connection });

// Heartbeat queue
export const heartbeatQueue = new Queue('heartbeats', { connection });

export function createTaskWorker(handler: (job: Job) => Promise<void>): Worker {
  return new Worker('tasks', handler, {
    connection,
    concurrency: 3,
  });
}

export function createHeartbeatWorker(handler: (job: Job) => Promise<void>): Worker {
  return new Worker('heartbeats', handler, {
    connection,
    concurrency: 1,
  });
}

export { connection as redisConnection };
