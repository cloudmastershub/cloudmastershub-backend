FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared packages
COPY shared ./shared

# Copy service specific files
COPY services/api-gateway ./services/api-gateway

# Install dependencies
RUN npm ci --workspace=@cloudmastershub/api-gateway

# Build shared packages first
RUN npm run build --workspace=@cloudmastershub/types
RUN npm run build --workspace=@cloudmastershub/utils
RUN npm run build --workspace=@cloudmastershub/middleware

# Build the service
RUN npm run build --workspace=@cloudmastershub/api-gateway

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/

# Copy shared packages
COPY --from=builder /app/shared/types/dist ./shared/types/dist
COPY --from=builder /app/shared/types/package.json ./shared/types/
COPY --from=builder /app/shared/utils/dist ./shared/utils/dist
COPY --from=builder /app/shared/utils/package.json ./shared/utils/
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/shared/middleware/package.json ./shared/middleware/

EXPOSE 3000

CMD ["node", "services/api-gateway/dist/index.js"]