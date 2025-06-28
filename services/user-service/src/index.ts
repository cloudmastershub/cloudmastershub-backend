import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import { errorHandler } from './middleware/errorHandler';
import { initializePaymentEventSubscriber } from './events/paymentEventSubscriber';
import { initializeDatabase, getDatabaseHealth } from './services/userService';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (req, res) => {
  try {
    const dbHealth = await getDatabaseHealth();
    res.json({ 
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      service: 'user-service', 
      timestamp: new Date().toISOString(),
      database: dbHealth
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

app.use(errorHandler);

app.listen(PORT, async () => {
  logger.info(`User Service running on port ${PORT}`);
  
  try {
    // TEMPORARY: Skip database initialization until connectivity is fixed
    logger.warn('Database initialization skipped - using mock data with hardcoded admin user');
    
    // Initialize payment event subscriber
    initializePaymentEventSubscriber();
    logger.info('Payment event subscriber initialized');
    
    logger.info('User Service fully initialized and ready (mock mode)');
  } catch (error) {
    logger.error('Failed to initialize User Service:', error);
    // Don't exit on initialization errors in mock mode
    logger.warn('Continuing in mock mode despite initialization errors');
  }
});