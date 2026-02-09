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
      authMethod?: 'jwt' | 'gateway-headers';
      tenantId?: string;
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
 * Try to authenticate via gateway-forwarded X-User-* headers.
 * Returns true if headers were present and user context was set.
 */
function tryGatewayHeaders(req: Request): boolean {
  const userId = req.headers['x-user-id'] as string | undefined;
  const email = req.headers['x-user-email'] as string | undefined;
  const rolesRaw = req.headers['x-user-roles'] as string | undefined;

  if (!userId || !email) return false;

  let roles: string[] = [];
  if (rolesRaw) {
    try {
      roles = JSON.parse(rolesRaw);
    } catch {
      roles = [rolesRaw];
    }
  }

  req.userId = userId;
  req.userEmail = email;
  req.userRoles = roles;
  req.isAdmin = roles.includes('admin');
  req.authMethod = 'gateway-headers';
  return true;
}

/**
 * Extract and verify JWT token from Authorization header.
 * Falls back to gateway-forwarded X-User-* headers if the
 * Bearer token is missing or malformed (belt-and-suspenders
 * approach for http-proxy-middleware header forwarding issues).
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const requestId = req.headers['x-request-id'] || 'unknown';

    // --- Path 1: JWT Bearer token (preferred) ---
    if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 7) {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';

      const decoded = jwt.verify(token, secret) as JWTPayload;

      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      req.userRoles = decoded.roles || [];
      req.isAdmin = decoded.roles?.includes('admin') || false;
      req.authMethod = 'jwt';

      logger.debug('Authenticated via JWT', {
        requestId,
        path: req.path,
        userId: decoded.userId,
      });

      return next();
    }

    // --- Path 2: Gateway-forwarded X-User-* headers (fallback) ---
    if (tryGatewayHeaders(req)) {
      logger.debug('Authenticated via gateway headers', {
        requestId,
        path: req.path,
        userId: req.userId,
      });
      return next();
    }

    // --- Neither path succeeded ---
    logger.warn('Auth failed: no valid credentials', {
      requestId,
      path: req.path,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length,
      hasGatewayHeaders: !!req.headers['x-user-id'],
      ip: req.ip,
      headers: Object.keys(req.headers),
    });
    throw ApiError.unauthorized('No token provided');

  } catch (error: any) {
    if (error.statusCode) {
      return next(error); // already an ApiError
    }

    const requestId = req.headers['x-request-id'] || 'unknown';
    logger.warn('Auth verification failed', {
      requestId,
      path: req.path,
      method: req.method,
      errorName: error.name,
      errorMessage: error.message,
      ip: req.ip,
    });

    if (error.name === 'JsonWebTokenError') {
      next(ApiError.unauthorized('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(ApiError.unauthorized('Token expired'));
    } else {
      next(ApiError.unauthorized('Authentication failed'));
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
    logger.warn('Admin access denied', {
      requestId: req.headers['x-request-id'] || 'unknown',
      path: req.path,
      userId: req.userId,
      roles: req.userRoles,
    });
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

    if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 7) {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';
      const decoded = jwt.verify(token, secret) as JWTPayload;

      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      req.userRoles = decoded.roles || [];
      req.isAdmin = decoded.roles?.includes('admin') || false;
      req.authMethod = 'jwt';
      return next();
    }

    // Try gateway headers as fallback
    tryGatewayHeaders(req);
    next();
  } catch (error) {
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
      requestId: req.headers['x-request-id'] || 'unknown',
      adminId: req.userId,
      adminEmail: req.userEmail,
      authMethod: req.authMethod,
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
