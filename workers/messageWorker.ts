import { Job } from 'bull';
import messageQueue from '../src/config/queue';
import logger from '../src/utils/logger';
import { QueueJobData } from '../src/types';

class MessageWorker {
  async start(): Promise<void> {
    logger.info('Starting message worker...');

    // Process jobs from the queue
    messageQueue.process(
      parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
      async (job: Job<QueueJobData>) => {
        return await this.processMessage(job);
      }
    );

    logger.info('Message worker is now processing jobs');
  }

  async stop(): Promise<void> {
    logger.info('Stopping message worker...');
    await messageQueue.close();
    logger.info('Message worker stopped');
  }

  private async processMessage(job: Job<QueueJobData>): Promise<any> {
    const { messageId, phoneNumber, content } = job.data;

    logger.info(`Processing message ${messageId}`, {
      phoneNumber,
      content,
      attempt: job.attemptsMade + 1,
    });

    try {
      // TODO: Implement actual message sending logic here
      // This will be implemented in the whatsappService

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      logger.info(`Message ${messageId} sent successfully`);
      return { success: true, messageId };
    } catch (error) {
      logger.error(`Failed to send message ${messageId}:`, error);
      throw error;
    }
  }
}

export default new MessageWorker();
