import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import MongoConnection from './database/mongoConnection';

// Import routes
import healthRoutes from './routes/healthRoutes';
import funnelRoutes, { publicFunnelRouter } from './routes/funnelRoutes';
import challengeRoutes, { publicChallengeRouter } from './routes/challengeRoutes';
import emailRoutes from './routes/emailRoutes';
import campaignRoutes from './routes/campaignRoutes';
import segmentRoutes from './routes/segmentRoutes';
import mailingListRoutes from './routes/mailingListRoutes';
import leadRoutes from './routes/leadRoutes';
import workflowRoutes from './routes/workflowRoutes';
import trackingRoutes from './routes/trackingRoutes';
import webhookRoutes from './routes/webhookRoutes';
import { sequenceScheduler } from './services/sequenceScheduler';
import { workflowProcessor } from './services/workflowProcessor';

// Import middleware
import { authenticate, requireAdmin } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://cloudmastershub.com',
  'https://www.cloudmastershub.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or internal services)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID', 'X-Funnel-Session'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// ============================================
// Admin Routes (require authentication)
// ============================================
app.use('/admin/funnels', funnelRoutes);
app.use('/admin/challenges', challengeRoutes);
app.use('/admin/email', emailRoutes);
app.use('/admin/campaigns', campaignRoutes);
app.use('/admin/segments', segmentRoutes);
app.use('/admin/mailing-lists', mailingListRoutes);
app.use('/admin/leads', leadRoutes);
app.use('/admin/workflows', workflowRoutes);
// These will be implemented in subsequent phases:
// app.use('/admin/analytics', analyticsRoutes);

// ============================================
// Internal Routes (service-to-service, no auth)
// ============================================
app.use('/internal', emailRoutes);             // Internal email sending

