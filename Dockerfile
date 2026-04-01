# Multi-stage Dockerfile for CloudMastersHub Backend
# Optimised: deps cached separately from source, single npm ci via prune

# ── Stage 1: builder (all deps + compile) ────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy ONLY package manifests first — this layer is cached as long as
# no package.json or lockfile changes, even when source code changes.
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.base.json ./
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/
COPY shared/middleware/package.json ./shared/middleware/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/user-service/package.json ./services/user-service/
COPY services/course-service/package.json ./services/course-service/
COPY services/lab-service/package.json ./services/lab-service/
COPY services/admin-service/package.json ./services/admin-service/
COPY services/payment-service/package.json ./services/payment-service/
COPY services/community-service/package.json ./services/community-service/

ARG GITHUB_TOKEN

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN echo "@elites-systems:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc && \
    npm ci && \
    rm -f .npmrc

# NOW copy source code — cache above survives code-only changes
COPY shared ./shared
COPY services ./services

# Build shared packages then services
RUN npm run build --workspace=@cloudmastershub/types && \
    npm run build --workspace=@cloudmastershub/utils && \
    npm run build --workspace=@cloudmastershub/middleware && \
    npm run build --workspace=@cloudmastershub/api-gateway && \
    npm run build --workspace=@cloudmastershub/user-service && \
    npm run build --workspace=@cloudmastershub/course-service && \
    npm run build --workspace=@cloudmastershub/lab-service && \
    npm run build --workspace=@cloudmastershub/admin-service && \
    npm run build --workspace=@cloudmastershub/payment-service && \
    npm run build --workspace=@cloudmastershub/community-service

# Prune devDependencies in-place — avoids a second npm ci in production stage
RUN npm prune --omit=dev

# ── Stage 2: production (minimal runtime image) ─────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package manifests (needed for workspace resolution at runtime)
COPY package.json ./
COPY shared/types/package.json ./shared/types/
COPY shared/utils/package.json ./shared/utils/
COPY shared/middleware/package.json ./shared/middleware/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/user-service/package.json ./services/user-service/
COPY services/course-service/package.json ./services/course-service/
COPY services/lab-service/package.json ./services/lab-service/
COPY services/admin-service/package.json ./services/admin-service/
COPY services/payment-service/package.json ./services/payment-service/
COPY services/community-service/package.json ./services/community-service/

# Copy pruned production node_modules from builder (no second npm ci)
COPY --from=builder /app/node_modules ./node_modules

# Copy built dist artifacts
COPY --from=builder /app/shared/types/dist ./shared/types/dist
COPY --from=builder /app/shared/utils/dist ./shared/utils/dist
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist
COPY --from=builder /app/services/course-service/dist ./services/course-service/dist
COPY --from=builder /app/services/lab-service/dist ./services/lab-service/dist
COPY --from=builder /app/services/admin-service/dist ./services/admin-service/dist
COPY --from=builder /app/services/payment-service/dist ./services/payment-service/dist
COPY --from=builder /app/services/community-service/dist ./services/community-service/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cloudmasters -u 1001

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /tmp && \
    chown -R cloudmasters:nodejs /app /tmp

# Copy startup script
COPY --chown=cloudmasters:nodejs scripts/start.sh /app/start.sh
RUN chmod +x /app/start.sh

USER cloudmasters

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Default to API Gateway, but can be overridden
ENV SERVICE_NAME=api-gateway
ENV PORT=3000

EXPOSE ${PORT}

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]
