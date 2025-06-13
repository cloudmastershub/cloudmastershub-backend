import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

export const preventXSS = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize common input fields
  ['body', 'query', 'params'].forEach((key) => {
    const data = req[key as keyof Request];
    if (data && typeof data === 'object') {
      Object.keys(data).forEach((field) => {
        if (typeof data[field] === 'string') {
          data[field] = data[field].replace(/[<>]/g, '');
        }
      });
    }
  });
  next();
};
