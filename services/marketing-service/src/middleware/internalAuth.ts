import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ApiError } from './errorHandler';

const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || '';

/**
 * Authenticate internal service-to-service calls.
 *
 * Validates the X-Internal-Token header against INTERNAL_SERVICE_SECRET.
 * When INTERNAL_SERVICE_SECRET is not configured, falls back to
 * checking that the request originates from a cluster-internal IP
 * (10.x.x.x or 192.168.x.x) so that /internal/* routes are never
 * accessible from the public internet.
 */
export const internalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] || 'unknown';
  const callerService = req.headers['x-service-name'] as string || 'unknown';
  const callerIp = req.ip || req.socket.remoteAddress || '';

  // Path 1: Token-based auth (preferred)
  if (INTERNAL_SERVICE_SECRET) {
    const token = req.headers['x-internal-token'] as string;

    if (token === INTERNAL_SERVICE_SECRET) {
      logger.debug('Internal auth: token validated', {
        requestId,
        path: req.path,
        callerService,
        callerIp,
      });
      return next();
    }

    logger.warn('Internal auth failed: invalid or missing token', {
      requestId,
      path: req.path,
      callerService,
      callerIp,
      hasToken: !!token,
    });

    next(ApiError.forbidden('Invalid internal service token'));
    return;
  }

  // Path 2: IP-based restriction (fallback when no secret configured)
  const cleanIp = callerIp.replace('::ffff:', '');
  const isClusterInternal = cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.') || cleanIp === '127.0.0.1' || cleanIp === '::1';

  if (isClusterInternal) {
    logger.debug('Internal auth: cluster IP allowed', {
      requestId,
      path: req.path,
      callerService,
      callerIp: cleanIp,
    });
    return next();
  }

  logger.warn('Internal auth failed: external IP without token', {
    requestId,
    path: req.path,
    callerService,
    callerIp: cleanIp,
  });

  next(ApiError.forbidden('Internal endpoints are not accessible externally'));
};

export default internalAuth;
