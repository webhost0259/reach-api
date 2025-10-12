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
    logger.info('🚀 Starting message worker...', {
      concurrency: this.concurrency,
      rateLimit: `${this.messagesPerSecond} msg/sec`,
      nodeEnv: process.env.NODE_ENV,
    });

    // Process jobs with configured concurrency
    messageQueue.process(this.concurrency, async (job: Job<QueueJobData>) => {
      return await this.processMessage(job);
    });

    // Event listeners for monitoring
    messageQueue.on('completed', (job: Job, result: any) => {
      logger.info(`✅ Job ${job.id} completed`, {
        messageId: result.messageId,
        externalMessageId: result.externalMessageId,
      });
    });

    messageQueue.on('failed', (job: Job, err: Error) => {
      logger.error(`❌ Job ${job.id} failed`, {
        messageId: job.data.messageId,
        error: err.message,
        attempts: job.attemptsMade,
      });
    });

    messageQueue.on('stalled', (job: Job) => {
      logger.warn(`⚠️ Job ${job.id} stalled`, {
        messageId: job.data.messageId,
      });
    });

    logger.info('✅ Message worker is now processing jobs');
  }

  async stop(): Promise<void> {
    logger.info('Stopping message worker...');
    await messageQueue.close();
    logger.info('Message worker stopped');
  }

  /**
   * Process individual message job
   * 
   * Flow:
   * 1. Rate limit enforcement
   * 2. Update status to 'processing'
   * 3. Call WhatsApp API with messageId
   * 4. WhatsApp service updates DB with external_message_id
   * 5. Return success or throw error for retry
   */
  private async processMessage(job: Job<QueueJobData>): Promise<any> {
    const { messageId, phoneNumber, templateCode } = job.data;

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

      const templateToUse = templateCode || 'hello_world';
      const languageCode = 'en_US';

      // CRITICAL FIX: Don't pass any parameters for hello_world template
      const parameters = undefined;  // Always undefined for now

      const result = await whatsappService.sendTemplateMessage(
        phoneNumber,
        templateToUse,
        languageCode,
        parameters,  // Always undefined
        messageId
      );

      if (result.success) {
        logger.info(`✅ Message ${messageId} sent successfully`, {
          externalMessageId: result.externalMessageId,
          phoneNumber,
        });

        return {
          success: true,
          messageId,
          externalMessageId: result.externalMessageId,
          phoneNumber,
        };
      } else {
        throw new Error(result.error || 'Failed to send message via WhatsApp API');
      }
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


  /**
   * Enforce rate limiting to comply with WhatsApp API limits
   * WhatsApp Cloud API: 80 messages/second (Business), 1000/day (Developer)
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / this.messagesPerSecond; // milliseconds between messages
    const timeSinceLastProcess = now - this.lastProcessTime;

    if (timeSinceLastProcess < minInterval) {
      const waitTime = Math.ceil(minInterval - timeSinceLastProcess);
      logger.debug(`⏱️ Rate limiting: waiting ${waitTime}ms`, {
        lastProcess: this.lastProcessTime,
        now,
        minInterval,
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastProcessTime = Date.now();
  }

  /**
   * Parse template parameters from content string
   * 
   * Examples:
   * - "John" → [{ type: 'text', text: 'John' }]
   * - "John,Doe,123" → [{ type: 'text', text: 'John' }, { type: 'text', text: 'Doe' }, { type: 'text', text: '123' }]
   * 
   * @param content - Comma-separated parameter values
   * @returns Array of parameter objects for WhatsApp API
   */
  // private parseTemplateParameters(content: string): Array<{ type: string; text: string }> | undefined {
  //   // Return undefined if content is empty/whitespace
  //   if (!content || content.trim().length === 0) {
  //     return undefined;
  //   }

  //   // Split by comma and filter empty values
  //   const values = content.split(',').map(v => v.trim()).filter(v => v.length > 0);
    
  //   // Return undefined if no values after filtering
  //   if (values.length === 0) {
  //     return undefined;
  //   }

  //   // Return array of parameters
  //   return values.map(value => ({
  //     type: 'text',
  //     text: value,
  //   }));
  // }
  /**
   * Get worker health status
   */
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
