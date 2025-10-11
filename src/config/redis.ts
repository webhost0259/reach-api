import Redis from 'ioredis';
import logger from '../utils/logger';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  retryStrategy: (times: number) => number;
  maxRetriesPerRequest: number;
}

const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number): number => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

// Create Redis client
const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  logger.info('✅ Redis client connected');
});

redisClient.on('error', (err: Error) => {
  logger.error('❌ Redis client error:', err);
});

redisClient.on('ready', () => {
  logger.info('✅ Redis client ready');
});

redisClient.on('reconnecting', () => {
  logger.warn('⚠️ Redis client reconnecting...');
});

redisClient.on('close', () => {
  logger.warn('⚠️ Redis connection closed');
});

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const result = await redisClient.ping();
    if (result === 'PONG') {
      logger.info('Redis connection test successful');
      return true;
    }
    throw new Error('Redis ping failed');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export { redisClient };
export default redisClient;
