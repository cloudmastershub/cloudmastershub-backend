import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { extractUserFromJWT } from './middleware/authenticate';
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

// Skip CORS for proxied routes, let backend services handle CORS
const corsMiddleware = cors({
  origin: (origin, callback) => {
    console.log(`🌐 CORS: Request from origin: ${origin || 'NO_ORIGIN'}`);
    console.log(`🌐 CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      console.log('🌐 CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log(`🌐 CORS: Allowing request from ${origin}`);
      callback(null, true);
    } else {
      console.warn(`🌐 CORS: BLOCKED request from origin: ${origin}`);
      console.warn(`🌐 CORS: Available origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
});

// Apply CORS only to non-proxied routes
app.use((req, res, next) => {
  // Skip CORS for proxied routes - let backend services handle CORS
  const proxiedPaths = ['/api/instructor', '/api/courses', '/api/users', '/api/referrals', '/api/auth', '/api/admin', '/api/pages', '/api/marketing'];
  const isProxiedRoute = proxiedPaths.some(path => req.path.startsWith(path));
  
  if (isProxiedRoute) {
    console.log(`🌐 CORS: Skipping gateway CORS for proxied route: ${req.path}`);
    return next();
  }
  
  // Apply CORS for non-proxied routes
  corsMiddleware(req, res, next);
});

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

// Serve static files (course images, etc.)
const publicPath = path.join(__dirname, '../../public');
app.use('/images', express.static(path.join(publicPath, 'images'), {
  maxAge: '7d', // Cache images for 7 days
  setHeaders: (res, filepath) => {
    // Set proper content type for SVG files
    if (filepath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}));

// Apply rate limiter before body parsing
app.use(rateLimiter);

// Extract user information from JWT tokens for backend services
app.use('/api', extractUserFromJWT);

// Apply body parsing only to non-proxy routes (except tracking endpoints which need parsed body)
app.use((req, res, next) => {
  // Parse body for tracking endpoints (they need JSON body forwarded)
  if (req.path.startsWith('/api/marketing/track')) {
    return express.json()(req, res, next);
  }
  // Skip body parsing for other proxy routes
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