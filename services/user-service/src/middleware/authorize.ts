import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../shared/middleware/errorHandler';
import { UserRole } from '../../../shared/types';

interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

/**
 * Authorization middleware to check user roles
 * @param allowedRoles - Array of roles that are allowed to access the route
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRoles || req.userRoles.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. No roles found.'
      });
    }

    const hasRole = req.userRoles.some(role => 
      allowedRoles.includes(role as UserRole)
    );

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};