# CloudMastersHub Backend CI/CD Setup

This document provides a comprehensive guide for setting up the CI/CD pipeline for the CloudMastersHub backend microservices.

## Overview

The CI/CD pipeline is designed to:
- Build and test all microservices in a monorepo
- Create a single Docker image that can run any service
- Deploy to multiple environments (dev, staging, prod)
- Provide rollback capabilities
- Include security scanning and health checks

## Architecture

### Monorepo Structure
```
backend/
├── services/              # Microservices
│   ├── api-gateway/      # Port 3000
│   ├── user-service/     # Port 3001
│   ├── course-service/   # Port 3002
│   └── lab-service/      # Port 3003
├── shared/               # Shared libraries
├── k8s/                  # Kubernetes manifests
├── scripts/              # Deployment scripts
├── Dockerfile            # Multi-service Docker image
├── Jenkinsfile           # CI/CD pipeline
└── docker-compose.yml    # Local development
```

### Single Image, Multiple Services
The Docker image contains all services and uses the `SERVICE_NAME` environment variable to determine which service to start. This approach:
- Simplifies deployment and versioning
- Ensures all services use the same base dependencies
- Reduces image build time with shared layers
- Maintains consistency across services

## Prerequisites

### Jenkins Setup
1. **Required Plugins:**
   ```
   - Docker Pipeline
   - Kubernetes CLI
   - NodeJS Plugin
   - Blue Ocean (optional)
   - Slack Notification (optional)
   - Trivy Scanner (security)
   ```

2. **Global Tools Configuration:**
   ```
   - NodeJS 18+ installation
   - Docker (available on agents)
   - kubectl CLI
   ```

3. **Credentials:**
   ```
   - dockerhub-credentials: Docker Hub username/password
   - kubeconfig-dev: Kubernetes config for dev cluster
   - kubeconfig-prod: Kubernetes config for prod cluster
   ```

### Kubernetes Setup
1. **Namespaces:**
   ```bash
   kubectl create namespace cloudmastershub-dev
   kubectl create namespace cloudmastershub-staging
   kubectl create namespace cloudmastershub-prod
   ```

2. **RBAC:** Ensure Jenkins service account has proper permissions

3. **Ingress Controller:** NGINX ingress controller for external access

## Pipeline Stages

### 1. Checkout
- Fetches source code
- Sets build metadata (commit hash, build number)
- Determines image tag format

### 2. Setup Node.js
- Installs dependencies with `npm ci`
- Configures workspace for monorepo

### 3. Code Quality (Parallel)
- **Lint:** ESLint across all services
- **Type Check:** TypeScript validation

### 4. Test
- Unit tests for all services
- Coverage reporting
- Test result publishing

### 5. Build
- Builds shared packages first
- Compiles all services
- Creates build artifacts

### 6. Security Scan (Parallel)
- **Dependency Check:** `npm audit`
- **Docker Security Scan:** Trivy vulnerability scanning

### 7. Docker Build & Push
- Builds single Docker image
- Tags with commit hash and build number
- Pushes to Docker registry
- Creates latest/branch tags

### 8. Deploy
- **Dev Environment:** Automatic on `develop` branch
- **Production:** Manual approval on `main/master` branch

### 9. Health Check
- Verifies deployment success
- Checks pod readiness
- Validates service endpoints

## Environment Configuration

### Development Environment
```yaml
# Automatic deployment on develop branch
Namespace: cloudmastershub-dev
Replicas: 2 per service
Resources: Lower limits for cost efficiency
Database: Shared development instances
```

### Production Environment
```yaml
# Manual approval required
Namespace: cloudmastershub-prod
Replicas: 3+ per service
Resources: Higher limits for performance
Database: Dedicated production instances
Auto-scaling: Enabled with HPA
```

## Docker Image Details

### Multi-Stage Build
```dockerfile
# Stage 1: Build all services
FROM node:18-alpine AS builder
# Install dependencies and build

# Stage 2: Production runtime
FROM node:18-alpine AS production
# Copy artifacts and configure runtime
```

### Service Selection
The image uses a startup script that:
1. Reads `SERVICE_NAME` environment variable
2. Waits for service dependencies (databases)
3. Sets appropriate port
4. Starts the specified service

### Environment Variables
```bash
SERVICE_NAME=api-gateway     # Which service to start
PORT=3000                    # Service port
NODE_ENV=production          # Runtime environment
DATABASE_URL=...             # Database connections
REDIS_URL=...               # Cache connection
```

