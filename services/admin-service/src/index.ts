import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

// Import routes (will be created next)
import healthRoutes from './routes/healthRoutes';
import userRoutes from './routes/userRoutes';
import contentRoutes from './routes/contentRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import settingsRoutes from './routes/settingsRoutes';
import securityRoutes from './routes/securityRoutes';
import pathRoutes from './routes/pathRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

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
    console.log(`🌐 ADMIN-SERVICE CORS: Request from origin: ${origin || 'NO_ORIGIN'}`);
    console.log(`🌐 ADMIN-SERVICE CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      console.log('🌐 ADMIN-SERVICE CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log(`🌐 ADMIN-SERVICE CORS: Allowing request from ${origin}`);
      callback(null, true);
    } else {
      console.warn(`🌐 ADMIN-SERVICE CORS: BLOCKED request from origin: ${origin}`);
      console.warn(`🌐 ADMIN-SERVICE CORS: Available origins: ${allowedOrigins.join(', ')}`);
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.use('/health', healthRoutes);

// Admin API routes
app.use('/admin/users', userRoutes);
app.use('/admin/content', contentRoutes);
app.use('/admin/analytics', analyticsRoutes);
app.use('/admin/settings', settingsRoutes);
app.use('/admin/security', securityRoutes);
app.use('/admin/paths', pathRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'CloudMastersHub Admin Service',
    version: '1.1-cors-fix',
    status: 'running',
    corsUpdate: 'Applied dynamic origin validation including cloudmastershub.com',
    timestamp: new Date().toISOString(),
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
    },
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Admin Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down admin service gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down admin service gracefully');
  process.exit(0);
});