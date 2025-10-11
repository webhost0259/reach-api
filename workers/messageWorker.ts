import dotenv from 'dotenv';
dotenv.config();

import { Job } from 'bull';
import messageQueue from '../src/config/queue';
import logger from '../src/utils/logger';
import whatsappService from '../src/services/whatsappService';
import messageService from '../src/services/messageService';
import { QueueJobData } from '../src/types';

class MessageWorker {
  private concurrency: number;
  private messagesPerSecond: number;
  private lastProcessTime: number = 0;

  constructor() {
    this.concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);
    this.messagesPerSecond = parseInt(process.env.MESSAGE_RATE_LIMIT || '80', 10);
  }

  async start(): Promise<void> {
    logger.info('Starting message worker...', {
      concurrency: this.concurrency,
      rateLimit: `${this.messagesPerSecond} msg/sec`,
    });

    messageQueue.process(this.concurrency, async (job: Job<QueueJobData>) => {
      return await this.processMessage(job);
    });

    logger.info('✅ Message worker is now processing jobs');
  }

  async stop(): Promise<void> {
    logger.info('Stopping message worker...');
    await messageQueue.close();
    logger.info('Message worker stopped');
  }

  private async processMessage(job: Job<QueueJobData>): Promise<any> {
    const { messageId, phoneNumber } = job.data;

    logger.info(`Processing message ${messageId}`, {
      phoneNumber,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });

    try {
      await this.enforceRateLimit();
      await messageService.updateMessageStatus(messageId, 'processing');
      await messageService.incrementAttempts(messageId);

      const result = await whatsappService.sendTemplateMessage(
                                        phoneNumber,
                                        'hello_world', // Template name
                                        'en_US'        // Language code
                                      );

      if (result.success) {
        await messageService.updateMessageStatus(messageId, 'sent');
        logger.info(`✅ Message ${messageId} sent successfully`, {
          externalId: result.messageId,
        });

        return {
          success: true,
          messageId,
          externalId: result.messageId,
        };
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to send message ${messageId}:`, {
        error: errorMessage,
        attempt: job.attemptsMade + 1,
      });

      const shouldRetry = job.attemptsMade < (job.opts.attempts || 3);
      if (!shouldRetry) {
        await messageService.updateMessageStatus(messageId, 'failed', errorMessage);
        logger.error(`Message ${messageId} failed permanently after ${job.attemptsMade + 1} attempts`);
      }

      throw error;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / this.messagesPerSecond;
    const timeSinceLastProcess = now - this.lastProcessTime;

    if (timeSinceLastProcess < minInterval) {
      const waitTime = minInterval - timeSinceLastProcess;
      logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastProcessTime = Date.now();
  }
}

export default new MessageWorker();
