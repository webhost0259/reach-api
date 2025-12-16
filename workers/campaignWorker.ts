import dotenv from 'dotenv';
dotenv.config();

import { Job } from 'bull';
import messageQueue from '../src/config/queue';
import logger from '../src/utils/logger';
import { processCampaign } from './campaignProcessor';

class CampaignWorker {
  private concurrency: number;

  constructor() {
    this.concurrency = 1;
  }

  async start(): Promise<void> {
    logger.info('🚀 Starting campaign worker...', {
      concurrency: this.concurrency,
      nodeEnv: process.env.NODE_ENV,
    });

    // ✅ Use any to bypass type checking for named processors
    messageQueue.process('process-campaign', this.concurrency, async (job: Job<any>) => {
      return await processCampaign(job);
    });

    messageQueue.on('completed', (job: Job) => {
      if (job.name === 'process-campaign') {
        logger.info(`✅ Campaign job ${job.id} completed`, {
          campaign_id: job.data.campaign_id,
        });
      }
    });

    messageQueue.on('failed', (job: Job, err: Error) => {
      if (job.name === 'process-campaign') {
        logger.error(`❌ Campaign job ${job.id} failed`, {
          campaign_id: job.data.campaign_id,
          error: err.message,
          attempts: job.attemptsMade,
        });
      }
    });

    messageQueue.on('stalled', (job: Job) => {
      if (job.name === 'process-campaign') {
        logger.warn(`⚠️ Campaign job ${job.id} stalled`, {
          campaign_id: job.data.campaign_id,
        });
      }
    });

    logger.info('✅ Campaign worker is now processing jobs');
  }

  async stop(): Promise<void> {
    logger.info('Stopping campaign worker...');
    logger.info('Campaign worker stopped');
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      messageQueue.getWaitingCount(),
      messageQueue.getActiveCount(),
      messageQueue.getCompletedCount(),
      messageQueue.getFailedCount(),
    ]);

    return {
      isRunning: true,
      waiting,
      active,
      completed,
      failed,
    };
  }
}

export default new CampaignWorker();
