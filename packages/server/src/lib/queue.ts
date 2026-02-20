import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

export const taskQueue = new Queue('tasks', { connection: redis });
export const heartbeatQueue = new Queue('heartbeat', { connection: redis });

export { Queue, Worker, type Job };
