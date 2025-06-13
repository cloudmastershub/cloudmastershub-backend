FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared packages
COPY shared ./shared

# Copy service specific files
COPY services/course-service ./services/course-service

# Install dependencies
RUN npm ci --workspace=@cloudmastershub/course-service

# Build shared packages first
RUN npm run build --workspace=@cloudmastershub/types
RUN npm run build --workspace=@cloudmastershub/utils
RUN npm run build --workspace=@cloudmastershub/middleware

# Build the service
RUN npm run build --workspace=@cloudmastershub/course-service

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/course-service/dist ./services/course-service/dist
COPY --from=builder /app/services/course-service/package.json ./services/course-service/

# Copy shared packages
COPY --from=builder /app/shared/types/dist ./shared/types/dist
COPY --from=builder /app/shared/types/package.json ./shared/types/
COPY --from=builder /app/shared/utils/dist ./shared/utils/dist
COPY --from=builder /app/shared/utils/package.json ./shared/utils/
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/shared/middleware/package.json ./shared/middleware/

EXPOSE 3002

CMD ["node", "services/course-service/dist/index.js"]