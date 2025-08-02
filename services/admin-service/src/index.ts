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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'CloudMastersHub Admin Service',
    version: '1.0.0',
    status: 'running',
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