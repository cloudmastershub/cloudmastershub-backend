import { Schema } from 'mongoose';
import { getTenantId } from '../utils/tenantContext';

/**
 * Mongoose plugin that adds multi-tenancy support to a schema.
 *
 * - Adds a `tenantId` field (required, indexed, defaults from AsyncLocalStorage context)
 * - Automatically injects tenantId filter on all query operations
 * - Automatically sets tenantId on new documents
 * - Prepends $match stage on aggregate pipelines
 */
export function tenantPlugin(schema: Schema): void {
  // 1. Add tenantId field
  schema.add({
    tenantId: {
      type: String,
      required: true,
      default: () => getTenantId(),
      index: true,
    },
  });

  // 2. Pre-save: ensure tenantId is set
  schema.pre('save', function (next) {
    if (!this.tenantId) {
      this.tenantId = getTenantId();
    }
    next();
  });

  // 3. Query middleware: auto-scope all queries by tenantId
  const queryMiddleware = function (this: any, next: Function) {
    const filter = this.getFilter();
    if (!filter.tenantId) {
      this.where({ tenantId: getTenantId() });
    }
    next();
  };

  const queryHooks = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'count',
    'countDocuments',
    'distinct',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'replaceOne',
  ];

  for (const hook of queryHooks) {
    schema.pre(hook as any, queryMiddleware);
  }

  // 4. Aggregate middleware: inject $match at the start of pipeline
  schema.pre('aggregate', function (next) {
    const pipeline = this.pipeline();
    const firstStage = pipeline[0] as Record<string, any> | undefined;
    // Don't add if first stage already filters by tenantId
    if (firstStage?.$match?.tenantId) {
      return next();
    }
    pipeline.unshift({ $match: { tenantId: getTenantId() } });
    next();
  });
}

export default tenantPlugin;
