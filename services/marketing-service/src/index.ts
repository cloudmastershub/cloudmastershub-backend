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
// Future route imports will be added here:
// import emailRoutes from './routes/emailRoutes';
// import leadRoutes from './routes/leadRoutes';
// import analyticsRoutes from './routes/analyticsRoutes';

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
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
// These will be implemented in subsequent phases:
// app.use('/admin/email-sequences', emailSequenceRoutes);
// app.use('/admin/email-templates', emailTemplateRoutes);
// app.use('/admin/leads', leadRoutes);
// app.use('/admin/analytics', analyticsRoutes);

// ============================================
// Public Routes (no auth required)
// ============================================
app.use('/f', publicFunnelRouter);             // /f/:funnelSlug
app.use('/challenge', publicChallengeRouter);  // /challenge/:slug
// These will be implemented for public funnel pages:
// app.use('/leads', publicLeadRoutes);         // Lead capture endpoints
// app.use('/track', trackingRoutes);           // Conversion tracking

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
        emailSequences: '/admin/email-sequences (coming soon)',
        emailTemplates: '/admin/email-templates (coming soon)',
        leads: '/admin/leads (coming soon)',
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
        tracking: '/track (coming soon)',
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

    // Start server
    app.listen(PORT, () => {
      logger.info(`Marketing Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Available models: Funnel, Challenge, ChallengeParticipant, EmailSequence, EmailTemplate, Lead, ConversionEvent');
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
