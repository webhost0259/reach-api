import Queue, { Job, JobOptions } from 'bull';
import logger from '../utils/logger';
import { QueueJobData } from '../types/message.types';

const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
    backoff: {
      type: 'exponential' as const,
      delay: parseInt(process.env.RETRY_DELAY || '5000', 10),
    },
    removeOnComplete: true,
    removeOnFail: false,
  } as JobOptions,
};

// Create message queue with Redis connection
const messageQueue = new Queue<QueueJobData>(
  process.env.QUEUE_NAME || 'reach-api-messages',
  queueConfig
);

// Queue event listeners
messageQueue.on('error', (error: Error) => {
  logger.error('Queue error:', error);
});

messageQueue.on('waiting', (jobId: string) => {
  logger.debug(`Job ${jobId} is waiting`);
});

messageQueue.on('active', (job: Job<QueueJobData>) => {
  logger.info(`Job ${job.id} started processing`, { data: job.data });
});

messageQueue.on('completed', (job: Job<QueueJobData>, result: any) => {
  logger.info(`Job ${job.id} completed successfully`, { result });
});

messageQueue.on('failed', (job: Job<QueueJobData>, err: Error) => {
  logger.error(`Job ${job.id} failed:`, { error: err.message, data: job.data });
});

messageQueue.on('stalled', (job: Job<QueueJobData>) => {
  logger.warn(`Job ${job.id} has stalled`, { data: job.data });
});

export { messageQueue };
export default messageQueue;
