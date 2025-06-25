import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for proper X-Forwarded-For header handling
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true,
}));

// Health check endpoint (exclude from rate limiting)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// Apply rate limiter before body parsing
app.use(rateLimiter);

// Apply body parsing only to non-proxy routes
app.use((req, res, next) => {
  // Skip body parsing for proxy routes
  if (req.path.startsWith('/api/')) {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use((req, res, next) => {
  // Skip body parsing for proxy routes
  if (req.path.startsWith('/api/')) {
    next();
  } else {
    express.urlencoded({ extended: true })(req, res, next);
  }
});

app.use('/api', routes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});