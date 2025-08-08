import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
  subscriptionTier?: string;
  [key: string]: any;
}

export const extractUserFromJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';
      
      try {
        const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
        
        // Add user ID to headers for backend services
        req.headers['x-user-id'] = decoded.userId || decoded.email;
        req.headers['x-user-email'] = decoded.email;
        req.headers['x-user-roles'] = JSON.stringify(decoded.roles || ['student']);
        req.headers['x-subscription-tier'] = decoded.subscriptionTier || 'free';
        
        logger.debug('JWT extracted user info', {
          userId: decoded.userId,
          email: decoded.email,
          roles: decoded.roles,
          subscriptionTier: decoded.subscriptionTier
        });
      } catch (jwtError) {
        logger.warn('Invalid JWT token, but continuing without user context', {
          error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error'
        });
        // Don't block the request, just continue without user context
        // Some endpoints might be public or handle authentication themselves
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error in JWT extraction middleware:', error);
    next(); // Continue without blocking
  }
};