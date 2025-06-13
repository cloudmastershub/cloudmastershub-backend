import rateLimit from 'express-rate-limit';

export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 100,
  message: string = 'Too many requests from this IP'
) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          message,
          statusCode: 429,
          retryAfter: req.rateLimit?.resetTime,
        },
      });
    },
  });
};

export const defaultRateLimiter = createRateLimiter();

export const strictRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  5,
  'Too many requests for this resource'
);

export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  'Too many authentication attempts'
);