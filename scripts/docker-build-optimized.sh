#!/bin/bash
# Optimized Docker build script with resilience

set -e

# Variables
IMAGE_NAME="${IMAGE_NAME:-mbuaku/cloudmastershub-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILD_VERSION="${BUILD_VERSION:-dev}"

echo "🚀 Starting optimized Docker build..."
echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"

# Enable BuildKit
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# Clean up any interrupted builds
echo "🧹 Cleaning up any interrupted builds..."
docker builder prune -f || true

# Build with retry logic
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "🏗️ Building Docker image (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)..."
    
    if docker build \
        --progress=plain \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from ${IMAGE_NAME}:latest \
        --cache-from ${IMAGE_NAME}:cache \
        -t ${IMAGE_NAME}:${IMAGE_TAG} \
        -t ${IMAGE_NAME}:${BUILD_VERSION} \
        . ; then
        echo "✅ Docker build successful!"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⚠️ Build failed, retrying in 10 seconds..."
            sleep 10
        else
            echo "❌ Docker build failed after $MAX_RETRIES attempts!"
            exit 1
        fi
    fi
done

# Create cache image for future builds
echo "📦 Creating cache image..."
docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:cache || true

echo "✅ Docker build completed successfully!"
echo "Images created:"
echo "  - ${IMAGE_NAME}:${IMAGE_TAG}"
echo "  - ${IMAGE_NAME}:${BUILD_VERSION}"
echo "  - ${IMAGE_NAME}:cache"