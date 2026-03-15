import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@elites-systems/auth';
import logger from '../utils/logger';

export const extractUserFromJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';

      try {
        const decoded = verifyToken(token, jwtSecret);

        // Add user context to headers for downstream services
        req.headers['x-user-id'] = decoded.sub;
        req.headers['x-user-email'] = decoded.email;
        req.headers['x-user-roles'] = JSON.stringify(decoded.roles || [decoded.role]);

        logger.debug('JWT extracted user info', {
          userId: decoded.sub,
          email: decoded.email,
          roles: decoded.roles,
        });
      } catch (jwtError) {
        logger.warn('Invalid JWT token, but continuing without user context', {
          error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error'
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Error in JWT extraction middleware:', error);
    next();
  }
};
