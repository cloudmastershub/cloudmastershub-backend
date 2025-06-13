# CloudMastersHub Backend Makefile

# Variables
IMAGE_NAME = cloudmastershub/backend
IMAGE_TAG ?= latest
ENVIRONMENT ?= dev
COMPOSE_FILE = docker-compose.dev.yml

# Default target
.DEFAULT_GOAL := help

# Help target
.PHONY: help
help: ## Show this help message
	@echo "CloudMastersHub Backend - Available Commands:"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Variables:"
	@echo "  IMAGE_TAG     Docker image tag (default: latest)"
	@echo "  ENVIRONMENT   Target environment (default: dev)"
	@echo
	@echo "Examples:"
	@echo "  make setup                    # Setup development environment"
	@echo "  make dev                      # Start development environment"
	@echo "  make build IMAGE_TAG=v1.2.3   # Build with specific tag"
	@echo "  make deploy ENVIRONMENT=prod  # Deploy to production"

# Development targets
.PHONY: setup
setup: ## Setup development environment
	@echo "Setting up development environment..."
	./scripts/dev-setup.sh

.PHONY: dev
dev: ## Start development environment
	@echo "Starting development environment..."
	docker-compose -f $(COMPOSE_FILE) up -d postgres mongodb redis
	@echo "Waiting for databases..."
	@sleep 10
	npm run dev

.PHONY: dev-db
dev-db: ## Start only development databases
	@echo "Starting development databases..."
	docker-compose -f $(COMPOSE_FILE) up -d postgres mongodb redis

.PHONY: dev-stop
dev-stop: ## Stop development environment
	@echo "Stopping development environment..."
	docker-compose -f $(COMPOSE_FILE) down

.PHONY: dev-clean
dev-clean: ## Clean development environment (remove volumes)
	@echo "Cleaning development environment..."
	docker-compose -f $(COMPOSE_FILE) down -v
	docker system prune -f

# Build targets
.PHONY: install
install: ## Install dependencies
	@echo "Installing dependencies..."
	npm ci

.PHONY: build-shared
build-shared: ## Build shared packages
	@echo "Building shared packages..."
	npm run build --workspace=@cloudmastershub/types
	npm run build --workspace=@cloudmastershub/utils
	npm run build --workspace=@cloudmastershub/middleware

.PHONY: build-services
build-services: build-shared ## Build all services
	@echo "Building all services..."
	npm run build --workspace=@cloudmastershub/api-gateway
	npm run build --workspace=@cloudmastershub/user-service
	npm run build --workspace=@cloudmastershub/course-service
	npm run build --workspace=@cloudmastershub/lab-service

.PHONY: build
build: build-services ## Build everything (alias for build-services)

# Testing targets
.PHONY: lint
lint: ## Run ESLint
	@echo "Running ESLint..."
	npm run lint

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	@echo "Running TypeScript type checking..."
	npm run typecheck

.PHONY: test
test: ## Run all tests
	@echo "Running tests..."
	npm run test

.PHONY: test-coverage
test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	npm run test -- --coverage

.PHONY: check
check: lint typecheck test ## Run all checks (lint, typecheck, test)

# Docker targets
.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "Building Docker image: $(IMAGE_NAME):$(IMAGE_TAG)"
	./scripts/build.sh $(IMAGE_TAG) false

.PHONY: docker-push
docker-push: ## Build and push Docker image
	@echo "Building and pushing Docker image: $(IMAGE_NAME):$(IMAGE_TAG)"
	./scripts/build.sh $(IMAGE_TAG) true

.PHONY: docker-test
docker-test: ## Test Docker image
	@echo "Testing Docker image: $(IMAGE_NAME):$(IMAGE_TAG)"
	./scripts/build.sh $(IMAGE_TAG) false test

.PHONY: docker-scan
docker-scan: ## Security scan Docker image
	@echo "Scanning Docker image: $(IMAGE_NAME):$(IMAGE_TAG)"
	SECURITY_SCAN=true ./scripts/build.sh $(IMAGE_TAG) false scan

# Deployment targets
.PHONY: deploy
deploy: ## Deploy to specified environment
	@echo "Deploying to $(ENVIRONMENT) environment..."
	./scripts/deploy.sh $(ENVIRONMENT) $(IMAGE_TAG) deploy

.PHONY: deploy-status
deploy-status: ## Get deployment status
	@echo "Getting deployment status for $(ENVIRONMENT) environment..."
	./scripts/deploy.sh $(ENVIRONMENT) $(IMAGE_TAG) status

.PHONY: deploy-logs
deploy-logs: ## Get deployment logs
	@echo "Getting deployment logs for $(ENVIRONMENT) environment..."
	./scripts/deploy.sh $(ENVIRONMENT) $(IMAGE_TAG) logs

