FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared packages
COPY shared ./shared

# Copy service specific files
COPY services/lab-service ./services/lab-service

# Install dependencies
RUN npm ci --workspace=@cloudmastershub/lab-service

# Build shared packages first
RUN npm run build --workspace=@cloudmastershub/types
RUN npm run build --workspace=@cloudmastershub/utils
RUN npm run build --workspace=@cloudmastershub/middleware

# Build the service
RUN npm run build --workspace=@cloudmastershub/lab-service

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/lab-service/dist ./services/lab-service/dist
COPY --from=builder /app/services/lab-service/package.json ./services/lab-service/

# Copy shared packages
COPY --from=builder /app/shared/types/dist ./shared/types/dist
COPY --from=builder /app/shared/types/package.json ./shared/types/
COPY --from=builder /app/shared/utils/dist ./shared/utils/dist
COPY --from=builder /app/shared/utils/package.json ./shared/utils/
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/shared/middleware/package.json ./shared/middleware/

EXPOSE 3003

CMD ["node", "services/lab-service/dist/index.js"]