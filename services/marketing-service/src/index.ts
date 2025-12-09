import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import MongoConnection from './database/mongoConnection';

// Import routes
import healthRoutes from './routes/healthRoutes';
// Future route imports will be added here:
// import funnelRoutes from './routes/funnelRoutes';
// import challengeRoutes from './routes/challengeRoutes';
// import emailRoutes from './routes/emailRoutes';
// import leadRoutes from './routes/leadRoutes';
// import analyticsRoutes from './routes/analyticsRoutes';

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
// These will be implemented in subsequent phases:
// app.use('/admin/funnels', authenticate, requireAdmin, funnelRoutes);
// app.use('/admin/challenges', authenticate, requireAdmin, challengeRoutes);
// app.use('/admin/email-sequences', authenticate, requireAdmin, emailSequenceRoutes);
// app.use('/admin/email-templates', authenticate, requireAdmin, emailTemplateRoutes);
// app.use('/admin/leads', authenticate, requireAdmin, leadRoutes);
// app.use('/admin/analytics', authenticate, requireAdmin, analyticsRoutes);

// ============================================
// Public Routes (no auth required)
// ============================================
// These will be implemented for public funnel pages:
// app.use('/f', publicFunnelRoutes);           // /f/:funnelSlug
// app.use('/challenge', publicChallengeRoutes); // /challenge/:slug
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
        funnels: '/admin/funnels (coming soon)',
        challenges: '/admin/challenges (coming soon)',
        emailSequences: '/admin/email-sequences (coming soon)',
        emailTemplates: '/admin/email-templates (coming soon)',
        leads: '/admin/leads (coming soon)',
        analytics: '/admin/analytics (coming soon)',
      },
      public: {
        funnels: '/f/:slug (coming soon)',
        challenges: '/challenge/:slug (coming soon)',
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
