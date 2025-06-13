#!/bin/bash

# CloudMastersHub Backend Build Script
# Usage: ./build.sh [image-tag] [push]

set -e

# Default values
IMAGE_TAG=${1:-latest}
PUSH=${2:-false}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."

# Docker configuration
DOCKER_REGISTRY="docker.io"
DOCKER_REPO="mbuaku"
IMAGE_NAME="${DOCKER_REGISTRY}/${DOCKER_REPO}/cloudmastershub-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
        exit 1
    fi
}

# Build function
build_image() {
    log "Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
    log "Build context: ${PROJECT_DIR}"
    
    # Change to project directory
    cd "${PROJECT_DIR}"
    
    # Build the image
    if docker build \
        --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
        --tag "${IMAGE_NAME}:latest" \
        --file Dockerfile \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
        --build-arg VERSION="${IMAGE_TAG}" \
        .; then
        success "Image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}"
    else
        error "Image build failed"
        exit 1
    fi
}

# Push function
push_image() {
    if [ "$PUSH" = "true" ] || [ "$PUSH" = "yes" ] || [ "$PUSH" = "1" ]; then
        log "Pushing image to registry..."
        
        # Check if logged in to Docker registry
        if ! docker info | grep -q "Username"; then
            warning "Not logged in to Docker registry. Attempting to login..."
            if ! docker login "${DOCKER_REGISTRY}"; then
                error "Failed to login to Docker registry"
                exit 1
            fi
        fi
        
        # Push with specific tag
        if docker push "${IMAGE_NAME}:${IMAGE_TAG}"; then
            success "Pushed ${IMAGE_NAME}:${IMAGE_TAG}"
        else
            error "Failed to push ${IMAGE_NAME}:${IMAGE_TAG}"
            exit 1
        fi
        
        # Also push latest if tag is not latest
        if [ "$IMAGE_TAG" != "latest" ]; then
            if docker push "${IMAGE_NAME}:latest"; then
                success "Pushed ${IMAGE_NAME}:latest"
            else
                warning "Failed to push ${IMAGE_NAME}:latest"
            fi
        fi
    else
        log "Skipping push (push=${PUSH})"
        log "To push the image, run: docker push ${IMAGE_NAME}:${IMAGE_TAG}"
    fi
}

# Test function
test_image() {
    log "Testing the built image..."
    
    # Run a simple test container
    log "Starting test container..."
    
    local container_id
    if container_id=$(docker run -d \
        --name "cloudmastershub-test-$$" \
        --env SERVICE_NAME=api-gateway \
        --env PORT=3000 \
        --env NODE_ENV=test \
        "${IMAGE_NAME}:${IMAGE_TAG}"); then
        
        log "Test container started: $container_id"
        
        # Wait a bit for the service to start
        sleep 10
        
        # Check if container is still running
        if docker ps | grep -q "$container_id"; then
            success "Container is running successfully"
            
            # Check if the health endpoint responds (if accessible)
            if docker exec "$container_id" wget --spider --quiet http://localhost:3000/health 2>/dev/null; then
                success "Health check passed"
            else
                warning "Health check failed or not accessible"
            fi
        else
            error "Container stopped unexpectedly"
            docker logs "$container_id"
        fi
        
        # Clean up
        log "Cleaning up test container..."
        docker stop "$container_id" >/dev/null 2>&1 || true
        docker rm "$container_id" >/dev/null 2>&1 || true
        
    else
        error "Failed to start test container"
        exit 1
    fi
}

# Security scan function
security_scan() {
    log "Running security scan with Trivy..."
    
    if ! command -v trivy &> /dev/null; then
        warning "Trivy not installed. Skipping security scan."
        return 0
    fi
    
    # Run Trivy scan
    if trivy image \
        --format table \
        --severity HIGH,CRITICAL \
        "${IMAGE_NAME}:${IMAGE_TAG}"; then
        success "Security scan completed"
    else
        warning "Security scan found issues"
    fi
}

# Image info function
image_info() {
    log "Image information:"
    
    echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
    echo "Size: $(docker images --format "table {{.Size}}" "${IMAGE_NAME}:${IMAGE_TAG}" | tail -n 1)"
    echo "Created: $(docker images --format "table {{.CreatedAt}}" "${IMAGE_NAME}:${IMAGE_TAG}" | tail -n 1)"
    
    log "Image layers:"
    docker history "${IMAGE_NAME}:${IMAGE_TAG}" --no-trunc
}

# Clean up function
cleanup() {
    log "Cleaning up old images..."
    
    # Remove old images (keep last 3 versions)
    docker images "${IMAGE_NAME}" --format "table {{.Tag}}" | \
        grep -v "latest" | \
        grep -v "TAG" | \
        tail -n +4 | \
        xargs -I {} docker rmi "${IMAGE_NAME}:{}" 2>/dev/null || true
    
    # Clean up build cache
    docker builder prune -f
    
    success "Cleanup completed"
}

# Main function
main() {
    log "CloudMastersHub Backend Build Script"
    log "Image tag: ${IMAGE_TAG}"
    log "Push to registry: ${PUSH}"
    
    check_docker
    build_image
    test_image
    
    # Optional security scan
    if [ "${SECURITY_SCAN:-false}" = "true" ]; then
        security_scan
    fi
    
    push_image
    image_info
    
    success "Build process completed successfully!"
    
    echo
    log "Next steps:"
    echo "  - Deploy to dev: ./scripts/deploy.sh dev ${IMAGE_TAG}"
    echo "  - Run locally: docker run -p 3000:3000 -e SERVICE_NAME=api-gateway ${IMAGE_NAME}:${IMAGE_TAG}"
    echo "  - Check logs: docker logs <container-id>"
}

# Handle script arguments
case "${3:-}" in
    "cleanup")
        cleanup
        exit 0
        ;;
    "info")
        image_info
        exit 0
        ;;
    "scan")
        security_scan
        exit 0
        ;;
    "test")
        test_image
        exit 0
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [image-tag] [push] [action]"
        echo
        echo "Arguments:"
        echo "  image-tag    Docker image tag (default: latest)"
        echo "  push         Push to registry: true/false (default: false)"
        echo "  action       Additional action: cleanup, info, scan, test, help"
        echo
        echo "Environment variables:"
        echo "  SECURITY_SCAN=true    Enable security scanning with Trivy"
        echo
        echo "Examples:"
        echo "  $0                           # Build with latest tag, don't push"
        echo "  $0 v1.2.3 true             # Build v1.2.3 and push to registry"
        echo "  $0 latest false cleanup     # Build and then cleanup old images"
        echo "  SECURITY_SCAN=true $0       # Build with security scan"
        exit 0
        ;;
esac

# Run main function
main