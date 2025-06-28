import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { UserRole, AdminPermission } from '@cloudmastershub/types';
import logger from '../utils/logger';

export interface AdminRequest extends Request {
  adminId?: string;
  adminEmail?: string;
  adminRoles?: UserRole[];
  adminPermissions?: AdminPermission[];
}

interface JWTPayload {
  userId: string;
  email: string;
  roles: UserRole[];
  permissions?: AdminPermission[];
}

export const requireAdmin = (req: AdminRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Access token required',
        },
      });
      return;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      logger.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        error: {
          message: 'Server configuration error',
        },
      });
      return;
    }

    const decoded = verify(token, jwtSecret) as JWTPayload;

    // Check if user has admin role
    if (!decoded.roles || !decoded.roles.includes(UserRole.ADMIN)) {
      logger.warn('Non-admin user attempted to access admin endpoint', {
        userId: decoded.userId,
        email: decoded.email,
        roles: decoded.roles,
        endpoint: req.originalUrl,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'Administrator access required',
        },
      });
      return;
    }

    // Attach admin info to request
    req.adminId = decoded.userId;
    req.adminEmail = decoded.email;
    req.adminRoles = decoded.roles;
    req.adminPermissions = decoded.permissions || [];

    logger.info('Admin authenticated', {
      adminId: decoded.userId,
      email: decoded.email,
      endpoint: req.originalUrl,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.error('Admin authentication failed:', error);

    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        error: {
          message: 'Access token expired',
        },
      });
      return;
    }

    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid access token',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Authentication error',
      },
    });
  }
};

export const requirePermission = (permission: AdminPermission) => {
  return (req: AdminRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.adminPermissions) {
        res.status(403).json({
          success: false,
          error: {
            message: 'Permission information not available',
          },
        });
        return;
      }

      // Super admin has all permissions
      if (req.adminPermissions.includes(AdminPermission.SYSTEM_ADMIN)) {
        next();
        return;
      }

      // Check specific permission
      if (!req.adminPermissions.includes(permission)) {
        logger.warn('Admin access denied due to insufficient permissions', {
          adminId: req.adminId,
          email: req.adminEmail,
          requiredPermission: permission,
          userPermissions: req.adminPermissions,
          endpoint: req.originalUrl,
        });

        res.status(403).json({
          success: false,
          error: {
            message: `Permission required: ${permission}`,
          },
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Permission check failed:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Permission validation error',
        },
      });
    }
  };
};

export const logAdminAction = (action: string) => {
  return (req: AdminRequest, res: Response, next: NextFunction): void => {
    // Log the admin action
    logger.info('Admin action initiated', {
      action,
      adminId: req.adminId,
      email: req.adminEmail,
      endpoint: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    // Store original send function
    const originalSend = res.send;

    // Override send to log the result
    res.send = function (body) {
      logger.info('Admin action completed', {
        action,
        adminId: req.adminId,
        statusCode: res.statusCode,
        success: res.statusCode < 400,
        timestamp: new Date().toISOString(),
      });

      // Call original send
      return originalSend.call(this, body);
    };

    next();
  };
};
