import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import { errorHandler } from './middleware/errorHandler';
import { initializePaymentEventSubscriber } from './events/paymentEventSubscriber';
import { initializeMockUsers } from './services/userService';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'user-service', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`User Service running on port ${PORT}`);
  
  // Initialize mock users for development
  initializeMockUsers();
  
  // Initialize payment event subscriber
  initializePaymentEventSubscriber();
  logger.info('Payment event subscriber initialized');
});