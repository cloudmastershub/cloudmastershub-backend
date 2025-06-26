import { createClient, RedisClientType } from 'redis';
import { logger } from '@cloudmastershub/utils';

let redisClient: RedisClientType | null = null;

export const connectRedis = async (): Promise<void> => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Payment Service connected to Redis');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Payment Service reconnecting to Redis...');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redisClient;
};

export const setCache = async (
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> => {
  try {
    const client = getRedisClient();
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Redis set error:', error);
    throw error;
  }
};

export const getCache = async <T = any>(key: string): Promise<T | null> => {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    logger.error('Redis delete error:', error);
    throw error;
  }
};

export const publishEvent = async (
  channel: string,
  event: any
): Promise<void> => {
  try {
    const client = getRedisClient();
    await client.publish(channel, JSON.stringify(event));
    logger.info(`Published event to channel ${channel}:`, event);
  } catch (error) {
    logger.error('Redis publish error:', error);
    throw error;
  }
};