// ============================================
// Public Routes (no auth required)
// ============================================
app.use('/f', publicFunnelRouter);             // /f/:funnelSlug
app.use('/challenge', publicChallengeRouter);  // /challenge/:slug
app.use('/track', trackingRoutes);             // Conversion tracking
app.use('/webhooks', webhookRoutes);           // Mailgun webhooks
// These will be implemented for public funnel pages:
// app.use('/leads', publicLeadRoutes);         // Lead capture endpoints

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'CloudMastersHub Marketing Service',
    version: '1.0.0',
    status: 'running',
    description: 'Funnels, Challenges, Email Sequences, and Lead Management',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      admin: {
        funnels: {
          list: 'GET /admin/funnels',
          create: 'POST /admin/funnels',
          get: 'GET /admin/funnels/:id',
          update: 'PUT /admin/funnels/:id',
          delete: 'DELETE /admin/funnels/:id',
          publish: 'POST /admin/funnels/:id/publish',
          unpublish: 'POST /admin/funnels/:id/unpublish',
          archive: 'POST /admin/funnels/:id/archive',
          duplicate: 'POST /admin/funnels/:id/duplicate',
          steps: 'PUT /admin/funnels/:id/steps',
          addStep: 'POST /admin/funnels/:id/steps',
          removeStep: 'DELETE /admin/funnels/:id/steps/:stepId',
          reorderSteps: 'POST /admin/funnels/:id/steps/reorder',
          analytics: 'GET /admin/funnels/:id/analytics',
        },
        challenges: {
          list: 'GET /admin/challenges',
          create: 'POST /admin/challenges',
          get: 'GET /admin/challenges/:id',
          update: 'PUT /admin/challenges/:id',
          delete: 'DELETE /admin/challenges/:id',
          publish: 'POST /admin/challenges/:id/publish',
          pause: 'POST /admin/challenges/:id/pause',
          upsertDay: 'PUT /admin/challenges/:id/days/:dayNumber',
          removeDay: 'DELETE /admin/challenges/:id/days/:dayNumber',
          setPitchDay: 'PUT /admin/challenges/:id/pitch-day',
          participants: 'GET /admin/challenges/:id/participants',
          stats: 'GET /admin/challenges/:id/stats',
          leaderboard: 'GET /admin/challenges/:id/leaderboard',
        },
        email: {
          templates: {
            list: 'GET /admin/email/templates',
            create: 'POST /admin/email/templates',
            get: 'GET /admin/email/templates/:id',
            update: 'PUT /admin/email/templates/:id',
            delete: 'DELETE /admin/email/templates/:id',
            preview: 'POST /admin/email/templates/:id/preview',
            test: 'POST /admin/email/templates/:id/test',
          },
          sequences: {
            list: 'GET /admin/email/sequences',
            create: 'POST /admin/email/sequences',
            get: 'GET /admin/email/sequences/:id',
            update: 'PUT /admin/email/sequences/:id',
            delete: 'DELETE /admin/email/sequences/:id',
          },
          send: 'POST /admin/email/send',
          bulk: 'POST /admin/email/bulk',
        },
        campaigns: {
          list: 'GET /admin/campaigns',
          create: 'POST /admin/campaigns',
          get: 'GET /admin/campaigns/:id',
          update: 'PUT /admin/campaigns/:id',
          delete: 'DELETE /admin/campaigns/:id',
          schedule: 'POST /admin/campaigns/:id/schedule',
          send: 'POST /admin/campaigns/:id/send',
          pause: 'POST /admin/campaigns/:id/pause',
          cancel: 'POST /admin/campaigns/:id/cancel',
          stats: 'GET /admin/campaigns/:id/stats',
          preview: 'POST /admin/campaigns/:id/preview',
          duplicate: 'POST /admin/campaigns/:id/duplicate',
        },
        segments: {
          list: 'GET /admin/segments',
          create: 'POST /admin/segments',
          get: 'GET /admin/segments/:id',
          update: 'PUT /admin/segments/:id',
          delete: 'DELETE /admin/segments/:id',
          preview: 'POST /admin/segments/preview',
          calculate: 'POST /admin/segments/:id/calculate',
          leads: 'GET /admin/segments/:id/leads',
          fields: 'GET /admin/segments/fields',
        },
        mailingLists: {
          list: 'GET /admin/mailing-lists',
          create: 'POST /admin/mailing-lists',
          get: 'GET /admin/mailing-lists/:id',
          update: 'PUT /admin/mailing-lists/:id',
          delete: 'DELETE /admin/mailing-lists/:id',
          archive: 'POST /admin/mailing-lists/:id/archive',
          restore: 'POST /admin/mailing-lists/:id/restore',
          duplicate: 'POST /admin/mailing-lists/:id/duplicate',
          members: 'GET /admin/mailing-lists/:id/members',
          addMembers: 'POST /admin/mailing-lists/:id/members',
          removeMembers: 'DELETE /admin/mailing-lists/:id/members',
          import: 'POST /admin/mailing-lists/:id/import',
          export: 'GET /admin/mailing-lists/:id/export',
        },
        leads: {
          list: 'GET /admin/leads',
          create: 'POST /admin/leads',
          get: 'GET /admin/leads/:id',
          update: 'PUT /admin/leads/:id',
          delete: 'DELETE /admin/leads/:id',
          search: 'POST /admin/leads/search',
          stats: 'GET /admin/leads/stats',
          tags: 'GET /admin/leads/tags',
          addTag: 'POST /admin/leads/:id/tags',
          removeTag: 'DELETE /admin/leads/:id/tags/:tag',
          bulkUpdate: 'POST /admin/leads/bulk/update',
          bulkDelete: 'POST /admin/leads/bulk/delete',
          import: 'POST /admin/leads/import',
          export: 'GET /admin/leads/export',
          merge: 'POST /admin/leads/merge',
        },
        analytics: '/admin/analytics (coming soon)',
      },
      public: {
        funnels: 'GET /f/:slug',
        challenges: {
          getChallenge: 'GET /challenge/:slug',
          register: 'POST /challenge/:slug/register',
          progress: 'GET /challenge/:slug/progress?email=...',
          completeDay: 'POST /challenge/:slug/days/:dayNumber/complete',
          leaderboard: 'GET /challenge/:slug/leaderboard',
        },
        leadCapture: '/leads/capture (coming soon)',
        tracking: {
          event: 'POST /track/event',
          pageview: 'POST /track/pageview',
          batch: 'POST /track/batch',
          pixel: 'GET /track/pixel.gif',
          funnelAnalytics: 'GET /track/analytics/funnel/:funnelId (auth required)',
          sessionJourney: 'GET /track/session/:sessionId (auth required)',
        },
        webhooks: {
          mailgun: 'POST /webhooks/mailgun (Mailgun events: delivered, opened, clicked, bounced, unsubscribed)',
          status: 'GET /webhooks/status (auth required)',
        },
      },
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
      code: 'NOT_FOUND',
    },
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const mongoConnection = MongoConnection.getInstance();
    await mongoConnection.connect();
    logger.info('MongoDB connected for Marketing Service');

    // Initialize sequence scheduler (email automation)
    try {
      await sequenceScheduler.initialize();
      logger.info('Sequence scheduler initialized');
    } catch (error) {
      logger.warn('Failed to initialize sequence scheduler (Redis may not be available):', error);
      // Continue without scheduler - emails can still be sent manually
    }

    // Initialize workflow processor (workflow automation)
    try {
      await workflowProcessor.initialize();
      logger.info('Workflow processor initialized');
    } catch (error) {
      logger.warn('Failed to initialize workflow processor (Redis may not be available):', error);
      // Continue without processor - workflows can still be managed but won't auto-execute
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`Marketing Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Available models: Funnel, Challenge, ChallengeParticipant, EmailSequence, EmailTemplate, Lead, ConversionEvent, EmailQueueJob');
    });
  } catch (error) {
    logger.error('Failed to start Marketing Service:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down marketing service gracefully`);

  try {
    // Shutdown sequence scheduler (close Bull queues)
    await sequenceScheduler.shutdown();
    logger.info('Sequence scheduler shutdown complete');

    // Shutdown workflow processor (close Bull queues)
    await workflowProcessor.shutdown();
    logger.info('Workflow processor shutdown complete');

    // Close MongoDB connection
    const mongoConnection = MongoConnection.getInstance();
    await mongoConnection.disconnect();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
