import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Strict limit for sensitive endpoints
  message: 'Too many requests from this IP for this resource.',
  standardHeaders: true,
  legacyHeaders: false,
});
