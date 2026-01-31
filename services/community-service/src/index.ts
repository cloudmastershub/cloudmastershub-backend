import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import DatabaseConnection from './database/connection';
import forumRoutes, { threadRouter } from './routes/forumRoutes';
import postRoutes from './routes/postRoutes';
import groupRoutes from './routes/groupRoutes';
import questionRoutes, { answerRouter } from './routes/questionRoutes';
import connectionRoutes, { userProfileRouter } from './routes/connectionRoutes';
import eventRoutes from './routes/eventRoutes';
import moderationRoutes from './routes/moderationRoutes';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3007;

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://cloudmastershub.com',
  'https://www.cloudmastershub.com',
  'https://api.cloudmastershub.com'
];

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const db = DatabaseConnection.getInstance();
    const dbStatus = db.getConnectionStatus();

    res.json({
      status: dbStatus ? 'healthy' : 'degraded',
      service: 'community-service',
      database: dbStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'community-service',
      error: 'Health check failed'
    });
  }
});

// API Routes
app.use('/forums', forumRoutes);
app.use('/threads', threadRouter);
app.use('/posts', postRoutes);
app.use('/groups', groupRoutes);
app.use('/questions', questionRoutes);
app.use('/answers', answerRouter);
app.use('/connections', connectionRoutes);
app.use('/users', userProfileRouter);
app.use('/events', eventRoutes);
app.use('/moderation', moderationRoutes);

// Error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const db = DatabaseConnection.getInstance();
    await db.connect();

    app.listen(PORT, () => {
      logger.info(`Community Service running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  const db = DatabaseConnection.getInstance();
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  const db = DatabaseConnection.getInstance();
  await db.disconnect();
  process.exit(0);
});

startServer();
