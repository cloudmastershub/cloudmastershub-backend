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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'lab-service', timestamp: new Date().toISOString() });
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