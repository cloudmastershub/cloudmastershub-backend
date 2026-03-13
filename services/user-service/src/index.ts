import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import referralRoutes from './routes/referralRoutes';
import instructorRoutes from './routes/instructorRoutes';
import adminRoutes from './routes/adminRoutes';
import internalRoutes from './routes/internalRoutes';
import { errorHandler } from './middleware/errorHandler';
import { initializePaymentEventSubscriber } from './events/paymentEventSubscriber';
import { userSignupPublisher } from './events/userSignupPublisher';
import { initializeDatabase, getDatabaseHealth } from './services/userService';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
    // Allow requests with no origin (internal service-to-service, Postman)
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
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
  try {
    const dbHealth = await getDatabaseHealth();
    const mongoState = mongoose.connection.readyState;
    const mongoHealthy = mongoState === 1; // 1 = connected
    const overallHealthy = dbHealth.status === 'healthy' && mongoHealthy;

    res.json({
      status: overallHealthy ? 'healthy' : 'unhealthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      version: 'v2.2-mongo-resilience',
      database: dbHealth,
      mongodb: {
        status: mongoHealthy ? 'healthy' : 'unhealthy',
        readyState: mongoState
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      error: 'Database health check failed'
    });
  }
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/referrals', referralRoutes);
app.use('/instructor', instructorRoutes);
app.use('/admin', adminRoutes);
app.use('/internal', internalRoutes);

app.use(errorHandler);

app.listen(PORT, async () => {
  logger.info(`User Service running on port ${PORT}`);
  
  try {
    // Initialize MongoDB connection for referral system
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://mongodb:27017/cloudmastershub';
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoUrl, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      family: 4,
      authSource: 'admin'
    });
    logger.info('MongoDB connected successfully for referral system', {
      database: mongoose.connection.db?.databaseName,
      host: mongoose.connection.host,
      port: mongoose.connection.port
    });

    // MongoDB connection event handlers for resilience
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected - Mongoose will attempt to reconnect');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });
    
    // Initialize PostgreSQL database connection
    await initializeDatabase();
    logger.info('PostgreSQL database initialized successfully');
    
    // Initialize payment event subscriber
    initializePaymentEventSubscriber();
    logger.info('Payment event subscriber initialized');

    // Initialize user signup publisher (for marketing welcome emails)
    await userSignupPublisher.initialize();
    logger.info('User signup publisher initialized');

    logger.info('User Service fully initialized and ready');
  } catch (error) {
    logger.error('Failed to initialize User Service:', error);
    // Don't exit on initialization errors in mock mode
    logger.warn('Continuing despite initialization errors');
  }
});