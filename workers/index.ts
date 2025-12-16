import dotenv from 'dotenv';
dotenv.config();

import messageWorker from './messageWorker';
import campaignWorker from './campaignWorker';
import campaignScheduler from '../src/services/campaignScheduler';
import logger from '../src/utils/logger';

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  campaignScheduler.stop();
  await campaignWorker.stop();
  await messageWorker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  campaignScheduler.stop();
  await campaignWorker.stop();
  await messageWorker.stop();
  process.exit(0);
});

// Error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start workers
(async () => {
  try {
    // Start message worker
    await messageWorker.start();
    
    // Start campaign worker
    await campaignWorker.start();
    
    // Start campaign scheduler
    campaignScheduler.start();
    
    logger.info('✅ All workers started successfully');
    
    // Log status every 60 seconds
    setInterval(async () => {
      const messageStatus = await messageWorker.getStatus();
      const campaignStatus = await campaignWorker.getStatus();
      
      logger.info('📊 Worker status:', {
        messages: messageStatus,
        campaigns: campaignStatus,
      });
    }, 60000);
    
  } catch (error) {
    logger.error('Failed to start workers:', error);
    process.exit(1);
  }
})();
