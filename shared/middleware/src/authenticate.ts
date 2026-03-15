import { Request, Response, NextFunction } from 'express';
import { verifyToken, type VerifiedToken } from '@elites-systems/auth';
import { UnauthorizedError } from '@cloudmastershub/utils';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
}

const JWT_SECRET = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    let decoded: VerifiedToken;
    try {
      decoded = verifyToken(token, JWT_SECRET);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('jwt expired')) {
          throw new UnauthorizedError('Token has expired');
        } else if (error.message.includes('invalid signature')) {
          throw new UnauthorizedError('Invalid token signature - JWT secret mismatch');
        } else if (error.message.includes('jwt malformed')) {
          throw new UnauthorizedError('Malformed token');
        }
        throw new UnauthorizedError(`Invalid token: ${error.message}`);
      }
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Map standard claims to CMH request properties
    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    req.userRoles = decoded.roles || [decoded.role];

    // Set req.user to the full VerifiedToken (from library's Express augmentation)
    req.user = decoded;

    next();
  } catch (error) {
    next(error);
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
