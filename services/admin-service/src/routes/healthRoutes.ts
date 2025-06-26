import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      service: 'admin-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    };

    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'admin-service',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

export default router;