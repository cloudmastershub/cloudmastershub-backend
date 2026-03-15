import { Request, Response, NextFunction } from 'express';
import { verifyToken, type VerifiedToken } from '@elites-systems/auth';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
}

const JWT_SECRET = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required' },
    });
    return;
  }

  try {
    const decoded: VerifiedToken = verifyToken(token, JWT_SECRET);

    // Map standard claims to CMH request properties
    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    req.userRoles = decoded.roles || [decoded.role];

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
};