## Kubernetes Deployment

### Service Architecture
Each microservice gets:
- Separate Deployment
- ClusterIP Service
- Horizontal Pod Autoscaler
- Resource limits and requests
- Health checks (liveness/readiness)

### ConfigMaps and Secrets
```yaml
# Configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudmastershub-config
data:
  environment: "production"
  log-level: "info"
  # ... other config

---
# Secrets
apiVersion: v1
kind: Secret
metadata:
  name: cloudmastershub-secrets
data:
  jwt-secret: <base64-encoded>
  mongodb-password: <base64-encoded>
  # ... other secrets
```

### Service Discovery
Services communicate using Kubernetes DNS:
```
http://cloudmastershub-user-service.cloudmastershub-dev.svc.cluster.local:3001
```

## Deployment Commands

### Manual Deployment
```bash
# Build and push image
./scripts/build.sh v1.2.3 true

# Deploy to specific environment
./scripts/deploy.sh dev v1.2.3 deploy
./scripts/deploy.sh prod v1.2.3 deploy

# Check deployment status
./scripts/deploy.sh dev v1.2.3 status

# Get service logs
./scripts/deploy.sh dev v1.2.3 logs user-service

# Rollback if needed
./scripts/deploy.sh dev v1.2.3 rollback cloudmastershub-api-gateway
```

### Using Makefile
```bash
# Development
make setup              # Setup development environment
make dev               # Start local development
make build             # Build all services

# CI/CD
make ci                # Run CI pipeline locally
make docker-push       # Build and push image
make deploy ENVIRONMENT=dev IMAGE_TAG=v1.2.3

# Production
make prod-deploy       # Deploy to production
make prod-status       # Check production status
```

## Monitoring and Observability

### Health Checks
Each service exposes:
- `/health` - Basic health check
- Kubernetes liveness/readiness probes
- Resource usage monitoring

### Logging
- Structured JSON logging
- Centralized log aggregation (ELK stack)
- Log rotation and retention policies

### Metrics
- Application metrics (custom)
- Infrastructure metrics (Prometheus)
- Auto-scaling based on CPU/memory

## Security Considerations

### Container Security
- Non-root user execution
- Read-only root filesystem
- Minimal base image (Alpine)
- Security scanning with Trivy

### Kubernetes Security
- RBAC for service accounts
- Network policies for isolation
- Secret management
- Pod security policies

### CI/CD Security
- Credential management
- Dependency vulnerability scanning
- Image signing (optional)
- Supply chain security

## Troubleshooting

### Common Issues

1. **Build Failures:**
   ```bash
   # Check Node.js version
   node --version
   
   # Clear npm cache
   npm cache clean --force
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Deployment Failures:**
   ```bash
   # Check pod status
   kubectl get pods -n cloudmastershub-dev
   
   # Get pod logs
   kubectl logs -n cloudmastershub-dev deployment/cloudmastershub-api-gateway
   
   # Describe deployment
   kubectl describe deployment cloudmastershub-api-gateway -n cloudmastershub-dev
   ```

3. **Service Communication Issues:**
   ```bash
   # Test service connectivity
   kubectl exec -it pod-name -- nc -zv service-name port
   
   # Check service endpoints
   kubectl get endpoints -n cloudmastershub-dev
   ```

### Debug Mode
Enable debug logging:
```bash
# Set LOG_LEVEL=debug in ConfigMap
kubectl patch configmap cloudmastershub-config -n cloudmastershub-dev \
  --patch '{"data":{"log-level":"debug"}}'

# Restart deployments to pick up changes
kubectl rollout restart deployment/cloudmastershub-api-gateway -n cloudmastershub-dev
```

## Best Practices

### Code Quality
- Enforce linting and type checking
- Maintain test coverage above 80%
- Use pre-commit hooks
- Regular dependency updates

### Deployment
- Blue-green deployments for zero downtime
- Canary releases for production
- Automated rollback on health check failures
- Regular backup of critical data

### Monitoring
- Set up alerting for critical metrics
- Monitor application performance
- Track deployment success rates
- Regular health check reviews

### Security
- Regular security scans
- Principle of least privilege
- Secret rotation policies
- Access audit trails

## Resources

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js in Production](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

## Support

For issues with the CI/CD pipeline:
1. Check Jenkins build logs
2. Review Kubernetes events
3. Consult this documentation
4. Contact the DevOps team