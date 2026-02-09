import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  tenantId: string;
}

const tenantStorage = new AsyncLocalStorage<TenantStore>();

export const DEFAULT_TENANT = 'cloudmastershub';

/**
 * Get the current tenant ID from AsyncLocalStorage context.
 * Falls back to DEFAULT_TENANT if no context is set.
 */
export function getTenantId(): string {
  const store = tenantStorage.getStore();
  return store?.tenantId || DEFAULT_TENANT;
}

/**
 * Run a function within a tenant context.
 * All Mongoose queries within the callback will be automatically
 * scoped to the given tenantId via the tenant plugin.
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run({ tenantId }, fn);
}

export default tenantStorage;
