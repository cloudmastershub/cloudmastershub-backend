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

// Health check endpoint (exclude from rate limiting)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'api-gateway', 
    timestamp: new Date().toISOString(),
    version: 'v2.0-cors-fix',
    corsUpdate: 'Applied dynamic origin validation'
  });
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