#!/bin/bash

# CloudMastersHub Backend Deployment Script
# Usage: ./deploy.sh [environment] [image-tag]

set -e

# Default values
ENVIRONMENT=${1:-dev}
IMAGE_TAG=${2:-latest}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="${SCRIPT_DIR}/../k8s"

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

# Validate environment
case "$ENVIRONMENT" in
    "dev"|"staging"|"prod")
        log "Deploying to environment: $ENVIRONMENT"
        ;;
    *)
        error "Invalid environment: $ENVIRONMENT"
        echo "Valid environments: dev, staging, prod"
        exit 1
        ;;
esac

# Set namespace based on environment
case "$ENVIRONMENT" in
    "dev")
        NAMESPACE="cloudmastershub-dev"
        ;;
    "staging")
        NAMESPACE="cloudmastershub-staging"
        ;;
    "prod")
        NAMESPACE="cloudmastershub-prod"
        ;;
esac

log "Namespace: $NAMESPACE"
log "Image tag: $IMAGE_TAG"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    error "Cannot connect to Kubernetes cluster"
    exit 1
fi

# Function to wait for deployment rollout
wait_for_rollout() {
    local deployment=$1
    local timeout=${2:-300}
    
    log "Waiting for deployment $deployment to complete..."
    if kubectl rollout status deployment/$deployment -n $NAMESPACE --timeout=${timeout}s; then
        success "Deployment $deployment completed successfully"
    else
        error "Deployment $deployment failed or timed out"
        return 1
    fi
}

# Function to check pod health
check_pod_health() {
    local app_label=$1
    
    log "Checking pod health for app=$app_label..."
    
    # Wait a bit for pods to start
    sleep 10
    
    local ready_pods=$(kubectl get pods -n $NAMESPACE -l app=cloudmastershub,service=$app_label --field-selector=status.phase=Running -o jsonpath='{.items[*].status.containerStatuses[0].ready}' | grep -o true | wc -l)
    local total_pods=$(kubectl get pods -n $NAMESPACE -l app=cloudmastershub,service=$app_label --field-selector=status.phase=Running -o jsonpath='{.items[*].metadata.name}' | wc -w)
    
    if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
        success "All $total_pods pods for $app_label are ready"
        return 0
    else
        warning "$ready_pods out of $total_pods pods are ready for $app_label"
        return 1
    fi
}

# Main deployment function
deploy() {
    log "Starting deployment process..."
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log "Creating namespace $NAMESPACE..."
        kubectl create namespace $NAMESPACE
    fi
    
    # Apply ConfigMaps and Secrets first
    log "Applying configuration files..."
    kubectl apply -f $K8S_DIR/config.yaml -n $NAMESPACE
    
    # Apply database deployments
    log "Applying database deployments..."
    kubectl apply -f $K8S_DIR/database.yaml
    
    # Wait for databases to be ready
    log "Waiting for databases to be ready..."
    wait_for_rollout "mongodb" 180
    wait_for_rollout "redis" 180
    
    # Update image tags in microservices deployment
    log "Updating image tags to $IMAGE_TAG..."
    
    # Create a temporary file with updated image tags
    TEMP_DEPLOYMENT=$(mktemp)
    sed "s|image: cloudmastershub/backend:latest|image: cloudmastershub/backend:$IMAGE_TAG|g" $K8S_DIR/microservices-deployment.yaml > $TEMP_DEPLOYMENT
    
    # Apply microservices deployments
    log "Applying microservices deployments..."
    kubectl apply -f $TEMP_DEPLOYMENT
    
    # Clean up temporary file
    rm $TEMP_DEPLOYMENT
    
    # Apply HPA configurations
    log "Applying HPA configurations..."
    kubectl apply -f $K8S_DIR/hpa.yaml
    
    # Wait for all deployments to complete
    log "Waiting for all deployments to complete..."
    
    declare -a services=("api-gateway" "user-service" "course-service" "lab-service")
    
    for service in "${services[@]}"; do
        wait_for_rollout "cloudmastershub-$service" 300
    done
    
    # Check pod health
    log "Checking pod health..."
    local all_healthy=true
    
    for service in "${services[@]}"; do
        if ! check_pod_health "$service"; then
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        success "All services are healthy!"
    else
        warning "Some services may not be fully healthy. Check pod status."
    fi
    
    # Display deployment status
    log "Deployment status:"
    kubectl get deployments -n $NAMESPACE -l app=cloudmastershub
    
    log "Service endpoints:"
    kubectl get services -n $NAMESPACE -l app=cloudmastershub
    
    success "Deployment to $ENVIRONMENT completed!"
}

# Function to rollback deployment
rollback() {
    local deployment=$1
    
    log "Rolling back deployment: $deployment"
    kubectl rollout undo deployment/$deployment -n $NAMESPACE
    wait_for_rollout $deployment
}

# Function to get deployment status
status() {
    log "Getting deployment status for environment: $ENVIRONMENT"
    
    echo
    log "Deployments:"
    kubectl get deployments -n $NAMESPACE -l app=cloudmastershub -o wide
    
    echo
    log "Services:"
    kubectl get services -n $NAMESPACE -l app=cloudmastershub
    
    echo
    log "Pods:"
    kubectl get pods -n $NAMESPACE -l app=cloudmastershub
    
    echo
    log "HPA Status:"
    kubectl get hpa -n $NAMESPACE -l app=cloudmastershub
}

# Function to get logs
logs() {
    local service=${1:-api-gateway}
    local lines=${2:-100}
    
    log "Getting logs for service: $service"
    kubectl logs -n $NAMESPACE -l app=cloudmastershub,service=$service --tail=$lines -f
}

# Main script logic
case "${3:-deploy}" in
    "deploy")
        deploy
        ;;
    "rollback")
        if [ -z "$4" ]; then
            error "Please specify deployment name for rollback"
            echo "Usage: $0 $ENVIRONMENT $IMAGE_TAG rollback <deployment-name>"
            exit 1
        fi
        rollback "$4"
        ;;
    "status")
        status
        ;;
    "logs")
        logs "$4" "$5"
        ;;
    *)
        echo "Usage: $0 [environment] [image-tag] [action] [options]"
        echo
        echo "Arguments:"
        echo "  environment    dev, staging, or prod (default: dev)"
        echo "  image-tag      Docker image tag (default: latest)"
        echo "  action         deploy, rollback, status, or logs (default: deploy)"
        echo
        echo "Examples:"
        echo "  $0 dev latest deploy              # Deploy latest to dev"
        echo "  $0 prod v1.2.3 deploy            # Deploy v1.2.3 to prod"
        echo "  $0 dev latest status             # Get deployment status"
        echo "  $0 dev latest logs user-service  # Get logs for user-service"
        echo "  $0 dev latest rollback cloudmastershub-api-gateway  # Rollback API gateway"
        exit 1
        ;;
esac