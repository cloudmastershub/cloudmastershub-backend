import { Router, Request, Response } from 'express';
import { getDatabase } from '../services/database.service';
import { getRedisClient } from '../services/redis.service';
import { logger } from '@cloudmastershub/utils';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const health = {
      service: 'payment-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'unknown',
        redis: 'unknown',
        stripe: 'unknown'
      }
    };

    // Check database connection
    try {
      const db = getDatabase();
      await db.query('SELECT 1');
      health.checks.database = 'healthy';
    } catch (error) {
      health.checks.database = 'unhealthy';
      health.status = 'degraded';
      logger.warn('Database health check failed:', error);
    }

    // Check Redis connection
    try {
      const redis = getRedisClient();
      await redis.ping();
      health.checks.redis = 'healthy';
    } catch (error) {
      health.checks.redis = 'unhealthy';
      health.status = 'degraded';
      logger.warn('Redis health check failed:', error);
    }

    // Check Stripe configuration
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        health.checks.stripe = 'configured';
      } else {
        health.checks.stripe = 'not_configured';
        health.status = 'degraded';
      }
    } catch (error) {
      health.checks.stripe = 'error';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      service: 'payment-service',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal health check error'
    });
  }
});

router.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

router.get('/readiness', async (req: Request, res: Response) => {
  try {
    // Check if service is ready to handle requests
    const db = getDatabase();
    await db.query('SELECT 1');
    
    const redis = getRedisClient();
    await redis.ping();

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Service dependencies not available'
    });
  }
});

export default router;