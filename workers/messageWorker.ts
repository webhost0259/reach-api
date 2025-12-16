import dotenv from 'dotenv';
dotenv.config();

import { Job } from 'bull';
import messageQueue from '../src/config/queue';
import logger from '../src/utils/logger';
import whatsappConfigService from '../src/services/whatsAppConfigService'; // ✅ Import
import messageService from '../src/services/messageService';
import { QueueJobData } from '../src/types/message.types';
import axios from 'axios';

class MessageWorker {
  private concurrency: number;
  private messagesPerSecond: number;
  private lastProcessTime: number = 0;

  constructor() {
    this.concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);
    this.messagesPerSecond = parseInt(process.env.MESSAGE_RATE_LIMIT || '80', 10);
  }

  async start(): Promise<void> {
    logger.info('🚀 Starting message worker...', {
      concurrency: this.concurrency,
      rateLimit: `${this.messagesPerSecond} msg/sec`,
      nodeEnv: process.env.NODE_ENV,
    });

    messageQueue.process('send-message', this.concurrency, async (job: Job<QueueJobData>) => {
      return await this.processMessage(job);
    });

    messageQueue.on('completed', (job: Job, result: any) => {
      if (job.name === 'send-message') {
        logger.info(`✅ Job ${job.id} completed`, {
          messageId: result?.messageId,
          externalMessageId: result?.externalMessageId,
        });
      }
    });

    messageQueue.on('failed', (job: Job, err: Error) => {
      if (job.name === 'send-message') {
        logger.error(`❌ Job ${job.id} failed`, {
          messageId: job.data?.messageId,
          error: err.message,
          attempts: job.attemptsMade,
        });
      }
    });

    messageQueue.on('stalled', (job: Job) => {
      if (job.name === 'send-message') {
        logger.warn(`⚠️ Job ${job.id} stalled`, {
          messageId: job.data?.messageId,
        });
      }
    });

    logger.info('✅ Message worker is now processing jobs');
  }

  async stop(): Promise<void> {
    logger.info('Stopping message worker...');
    await messageQueue.close();
    logger.info('Message worker stopped');
  }

  private async processMessage(job: Job<QueueJobData>): Promise<any> {
    const { messageId, phoneNumber, templateCode, userId } = job.data;

    if (!messageId || !phoneNumber) {
      const error = 'Missing required job data: messageId or phoneNumber';
      logger.error(error, { jobData: job.data });
      throw new Error(error);
    }

    logger.info(`📤 Processing message ${messageId}`, {
      phoneNumber,
      templateCode: templateCode || 'hello_world',
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts || 3,
    });

    try {
      await this.enforceRateLimit();
      await messageService.updateMessageStatus(messageId, 'processing');
      await messageService.incrementAttempts(messageId);

      // ✅ Get tenant_id from userId
      const userResult = await messageService.getUserTenantId(userId!);
      
      if (!userResult?.tenant_id) {
        throw new Error('Tenant ID not found for user');
      }

      // ✅ Get WhatsApp config (with automatic decryption)
      const whatsappConfig = await whatsappConfigService.getActiveConfig(userResult.tenant_id);

      const templateToUse = templateCode || 'hello_world';

      // Build message payload
      const messagePayload = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateToUse,
          language: {
            code: 'en_US',
          },
        },
      };

      // ✅ Send via WhatsApp API (token already decrypted)
      const response = await axios.post(
        `https://graph.facebook.com/v21.0/${whatsappConfig.phoneNumberId}/messages`,
        messagePayload,
        {
          headers: {
            'Authorization': `Bearer ${whatsappConfig.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const externalMessageId = response.data.messages[0].id;

      // Update message with WhatsApp message ID
      await messageService.updateMessageWithExternalId(
        messageId,
        externalMessageId,
        'sent'
      );

      logger.info(`✅ Message ${messageId} sent successfully`, {
        externalMessageId,
        phoneNumber,
      });

      return {
        success: true,
        messageId,
        externalMessageId,
        phoneNumber,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`❌ Failed to send message ${messageId}`, {
        error: errorMessage,
        phoneNumber,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts || 3,
      });

      const isFinalAttempt = job.attemptsMade >= ((job.opts.attempts || 3) - 1);
      
      if (isFinalAttempt) {
        await messageService.updateMessageStatus(messageId, 'failed', errorMessage);
        logger.error(`💀 Message ${messageId} failed permanently`, {
          totalAttempts: job.attemptsMade + 1,
          error: errorMessage,
        });
      } else {
        logger.warn(`🔄 Message ${messageId} will be retried`, {
          currentAttempt: job.attemptsMade + 1,
          remainingAttempts: (job.opts.attempts || 3) - job.attemptsMade - 1,
        });
      }

      throw error;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / this.messagesPerSecond;
    const timeSinceLastProcess = now - this.lastProcessTime;

    if (timeSinceLastProcess < minInterval) {
      const waitTime = Math.ceil(minInterval - timeSinceLastProcess);
      logger.debug(`⏱️ Rate limiting: waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastProcessTime = Date.now();
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

export default new MessageWorker();
