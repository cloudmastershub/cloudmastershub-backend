# Multi-stage Dockerfile for CloudMastersHub Backend
# This builds all microservices in a single image for production

FROM node:20-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./

# Copy all source code
COPY shared ./shared
COPY services ./services

FROM base AS builder

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Build shared packages first
RUN npm run build --workspace=@cloudmastershub/types
RUN npm run build --workspace=@cloudmastershub/utils
RUN npm run build --workspace=@cloudmastershub/middleware

# Build all services
RUN npm run build --workspace=@cloudmastershub/api-gateway
RUN npm run build --workspace=@cloudmastershub/user-service
RUN npm run build --workspace=@cloudmastershub/course-service
RUN npm run build --workspace=@cloudmastershub/lab-service
RUN npm run build --workspace=@cloudmastershub/admin-service
RUN npm run build --workspace=@cloudmastershub/payment-service
RUN npm run build --workspace=@cloudmastershub/marketing-service

FROM base AS production

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/shared/types/dist ./shared/types/dist
COPY --from=builder /app/shared/types/package.json ./shared/types/
COPY --from=builder /app/shared/utils/dist ./shared/utils/dist
COPY --from=builder /app/shared/utils/package.json ./shared/utils/
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/shared/middleware/package.json ./shared/middleware/

COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist
COPY --from=builder /app/services/user-service/package.json ./services/user-service/
COPY --from=builder /app/services/course-service/dist ./services/course-service/dist
COPY --from=builder /app/services/course-service/package.json ./services/course-service/
COPY --from=builder /app/services/lab-service/dist ./services/lab-service/dist
COPY --from=builder /app/services/lab-service/package.json ./services/lab-service/
COPY --from=builder /app/services/admin-service/dist ./services/admin-service/dist
COPY --from=builder /app/services/admin-service/package.json ./services/admin-service/
COPY --from=builder /app/services/payment-service/dist ./services/payment-service/dist
COPY --from=builder /app/services/payment-service/package.json ./services/payment-service/
COPY --from=builder /app/services/marketing-service/dist ./services/marketing-service/dist
COPY --from=builder /app/services/marketing-service/package.json ./services/marketing-service/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cloudmasters -u 1001

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /tmp && \
    chown -R cloudmasters:nodejs /app /tmp

USER cloudmasters

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Default to API Gateway, but can be overridden
ENV SERVICE_NAME=api-gateway
ENV PORT=3000

# Copy startup script
COPY --chown=cloudmasters:nodejs scripts/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE ${PORT}

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]