import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', (req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    status: 'healthy',
    service: 'marketing-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoStatus,
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * Readiness probe
 * GET /health/ready
 */
router.get('/ready', (req: Request, res: Response) => {
  const isReady = mongoose.connection.readyState === 1;

  if (isReady) {
    res.json({
      status: 'ready',
      mongodb: 'connected',
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      mongodb: 'disconnected',
    });
  }
});

/**
 * Liveness probe
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;
