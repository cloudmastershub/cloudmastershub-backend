import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import labRoutes from './routes/labRoutes';
import sessionRoutes from './routes/sessionRoutes';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import { initializeQueue } from './services/queueService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize queue service
initializeQueue();

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'lab-service', timestamp: new Date().toISOString() });
});

app.use('/labs', labRoutes);
app.use('/sessions', sessionRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Lab Service running on port ${PORT}`);
});