import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { ApiError } from './errorHandler';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userRoles?: string[];
      isAdmin?: boolean;
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  roles: string[];
  subscriptionTier?: string;
  iat: number;
  exp: number;
}

/**
 * Extract and verify JWT token from Authorization header
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';

    const decoded = jwt.verify(token, secret) as JWTPayload;

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRoles = decoded.roles || [];
    req.isAdmin = decoded.roles?.includes('admin') || false;

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      next(ApiError.unauthorized('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(ApiError.unauthorized('Token expired'));
    } else {
      next(error);
    }
  }
};

/**
 * Require admin role
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.isAdmin) {
    next(ApiError.forbidden('Admin access required'));
    return;
  }
  next();
};

/**
 * Optional authentication - doesn't fail if no token, just doesn't set user info
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';

    const decoded = jwt.verify(token, secret) as JWTPayload;

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRoles = decoded.roles || [];
    req.isAdmin = decoded.roles?.includes('admin') || false;

    next();
  } catch (error) {
    // Silently continue without auth for optional routes
    logger.debug('Optional auth failed, continuing without user context');
    next();
  }
};

/**
 * Log admin actions for audit trail
 */
export const logAdminAction = (actionName: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    logger.info(`Admin action: ${actionName}`, {
      adminId: req.userId,
      adminEmail: req.userEmail,
      action: actionName,
      path: req.path,
      method: req.method,
      body: req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
    });
    next();
  };
};

export default { authenticate, requireAdmin, optionalAuth, logAdminAction };
