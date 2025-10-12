import dotenv from 'dotenv';
dotenv.config();

import messageWorker from './messageWorker';
import logger from '../src/utils/logger';

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await messageWorker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
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

// Start worker
(async () => {
  try {
    await messageWorker.start();
    
    // Log status every 60 seconds
    setInterval(async () => {
      const status = await messageWorker.getStatus();
      logger.info('📊 Worker status:', status);
    }, 60000);
    
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
})();
