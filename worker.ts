import dotenv from 'dotenv';
dotenv.config();

import logger from './src/utils/logger';
import messageWorker from './workers/messageWorker';
import { testDatabaseConnection } from './src/config/database';
import { testRedisConnection } from './src/config/redis';

async function startWorker(): Promise<void> {
  try {
    await testDatabaseConnection();
    logger.info('✅ Worker database connection established');

    await testRedisConnection();
    logger.info('✅ Worker Redis connection established');

    await messageWorker.start();
    logger.info('🔧 ReachAPI worker started successfully');
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (error) {
    logger.error('❌ Failed to start worker:', error);
    process.exit(1);
  }
}

const gracefulShutdown = async (): Promise<void> => {
  logger.info('Shutting down worker gracefully...');
  await messageWorker.stop();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

startWorker().catch((error) => {
  logger.error('Failed to start worker:', error);
  process.exit(1);
});
