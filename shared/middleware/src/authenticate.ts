import { Request, Response, NextFunction } from 'express';
import { verifyToken, UnauthorizedError } from '@cloudmastershub/utils';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Debug logging for authentication flow
    console.log('🔐 Auth middleware - Request URL:', req.originalUrl || req.url);
    console.log('🔐 Auth middleware - Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
    
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('🔐 Auth middleware - No token found in Authorization header');
      throw new UnauthorizedError('Authentication required');
    }

    console.log('🔐 Auth middleware - Token found, length:', token.length);
    console.log('🔐 Auth middleware - JWT_SECRET configured:', !!process.env.JWT_SECRET);
    
    const decoded = verifyToken(token, process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key');
    
    console.log('🔐 Auth middleware - Token verified successfully:', {
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
      hasSubscriptionTier: !!(decoded as any).subscriptionTier
    });
    
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRoles = decoded.roles;
    
    // Also populate the user object for consistency with types
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || []
    };

    next();
  } catch (error) {
    console.error('🔐 Auth middleware - Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRoles || !req.userRoles.some((role) => roles.includes(role))) {
      next(new UnauthorizedError('Insufficient permissions'));
      return;
    }
    next();
  };
};

// Alias for backward compatibility
export const authenticateToken = authenticate;
