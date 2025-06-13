import { Request, Response, NextFunction } from 'express';
import { verifyToken, UnauthorizedError } from '@cloudmastershub/utils';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const decoded = verifyToken(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRoles = decoded.roles;

    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRoles || !req.userRoles.some(role => roles.includes(role))) {
      next(new UnauthorizedError('Insufficient permissions'));
      return;
    }
    next();
  };
};