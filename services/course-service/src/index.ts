import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import courseRoutes from './routes/courseRoutes';
import lessonRoutes from './routes/lessonRoutes';
import progressRoutes from './routes/progressRoutes';
import learningPathRoutes from './routes/learningPathRoutes';
import { errorHandler } from './middleware/errorHandler';
import { initializeCoursePaymentEventSubscriber } from './events/paymentEventSubscriber';
import DatabaseConnection from './database/connection';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

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
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
  const dbConnection = DatabaseConnection.getInstance();
  const dbStatus = dbConnection.getConnectionStatus();
  
  res.json({ 
    status: 'healthy', 
    service: 'course-service', 
    timestamp: new Date().toISOString(),
    version: 'v2.0-cors-fix',
    corsUpdate: 'Applied dynamic origin validation',
    database: {
      status: dbStatus ? 'connected' : 'disconnected',
      type: 'MongoDB'
    }
  });
});

app.use('/courses', courseRoutes);
app.use('/courses/:courseId/lessons', lessonRoutes);
app.use('/progress', progressRoutes);
app.use('/paths', learningPathRoutes);

app.use(errorHandler);

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.connect();
    logger.info('MongoDB connection established');

    // Start the server
    app.listen(PORT, () => {
      logger.info(`Course Service running on port ${PORT}`);
      
      // Initialize payment event subscriber
      initializeCoursePaymentEventSubscriber();
      logger.info('Course service payment event subscriber initialized');
    });
  } catch (error) {
    logger.error('Failed to start course service:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  const dbConnection = DatabaseConnection.getInstance();
  await dbConnection.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  const dbConnection = DatabaseConnection.getInstance();
  await dbConnection.disconnect();
  process.exit(0);
});

startServer();