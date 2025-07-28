import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from '../utils/logger';

const router = Router();

const serviceRoutes = {
  '/auth': {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    changeOrigin: true,
    timeout: 30000, // 30 seconds
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/auth': '/auth'
    }
  },
  '/users': {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/users': '/users'
    }
  },
  '/courses': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/courses': '/courses'
    }
  },
  '/paths': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/paths': '/paths'
    }
  },
  '/labs': {
    target: process.env.LAB_SERVICE_URL || 'http://lab-service:3003',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/labs': '/labs'
    }
  },
  '/payments': {
    target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/payments': '/payments'
    }
  },
  '/subscriptions': {
    target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/subscriptions': '/subscriptions'
    }
  },
  '/purchases': {
    target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/purchases': '/purchases'
    }
  },
  '/webhooks': {
    target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/webhooks': '/webhooks'
    }
  },
  '/instructor': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/instructor': '/instructor'
    }
  },
  '/admin': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin': '/admin'
    }
  },
  '/admin/courses': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/courses': '/admin/courses'
    }
  },
  '/admin/instructors': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/instructors': '/admin/instructors'
    }
  },
  '/admin/stats': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/stats': '/admin/stats'
    }
  },
};

Object.entries(serviceRoutes).forEach(([path, config]) => {
  router.use(
    path,
    createProxyMiddleware({
      ...config,
      secure: false,
      ws: true,
      logLevel: 'debug',
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${path}:`, err);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: {
              message: 'Service temporarily unavailable',
              service: path.substring(1),
            },
          });
        }
      },
      onProxyReq: (proxyReq, req, res) => {
        // Log the original request
        logger.debug(`Proxying ${req.method} ${req.originalUrl} to ${config.target}${req.path}`);
        
        // If there's a body, ensure it's properly forwarded
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        logger.debug(`Received response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },
    })
  );
});

export default router;
