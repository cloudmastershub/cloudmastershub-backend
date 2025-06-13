import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from '../utils/logger';

const router = Router();

const serviceRoutes = {
  '/users': {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    changeOrigin: true,
  },
  '/courses': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
  },
  '/labs': {
    target: process.env.LAB_SERVICE_URL || 'http://lab-service:3003',
    changeOrigin: true,
  },
};

Object.entries(serviceRoutes).forEach(([path, config]) => {
  router.use(
    path,
    createProxyMiddleware({
      ...config,
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${path}:`, err);
        res.status(502).json({
          success: false,
          error: {
            message: 'Service temporarily unavailable',
            service: path.substring(1),
          },
        });
      },
      onProxyReq: (proxyReq, req) => {
        logger.debug(`Proxying ${req.method} ${req.path} to ${config.target}`);
      },
    })
  );
});

export default router;
