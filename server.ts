import dotenv from 'dotenv';
dotenv.config();

import app from './src/config/app';
import logger from './src/utils/logger';
import { testDatabaseConnection } from './src/config/database';
import { testRedisConnection } from './src/config/redis';

const PORT = parseInt(process.env.PORT || '8081', 10);

async function startServer(): Promise<void> {
  try {
    // Test database connection
    await testDatabaseConnection();
    logger.info('✅ Database connection established');

    // Test Redis connection
    await testRedisConnection();
    logger.info('✅ Redis connection established');

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`🚀 ReachAPI server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`📖 Redoc Documentation: http://localhost:${PORT}/docs`);
      logger.info(`🔍 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = (): void => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
