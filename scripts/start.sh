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
  "api-gateway"|"user-service"|"course-service"|"lab-service")
    echo "Valid service name: $SERVICE_NAME"
    ;;
  *)
    echo "Error: Invalid service name '$SERVICE_NAME'"
    echo "Valid options: api-gateway, user-service, course-service, lab-service"
    exit 1
    ;;
esac

# Wait for dependencies (if needed)
if [ "$SERVICE_NAME" != "api-gateway" ]; then
  echo "Waiting for dependencies to be ready..."
  
  # Function to test connectivity without netcat
  test_connection() {
    host=$1
    port=$2
    timeout 5 sh -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null
  }
  
  # Wait for database connections with timeout
  case "$SERVICE_NAME" in
    "user-service")
      # Wait for PostgreSQL (if DATABASE_URL is set)
      if [ -n "$DATABASE_URL" ]; then
        echo "Waiting for PostgreSQL..."
        timeout=60
        while [ $timeout -gt 0 ]; do
          if test_connection postgres.cloudmastershub-dev.svc.cluster.local 5432 || test_connection postgres 5432; then
            echo "PostgreSQL is up!"
            break
          fi
          echo "PostgreSQL is unavailable - waiting... ($timeout seconds left)"
          sleep 2
          timeout=$((timeout - 2))
        done
        if [ $timeout -le 0 ]; then
          echo "Warning: PostgreSQL connection timeout, starting anyway..."
        fi
      fi
      ;;
    "course-service")
      # Wait for MongoDB
      if [ -n "$MONGODB_URI" ]; then
        echo "Waiting for MongoDB..."
        timeout=60
        while [ $timeout -gt 0 ]; do
          if test_connection mongodb.cloudmastershub-dev.svc.cluster.local 27017 || test_connection mongodb 27017; then
            echo "MongoDB is up!"
            break
          fi
          echo "MongoDB is unavailable - waiting... ($timeout seconds left)"
          sleep 2
          timeout=$((timeout - 2))
        done
        if [ $timeout -le 0 ]; then
          echo "Warning: MongoDB connection timeout, starting anyway..."
        fi
      fi
      ;;
    "lab-service")
      # Wait for Redis
      if [ -n "$REDIS_HOST" ]; then
        echo "Waiting for Redis..."
        timeout=60
        while [ $timeout -gt 0 ]; do
          if test_connection "${REDIS_HOST:-redis.cloudmastershub-dev.svc.cluster.local}" "${REDIS_PORT:-6379}" || test_connection "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}"; then
            echo "Redis is up!"
            break
          fi
          echo "Redis is unavailable - waiting... ($timeout seconds left)"
          sleep 2
          timeout=$((timeout - 2))
        done
        if [ $timeout -le 0 ]; then
          echo "Warning: Redis connection timeout, starting anyway..."
        fi
      fi
      ;;
  esac
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
esac

# Start the service
echo "Starting $SERVICE_NAME on port $PORT..."
cd "/app/services/$SERVICE_NAME"

# Execute the service
exec node "dist/index.js"