.PHONY: rollback
rollback: ## Rollback deployment (requires DEPLOYMENT variable)
	@if [ -z "$(DEPLOYMENT)" ]; then \
		echo "Error: DEPLOYMENT variable is required"; \
		echo "Usage: make rollback DEPLOYMENT=cloudmastershub-api-gateway"; \
		exit 1; \
	fi
	@echo "Rolling back deployment: $(DEPLOYMENT)"
	./scripts/deploy.sh $(ENVIRONMENT) $(IMAGE_TAG) rollback $(DEPLOYMENT)

# Database targets
.PHONY: db-migrate
db-migrate: ## Run database migrations (placeholder)
	@echo "Running database migrations..."
	@echo "Note: Implement actual migration logic here"

.PHONY: db-seed
db-seed: ## Seed database with sample data (placeholder)
	@echo "Seeding database..."
	@echo "Note: Implement actual seeding logic here"

.PHONY: db-backup
db-backup: ## Backup databases (placeholder)
	@echo "Backing up databases..."
	@echo "Note: Implement actual backup logic here"

# Utility targets
.PHONY: clean
clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf dist/
	rm -rf */dist/
	rm -rf coverage/
	rm -rf */coverage/
	rm -rf .nyc_output/
	rm -rf */.nyc_output/

.PHONY: clean-all
clean-all: clean ## Clean everything including node_modules
	@echo "Cleaning everything..."
	rm -rf node_modules/
	rm -rf */node_modules/
	rm -rf package-lock.json
	rm -rf */package-lock.json

.PHONY: logs
logs: ## Show logs for a specific service (requires SERVICE variable)
	@if [ -z "$(SERVICE)" ]; then \
		echo "Error: SERVICE variable is required"; \
		echo "Usage: make logs SERVICE=api-gateway"; \
		echo "Available services: api-gateway, user-service, course-service, lab-service"; \
		exit 1; \
	fi
	@echo "Showing logs for $(SERVICE)..."
	./scripts/deploy.sh $(ENVIRONMENT) $(IMAGE_TAG) logs $(SERVICE)

.PHONY: shell
shell: ## Get shell access to a service container (requires SERVICE variable)
	@if [ -z "$(SERVICE)" ]; then \
		echo "Error: SERVICE variable is required"; \
		echo "Usage: make shell SERVICE=api-gateway"; \
		exit 1; \
	fi
	@echo "Opening shell for $(SERVICE)..."
	kubectl exec -it -n cloudmastershub-$(ENVIRONMENT) deployment/cloudmastershub-$(SERVICE) -- sh

# CI/CD targets
.PHONY: ci
ci: install check build-services docker-build ## Run CI pipeline
	@echo "CI pipeline completed successfully"

.PHONY: cd
cd: docker-push deploy ## Run CD pipeline
	@echo "CD pipeline completed successfully"

# Production shortcuts
.PHONY: prod-deploy
prod-deploy: ## Deploy to production
	@$(MAKE) deploy ENVIRONMENT=prod

.PHONY: prod-status
prod-status: ## Get production status
	@$(MAKE) deploy-status ENVIRONMENT=prod

.PHONY: prod-logs
prod-logs: ## Get production logs
	@$(MAKE) deploy-logs ENVIRONMENT=prod

# Development shortcuts for each service
.PHONY: dev-api
dev-api: ## Start API Gateway in development mode
	npm run dev --workspace=@cloudmastershub/api-gateway

.PHONY: dev-user
dev-user: ## Start User Service in development mode
	npm run dev --workspace=@cloudmastershub/user-service

.PHONY: dev-course
dev-course: ## Start Course Service in development mode
	npm run dev --workspace=@cloudmastershub/course-service

.PHONY: dev-lab
dev-lab: ## Start Lab Service in development mode
	npm run dev --workspace=@cloudmastershub/lab-service

# Health check targets
.PHONY: health
health: ## Check health of all services
	@echo "Checking service health..."
	@curl -s http://localhost:3000/health | jq . || echo "API Gateway not responding"
	@curl -s http://localhost:3001/health | jq . || echo "User Service not responding"
	@curl -s http://localhost:3002/health | jq . || echo "Course Service not responding"
	@curl -s http://localhost:3003/health | jq . || echo "Lab Service not responding"

# Version info
.PHONY: version
version: ## Show version information
	@echo "CloudMastersHub Backend"
	@echo "Node.js: $(shell node --version)"
	@echo "npm: $(shell npm --version)"
	@echo "Docker: $(shell docker --version)"
	@echo "Image tag: $(IMAGE_TAG)"
	@echo "Environment: $(ENVIRONMENT)"