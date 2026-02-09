import { Router, Request } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ClientRequest } from 'http';
import logger from '../utils/logger';
import crypto from 'crypto';

const router = Router();

/**
 * Forward auth + security headers from the incoming Express request
 * to the outgoing proxy ClientRequest.
 *
 * http-proxy-middleware v2.x does not reliably forward the Authorization
 * header through Express middleware chains. Explicitly copying it onto
 * proxyReq guarantees end-to-end Bearer token propagation.
 */
function forwardHeaders(proxyReq: ClientRequest, req: Request, serviceName: string): void {
  // 1. Forward Authorization header (the critical fix)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    proxyReq.setHeader('Authorization', authHeader);
  }

  // 2. Forward gateway-extracted user context headers
  if (req.headers['x-user-id'])          proxyReq.setHeader('X-User-Id', req.headers['x-user-id'] as string);
  if (req.headers['x-user-email'])       proxyReq.setHeader('X-User-Email', req.headers['x-user-email'] as string);
  if (req.headers['x-user-roles'])       proxyReq.setHeader('X-User-Roles', req.headers['x-user-roles'] as string);
  if (req.headers['x-subscription-tier']) proxyReq.setHeader('X-Subscription-Tier', req.headers['x-subscription-tier'] as string);

  // 3. Tenant context
  if (req.headers['x-tenant-id'])  proxyReq.setHeader('X-Tenant-Id', req.headers['x-tenant-id'] as string);

  // 4. Security / observability headers
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  proxyReq.setHeader('X-Request-ID', requestId);
  proxyReq.setHeader('X-Service-Name', 'api-gateway');
  proxyReq.setHeader('X-Forwarded-Service', serviceName);
}

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
  '/referrals': {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/referrals': '/referrals'
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
  '/curriculum': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/curriculum': '/curriculum'
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
  '/bootcamps': {
    target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/bootcamps': '/bootcamps'
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
  // Admin routes - order matters (most specific first)
  '/admin/instructors': {
    target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/instructors': '/admin/instructors'
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
  // Removed /admin/paths - learning paths are now managed by course service only
  '/admin/users': {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/users': '/admin/users'
    }
  },
  '/admin/stats': {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/stats': '/admin/stats'
    }
  },
  '/admin/analytics': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/analytics': '/admin/analytics'
    }
  },
  '/admin/settings': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/settings': '/admin/settings'
    }
  },
  '/admin/security': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/security': '/admin/security'
    }
  },
  '/admin/landing-pages': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/landing-pages': '/admin/landing-pages'
    }
  },
  '/admin/content': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/content': '/admin/content'
    }
  },
  '/admin/video-popups': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/video-popups': '/admin/video-popups'
    }
  },
  '/admin/popups': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/admin/popups': '/admin/popups'
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
  // Public landing pages (no authentication required)
  '/pages': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/pages': '/pages'
    }
  },
  // Public video popups (no authentication required) - backward compatibility
  '/video-popups': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/video-popups': '/video-popups'
    }
  },
  // Public popups (unified route - no authentication required)
  '/popups': {
    target: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/popups': '/popups'
    }
  },
  // Marketing Service routes - Funnels, Challenges, Email
  '/marketing/admin/funnels': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/funnels': '/admin/funnels'
    }
  },
  '/marketing/admin/challenges': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/challenges': '/admin/challenges'
    }
  },
  '/marketing/admin/email': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/email': '/admin/email'
    }
  },
  '/marketing/admin/campaigns': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/campaigns': '/admin/campaigns'
    }
  },
  '/marketing/admin/sequences': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/sequences': '/admin/sequences'
    }
  },
  '/marketing/admin/leads': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/leads': '/admin/leads'
    }
  },
  '/marketing/admin/workflows': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/workflows': '/admin/workflows'
    }
  },
  '/marketing/admin/segments': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/segments': '/admin/segments'
    }
  },
  '/marketing/admin/mailing-lists': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/mailing-lists': '/admin/mailing-lists'
    }
  },
  '/marketing/admin/tags': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/tags': '/admin/tags'
    }
  },
  '/marketing/admin/analytics': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/admin/analytics': '/admin/analytics'
    }
  },
  '/marketing/f': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/f': '/f'
    }
  },
  '/marketing/challenge': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/challenge': '/challenge'
    }
  },
  '/marketing/health': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/health': '/health'
    }
  },
  '/marketing/webhooks': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/webhooks': '/webhooks'
    }
  },
  '/marketing/track': {
    target: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/marketing/track': '/track'
    }
  },
  // Community Service routes
  '/community/forums': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/forums': '/forums'
    }
  },
  '/community/threads': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/threads': '/threads'
    }
  },
  '/community/posts': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/posts': '/posts'
    }
  },
  '/community/groups': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/groups': '/groups'
    }
  },
  '/community/questions': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/questions': '/questions'
    }
  },
  '/community/answers': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/answers': '/answers'
    }
  },
  '/community/events': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/events': '/events'
    }
  },
  '/community/connections': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/connections': '/connections'
    }
  },
  '/community/users': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/users': '/users'
    }
  },
  '/community/health': {
    target: process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3007',
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: {
      '^/api/community/health': '/health'
    }
  },
};

