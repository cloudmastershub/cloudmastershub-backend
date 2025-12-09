#!/bin/sh

# CloudMastersHub Backend Startup Script
# This script starts the appropriate service based on SERVICE_NAME environment variable

set -e

# Default to api-gateway if SERVICE_NAME is not set
SERVICE_NAME=${SERVICE_NAME:-api-gateway}

# Log startup information
echo "Starting CloudMastersHub service: $SERVICE_NAME"
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: ${NODE_ENV:-development}"
echo "Port: ${PORT:-3000}"

# Validate service name
case "$SERVICE_NAME" in
  "api-gateway"|"user-service"|"course-service"|"lab-service"|"admin-service"|"payment-service"|"marketing-service")
    echo "Valid service name: $SERVICE_NAME"
    ;;
  *)
    echo "Error: Invalid service name '$SERVICE_NAME'"
    echo "Valid options: api-gateway, user-service, course-service, lab-service, admin-service, payment-service, marketing-service"
    exit 1
    ;;
esac

# Wait for dependencies (if needed)
if [ "$SERVICE_NAME" != "api-gateway" ]; then
  echo "Waiting for dependencies to be ready..."
  
  # Give databases a moment to be ready, then start the service
  # The application itself will handle connection retries
  echo "Giving databases time to initialize..."
  sleep 10
  
  echo "Starting service (databases should be ready now)..."
fi

# Set the correct port for each service if not already set
case "$SERVICE_NAME" in
  "api-gateway")
    export PORT=${PORT:-3000}
    ;;
  "user-service")
    export PORT=${PORT:-3001}
    ;;
  "course-service")
    export PORT=${PORT:-3002}
    ;;
  "lab-service")
    export PORT=${PORT:-3003}
    ;;
  "payment-service")
    export PORT=${PORT:-3004}
    ;;
  "admin-service")
    export PORT=${PORT:-3005}
    ;;
  "marketing-service")
    export PORT=${PORT:-3006}
    ;;
esac

# Start the service
echo "Starting $SERVICE_NAME on port $PORT..."
cd "/app/services/$SERVICE_NAME"

# Execute the service
exec node "dist/index.js"