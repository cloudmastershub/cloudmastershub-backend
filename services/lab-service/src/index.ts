import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import labRoutes from './routes/labRoutes';
import sessionRoutes from './routes/sessionRoutes';
import { errorHandler } from './middleware/errorHandler';
import { initializeLabPaymentEventSubscriber } from './events/paymentEventSubscriber';
import logger from './utils/logger';
import { initializeQueue } from './services/queueService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

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
    console.log(`🌐 LAB-SERVICE CORS: Request from origin: ${origin || 'NO_ORIGIN'}`);
    console.log(`🌐 LAB-SERVICE CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      console.log('🌐 LAB-SERVICE CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log(`🌐 LAB-SERVICE CORS: Allowing request from ${origin}`);
      callback(null, true);
    } else {
      console.warn(`🌐 LAB-SERVICE CORS: BLOCKED request from origin: ${origin}`);
      console.warn(`🌐 LAB-SERVICE CORS: Available origins: ${allowedOrigins.join(', ')}`);
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

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'lab-service', 
    version: 'v1.1-cors-fix',
    corsUpdate: 'Applied dynamic origin validation including cloudmastershub.com',
    timestamp: new Date().toISOString() 
  });
});

app.use('/labs', labRoutes);
app.use('/sessions', sessionRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Lab Service running on port ${PORT}`);
  
  // Initialize queue service after server starts
  try {
    initializeQueue();
    logger.info('Queue service initialized');
  } catch (error) {
    logger.error('Failed to initialize queue service:', error);
  }
  
  // Initialize payment event subscriber
  initializeLabPaymentEventSubscriber();
  logger.info('Lab service payment event subscriber initialized');
});