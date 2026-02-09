import { Request, Response, NextFunction } from 'express';
import { runWithTenant, DEFAULT_TENANT } from '../utils/tenantContext';
import logger from '../utils/logger';

/**
 * Tenant resolver middleware.
 *
 * Extracts tenantId from (in priority order):
 * 1. X-Tenant-Id header (set by gateway or internal calls)
 * 2. req.tenantId (set by auth middleware from JWT claims, future)
 * 3. Default tenant 'cloudmastershub'
 *
 * Wraps the remaining middleware chain in AsyncLocalStorage
 * so all downstream code (including Mongoose queries via the
 * tenant plugin) can access the tenantId via getTenantId().
 */
export const tenantResolver = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const headerTenant = req.headers['x-tenant-id'] as string | undefined;
  const tenantId = headerTenant || req.tenantId || DEFAULT_TENANT;

  req.tenantId = tenantId;

  logger.debug('Tenant resolved', {
    tenantId,
    source: headerTenant ? 'header' : 'default',
    path: req.path,
  });

  runWithTenant(tenantId, () => {
    next();
  });
};

export default tenantResolver;
