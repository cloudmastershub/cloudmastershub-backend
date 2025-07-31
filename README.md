# CloudMastersHub Backend

> 🚀 **Production-ready microservices backend for CloudMastersHub LMS**

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](./Dockerfile)
[![Docker](https://img.shields.io/docker/v/mbuaku/cloudmastershub-backend?label=Docker%20Hub&logo=docker)](https://hub.docker.com/r/mbuaku/cloudmastershub-backend)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-Jenkins-blue)](./Jenkinsfile)
[![Docker](https://img.shields.io/badge/Docker-Multi--stage-blue)](./Dockerfile)
[![K8s](https://img.shields.io/badge/Kubernetes-HPA%20Ready-blue)](./k8s/)

## 🏗️ Architecture

Microservices-based backend with modern DevOps practices:

| Service | Port | Purpose | Database | Status |
|---------|------|---------|----------|---------|
| **API Gateway** | 3000 | Request routing, rate limiting, auth | - | ✅ Deployed |
| **User Service** | 3001 | Authentication, profiles, subscriptions | PostgreSQL | ✅ Deployed |
| **Course Service** | 3002 | Content management, progress tracking | MongoDB | ✅ Deployed |
| **Lab Service** | 3003 | Cloud lab provisioning, queue management | Redis | ✅ Deployed |
| **Payment Service** | 3004 | Stripe integration, subscriptions | PostgreSQL | ⏳ Ready to Deploy |
| **Admin Service** | 3005 | Platform administration, monitoring | PostgreSQL | ⏳ Ready to Deploy |

## 🛠️ Tech Stack

- **Runtime**: Node.js 18 + TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Databases**: PostgreSQL + MongoDB + Redis
- **Queue**: Bull.js with Redis
- **Container**: Docker with multi-stage builds
- **Orchestration**: Kubernetes with auto-scaling (HPA)
- **CI/CD**: Jenkins with automated testing and security scanning

## ✨ Key Features

- 🔐 **JWT Authentication** with refresh tokens and RBAC
- 🚀 **Auto-scaling** Kubernetes HPA configuration
- 🛡️ **Security First** - Trivy scanning, non-root containers, input validation
- 📊 **Observability** - Health checks, structured logging, metrics ready
- 🔄 **CI/CD Ready** - Complete Jenkins pipeline with automated deployment
- 🐳 **Single Image, Multiple Services** - Efficient deployment model
- 🔧 **Developer Experience** - Hot reload, database UIs, comprehensive tooling
- 📈 **Admin Dashboard** - Real-time metrics with MongoDB aggregation pipelines

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm 9+

### Quick Start

```bash
# 1. Setup development environment (automated)
make setup

# 2. Start all services with hot reload
make dev

# 3. Access services
# API Gateway:    http://localhost:3000
# User Service:   http://localhost:3001
# Course Service: http://localhost:3002
# Lab Service:    http://localhost:3003

# 4. Database management UIs
# PostgreSQL:     http://localhost:8080 (Adminer)
# Redis:          http://localhost:8081 (Redis Commander)
# MongoDB:        mongodb://localhost:27017
```

### Manual Installation

```bash
# Install dependencies
npm install

# Copy environment files
cp services/*/​.env.example services/*/.env

# Start development environment
docker-compose -f docker-compose.dev.yml up
```

## 📋 Common Commands

### Development
```bash
# Development workflow
make dev                      # Start all services with hot reload
make dev-api                 # Start only API Gateway
make dev-user                # Start only User Service
make health                  # Check all service health

# Building and testing
make build                   # Build all services
make test                    # Run all tests
make lint                    # Run ESLint
make check                   # Run all quality checks (lint + typecheck + test)
```

### Docker & Deployment
```bash
# Docker operations
make docker-build           # Build production Docker image
make docker-push            # Build and push to registry
make docker-scan            # Security scan with Trivy

# Kubernetes deployment
make deploy ENVIRONMENT=dev IMAGE_TAG=v1.2.3    # Deploy to dev
make deploy ENVIRONMENT=prod IMAGE_TAG=v1.2.3   # Deploy to production
make deploy-status ENVIRONMENT=dev              # Check deployment status
make logs SERVICE=api-gateway ENVIRONMENT=dev   # Get service logs
```

### Service-specific Commands
```bash
# Work with individual services
npm run dev --workspace=@cloudmastershub/user-service
npm run build --workspace=@cloudmastershub/api-gateway
npm run test --workspace=@cloudmastershub/course-service
```

## API Endpoints

### API Gateway (http://localhost:3000)

- `GET /health` - Health check

All service endpoints are proxied through the gateway:
- `/api/users/*` → User Service
- `/api/courses/*` → Course Service
- `/api/labs/*` → Lab Service

### User Service

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/users/profile` - Get user profile (authenticated)
- `PUT /api/users/profile` - Update profile (authenticated)
- `GET /api/users/progress` - Get learning progress (authenticated)

### Course Service

- `GET /api/courses` - List all courses
- `GET /api/courses/:id` - Get course details
- `POST /api/courses/:id/enroll` - Enroll in course
- `GET /api/courses/:courseId/lessons` - Get course lessons
- `POST /api/courses/:courseId/lessons/:lessonId/complete` - Mark lesson complete

### Lab Service

- `GET /api/labs` - List all labs
- `GET /api/labs/:id` - Get lab details
- `POST /api/sessions/start` - Start lab session
- `GET /api/sessions/:sessionId/status` - Get session status
- `POST /api/sessions/:sessionId/stop` - Stop lab session

## Database Access

In development, you can access:
- PostgreSQL: `localhost:5432`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`
- Adminer (DB UI): `http://localhost:8080`
- Redis Commander: `http://localhost:8081`

## Production Build

```bash
# Build production images
docker-compose build

# Run production containers
docker-compose up -d
```

## Testing

```bash
# Run all tests
npm test  #RUN ALL TEST HERE

# Run tests for specific service
npm test --workspace=@cloudmastershub/user-service

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
BackEnd/
├── services/              # Microservices
│   ├── api-gateway/      # API Gateway service
│   ├── user-service/     # User management
│   ├── course-service/   # Course management
│   └── lab-service/      # Lab provisioning
├── shared/               # Shared libraries
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Common utilities
│   └── middleware/      # Shared Express middleware
├── k8s/                 # Kubernetes configurations
├── docker-compose.yml   # Production compose
└── docker-compose.dev.yml # Development compose
```

## 🔧 Troubleshooting

### MongoDB Connection Issues (Course Service)

If the course service fails with authentication errors:

1. **Ensure MongoDB credentials are properly set**:
   ```bash
   # Check if MongoDB password secret exists
   kubectl get secret cloudmastershub-secrets -n cloudmastershub-dev -o jsonpath='{.data.mongodb-password}' | base64 -d
   ```

2. **Verify environment variables in deployment**:
   - Course Service now uses `DATABASE_URL`, `MONGO_USERNAME`, and `MONGO_PASSWORD` env vars
   - The service builds the connection string dynamically with `authSource=admin`

3. **Check MongoDB is running with authentication**:
   ```bash
   kubectl exec -it <mongodb-pod> -n cloudmastershub-dev -- mongo -u admin -p <password> --authenticationDatabase admin
   ```

### Service CrashLoopBackOff Issues

If services fail with "Cannot find module" errors:

1. **Remove incorrect command overrides** in deployments
2. **Add SERVICE_NAME environment variable** to identify which service to start
3. **Ensure the Docker image includes the start.sh script**

Example fix:
```yaml
env:
- name: SERVICE_NAME
  value: "user-service"  # or course-service, payment-service, etc.
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 📚 Additional Documentation

- **[CI/CD Setup Guide](./CI-CD-SETUP.md)**: Complete pipeline setup and troubleshooting
- **[Architecture Docs](./Docs/)**: Detailed system design and technical specifications
- **[API Documentation](./API.md)**: Comprehensive API reference (auto-generated)

## 📁 File Organization (Updated July 2025)

Recent improvements to project structure:

- **Network Policies**: Moved to `k8s/network-policies/` for better organization
- **Admin Scripts**: Organized in `scripts/dev/grant-role/` for development access management
- **Kubernetes Resources**: All K8s manifests centralized in `k8s/` directory

## 🚀 Production Readiness

This backend is production-ready with:

- ✅ **Security**: RBAC, input validation, vulnerability scanning
- ✅ **Scalability**: Auto-scaling, load balancing, caching
- ✅ **Reliability**: Health checks, graceful shutdown, error handling
- ✅ **Observability**: Logging, metrics, distributed tracing ready
- ✅ **DevOps**: Complete CI/CD pipeline with automated testing

## 🤝 Contributing

1. Follow the established patterns in each service
2. Run `make check` before committing
3. Ensure all tests pass and coverage remains above 80%
4. Use conventional commits for clear history

## License

Proprietary - CloudMastersHub

---

**Ready to scale from development to production** 🚀
