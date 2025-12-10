import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from '@cloudmastershub/utils';
import { errorHandler } from '@cloudmastershub/middleware';
import { connectDatabase, disconnectDatabase } from './services/database.service';
import { connectRedis } from './services/redis.service';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
import purchaseRoutes from './routes/purchase.routes';
import webhookRoutes from './routes/webhook.routes';
import healthRoutes from './routes/health.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Security middleware
app.use(helmet());

// CORS configuration with proper origin handling
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:3000',
  'http://localhost:3001', 
  'https://cloudmastershub.com',
  'https://www.cloudmastershub.com'
];

app.use(cors({
  origin: (origin, callback) => {
    console.log(`🌐 PAYMENT-SERVICE CORS: Request from origin: ${origin || 'NO_ORIGIN'}`);
    console.log(`🌐 PAYMENT-SERVICE CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      console.log('🌐 PAYMENT-SERVICE CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log(`🌐 PAYMENT-SERVICE CORS: Allowing request from ${origin}`);
      callback(null, true);
    } else {
      console.warn(`🌐 PAYMENT-SERVICE CORS: BLOCKED request from origin: ${origin}`);
      console.warn(`🌐 PAYMENT-SERVICE CORS: Available origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
}));

// Rate limiting - exclude health endpoints to prevent k8s probe failures
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check endpoints (k8s probes)
    return req.path.startsWith('/health');
  },
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/webhooks', webhookRoutes); // Webhooks need to be before auth middleware
app.use('/subscriptions', subscriptionRoutes);
app.use('/payments', paymentRoutes);
app.use('/purchases', purchaseRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Payment service endpoint not found'
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    await disconnectDatabase();
    logger.info('Database connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to database and Redis
    await connectDatabase();
    await connectRedis();
    
    app.listen(PORT, () => {
      logger.info(`Payment Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start Payment Service:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;