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
    console.log('🔐 Auth middleware - JWT_SECRET value:', process.env.JWT_SECRET ? 'custom' : 'using fallback');
    
    try {
      // Log first 50 chars of token for debugging
      console.log('🔐 Auth middleware - Token preview:', token.substring(0, 50) + '...');
    } catch (e) {
      // Ignore
    }
    
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
      type: error instanceof Error ? error.constructor.name : typeof error,
      url: req.originalUrl || req.url,
      method: req.method
    });
    
    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes('jwt expired')) {
        next(new UnauthorizedError('Token has expired'));
      } else if (error.message.includes('invalid signature')) {
        next(new UnauthorizedError('Invalid token signature - JWT secret mismatch'));
      } else if (error.message.includes('jwt malformed')) {
        next(new UnauthorizedError('Malformed token'));
      } else {
        next(new UnauthorizedError(`Invalid token: ${error.message}`));
      }
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
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