// Explicit admin routes (most specific first, order matters)
const explicitAdminRoutes: Array<{ path: string; target: string; service: string; rewrite: Record<string, string> }> = [
  { path: '/admin/stats', target: process.env.USER_SERVICE_URL || 'http://user-service:3001', service: 'user-service', rewrite: { '^/api/admin/stats': '/admin/stats' } },
  { path: '/admin/users', target: process.env.USER_SERVICE_URL || 'http://user-service:3001', service: 'user-service', rewrite: { '^/api/admin/users': '/admin/users' } },
  { path: '/admin/instructors', target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002', service: 'course-service', rewrite: { '^/api/admin/instructors': '/admin/instructors' } },
  { path: '/admin/courses', target: process.env.COURSE_SERVICE_URL || 'http://course-service:3002', service: 'course-service', rewrite: { '^/api/admin/courses': '/admin/courses' } },
];

for (const route of explicitAdminRoutes) {
  router.use(route.path, createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    pathRewrite: route.rewrite,
    secure: false,
    ws: true,
    logLevel: 'debug',
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${route.path}:`, err);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: { message: 'Service temporarily unavailable', service: route.service },
        });
      }
    },
    onProxyReq: (proxyReq, req, res) => {
      forwardHeaders(proxyReq, req as Request, route.service);
      logger.debug(`Proxying ${req.method} ${req.originalUrl} → ${route.service}`, {
        requestId: proxyReq.getHeader('x-request-id'),
      });
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      logger.debug(`Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
    },
  }));
}

// Learning paths are now handled by course service with admin role restrictions

// Removed /admin/paths routing - learning paths are managed by course service only

// Handle general routes with prefix matching
Object.entries(serviceRoutes).forEach(([routePath, config]) => {
  // Skip specific admin routes as they're handled above
  if (['/admin/stats', '/admin/users', '/admin/instructors', '/admin/courses'].includes(routePath)) return;

  // Derive service name from target URL for logging
  const serviceName = config.target.replace(/https?:\/\//, '').replace(/:\d+$/, '');

  router.use(
    routePath,
    createProxyMiddleware({
      ...config,
      secure: false,
      ws: true,
      logLevel: 'debug',
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${routePath}:`, err);
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: {
              message: 'Service temporarily unavailable',
              service: routePath.substring(1),
            },
          });
        }
      },
      onProxyReq: (proxyReq, req, res) => {
        forwardHeaders(proxyReq, req as Request, serviceName);
        logger.debug(`Proxying ${req.method} ${req.originalUrl} → ${serviceName}`, {
          requestId: proxyReq.getHeader('x-request-id'),
        });
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        logger.debug(`Response ${proxyRes.statusCode} for ${req.method} ${req.originalUrl}`);
      },
    })
  );
});

export default router;
