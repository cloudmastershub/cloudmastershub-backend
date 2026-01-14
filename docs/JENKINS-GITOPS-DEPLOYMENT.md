# CloudMastersHub Backend - Jenkins GitOps Deployment Guide

This guide provides step-by-step instructions for setting up and deploying the CloudMastersHub backend microservices using Jenkins CI and ArgoCD GitOps.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create Jenkins Pipeline Job](#step-1-create-jenkins-pipeline-job)
4. [Step 2: Configure ArgoCD Application](#step-2-configure-argocd-application)
5. [Step 3: Deployment Workflow](#step-3-deployment-workflow)
6. [Step 4: Verification](#step-4-verification)
7. [Service-Specific Notes](#service-specific-notes)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### CI/CD Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Backend CI/CD Pipeline Flow                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │  GitHub  │───▶│ Jenkins  │───▶│Docker Hub│    │ GitOps   │          │
│  │  Push    │    │   CI     │    │  Image   │    │  Repo    │          │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘          │
│                        │              │               │                 │
│                        │              │               ▼                 │
│              ┌─────────┴─────────┐    │          ┌──────────┐          │
│              │ Build All Services│    │          │  ArgoCD  │          │
│              │ • API Gateway     │    │          │   CD     │          │
│              │ • User Service    │    └─────────▶│          │          │
│              │ • Course Service  │               └────┬─────┘          │
│              │ • Lab Service     │                    │                 │
│              │ • Payment Service │                    ▼                 │
│              │ • Admin Service   │               ┌──────────┐          │
│              │ • Marketing Svc   │               │Kubernetes│          │
│              └───────────────────┘               │ Cluster  │          │
│                                                  └──────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Microservices Architecture

| Service | Port | Purpose | Database |
|---------|------|---------|----------|
| API Gateway | 3000 | Request routing, rate limiting | - |
| User Service | 3001 | Authentication, profiles | PostgreSQL |
| Course Service | 3002 | Content management, progress | MongoDB |
| Lab Service | 3003 | Cloud lab provisioning | Redis |
| Payment Service | 3004 | Stripe integration | PostgreSQL |
| Admin Service | 3005 | Platform administration | PostgreSQL |
| Marketing Service | 3006 | Funnels, campaigns | MongoDB |

### Key Design Decision: Single Image, Multiple Services

The backend uses a **single Docker image** that runs all services. The `SERVICE_NAME` environment variable determines which service starts:

```yaml
env:
  - name: SERVICE_NAME
    value: "user-service"  # or api-gateway, course-service, etc.
```

This approach:
- Simplifies versioning (all services share the same version)
- Ensures dependency consistency across services
- Reduces build time with shared layers
- Enables atomic deployments

---

## Prerequisites

### Platform Requirements (Managed by Claude Infra)

| Component | URL/Details | Status |
|-----------|-------------|--------|
| Jenkins Server | `http://apollo.elitessystems.com` | ✅ Available |
| ArgoCD Server | `http://argocd.elitessystems.com` | ✅ Available |
| Docker Hub | `docker.io/mbuaku` | ✅ Configured |
| Kubernetes Cluster | Elites Systems Platform | ✅ Running |
| GitHub Credentials | `github-credentials` in Jenkins | ✅ Configured |
| Docker Hub Credentials | `dockerhub-creds` in Jenkins | ✅ Configured |

### Repository Requirements

| Repository | URL | Purpose |
|------------|-----|---------|
| Backend Source | `https://github.com/cloudmastershub/cloudmastershub-backend` | Application code |
| GitOps Manifests | `https://github.com/cloudmastershub/cloudmastershub-gitop` | Kubernetes manifests |

### Required Files in Backend Repository

Ensure these files exist in your backend repository:

```
backend/
├── Jenkinsfile              # CI pipeline definition
├── Dockerfile               # Multi-service container build
├── docker-compose.yml       # Local development
├── docker-compose.dev.yml   # Development environment
├── package.json             # Root dependencies
├── package-lock.json        # Locked dependencies
├── services/                # Microservices
│   ├── api-gateway/
│   ├── user-service/
│   ├── course-service/
│   ├── lab-service/
│   ├── payment-service/
│   ├── admin-service/
│   └── marketing-service/
├── shared/                  # Shared libraries
│   ├── types/
│   ├── utils/
│   └── middleware/
└── scripts/
    └── start.sh             # Service startup script
```

---

## Step 1: Create Jenkins Pipeline Job

### 1.1 Access Jenkins Dashboard

1. Open Jenkins at `http://apollo.elitessystems.com`
2. Login with credentials: `admin` / `admin123`

### 1.2 Create New Pipeline Job

1. Click **"New Item"** from the left sidebar
2. Enter job name: `cloudmastershub-backend`
3. Select **"Pipeline"** as the job type
4. Click **"OK"** to create the job

### 1.3 Configure Pipeline Settings

Navigate through the configuration tabs:

#### General Settings

```
☑ Do not allow concurrent builds
☑ GitHub project
   Project url: https://github.com/cloudmastershub/cloudmastershub-backend
```

#### Build Triggers

```
☑ GitHub hook trigger for GITScm polling
   (This enables automatic builds on git push)
```

#### Pipeline Definition

```
Definition: Pipeline script from SCM

SCM: Git

Repository URL: https://github.com/cloudmastershub/cloudmastershub-backend.git

Credentials: github-credentials (select from dropdown)

Branch Specifier: */main

Script Path: Jenkinsfile
```

### 1.4 Save Configuration

Click **"Save"** at the bottom of the configuration page.

### 1.5 Jenkinsfile Overview

The backend `Jenkinsfile` includes these key stages:

```groovy
// Key stages in the Jenkinsfile:

stages {
    stage('Checkout & Setup')       // Clone repository
    stage('Install Dependencies')   // npm ci for all services
    stage('Code Quality')           // Lint + Test (parallel)
    stage('Build')                  // Build all services
    stage('Docker Build & Push')    // Build single image, push to Docker Hub
    stage('GitOps Update')          // Update image tag in GitOps repo
}
```

**Environment Variables Set:**
```groovy
APP_NAME = 'cloudmastershub-backend'
IMAGE_NAME = "mbuaku/cloudmastershub-backend"
IMAGE_TAG = "build-${BUILD_VERSION}"
GITOPS_REPO = "cloudmastershub/cloudmastershub-gitop"
```

**Services Built:**
```groovy
// The pipeline builds all services:
for service in api-gateway user-service course-service lab-service admin-service payment-service marketing-service; do
    npm run build --workspace=@cloudmastershub/$service
done
```

---

## Step 2: Configure ArgoCD Application

### 2.1 Access ArgoCD Dashboard

1. Open ArgoCD at `http://argocd.elitessystems.com`
2. Login with credentials: `admin` / `1ECWGGQYjuP8jFVm`

### 2.2 Create Backend Application (One-Time Setup)

**Option A: Via ArgoCD UI**

1. Click **"+ NEW APP"** button
2. Fill in the application details:

```yaml
Application Name: cloudmastershub-backend
Project: default
Sync Policy: Automatic

Source:
  Repository URL: https://github.com/cloudmastershub/cloudmastershub-gitop.git
  Revision: HEAD
  Path: apps/backend

Destination:
  Cluster URL: https://kubernetes.default.svc
  Namespace: cloudmastershub-dev

Sync Options:
  ☑ AUTO-CREATE NAMESPACE: false
  ☑ PRUNE RESOURCES: true
  ☑ SELF HEAL: true
```

3. Click **"CREATE"**

**Option B: Via kubectl (Recommended)**

Apply the ArgoCD Application manifest:

```bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cloudmastershub-backend
  namespace: argocd
  labels:
    app.kubernetes.io/name: cloudmastershub-backend
    app.kubernetes.io/part-of: cloudmastershub
  finalizers:
  - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/cloudmastershub/cloudmastershub-gitop.git
    targetRevision: HEAD
    path: apps/backend
  destination:
    server: https://kubernetes.default.svc
    namespace: cloudmastershub-dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
    - CreateNamespace=false
    - PrunePropagationPolicy=foreground
    - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  revisionHistoryLimit: 10
EOF
```

### 2.3 Verify GitOps Repository Structure

The GitOps repository should have this structure for the backend:

```
gitops-repo/
├── apps/
│   └── backend/
│       ├── kustomization.yaml    # Kustomize config with image tag
│       ├── deployment.yaml       # API Gateway deployment
│       ├── service.yaml          # API Gateway service
│       ├── ingress.yaml          # Ingress for api.cloudmastershub.com
│       ├── user-service.yaml     # User service deployment
│       ├── course-service.yaml   # Course service deployment
│       ├── payment-service.yaml  # Payment service deployment
│       ├── admin-service.yaml    # Admin service deployment
│       ├── marketing-service.yaml # Marketing service deployment
│       ├── postgresql.yaml       # PostgreSQL StatefulSet
│       ├── mongodb.yaml          # MongoDB StatefulSet
│       └── redis.yaml            # Redis StatefulSet
└── argocd/
    └── applications/
        └── backend.yaml          # ArgoCD Application definition
```

**Key File: `apps/backend/kustomization.yaml`**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml
- ingress.yaml
- postgresql.yaml
- mongodb.yaml
- redis.yaml
- user-service.yaml
- course-service.yaml
- payment-service.yaml
- admin-service.yaml
- marketing-service.yaml

commonLabels:
  app.kubernetes.io/name: cloudmastershub-backend
  app.kubernetes.io/component: backend
  app.kubernetes.io/part-of: cloudmastershub
  app.kubernetes.io/managed-by: argocd

namespace: cloudmastershub-dev

images:
- name: mbuaku/cloudmastershub-backend
  newTag: build-18  # <-- This is updated by Jenkins
```

---

## Step 3: Deployment Workflow

### 3.1 Automatic Deployment Flow

The deployment is fully automated once set up:

```
1. Developer pushes code to GitHub (main branch)
           │
           ▼
2. GitHub webhook triggers Jenkins build
           │
           ▼
3. Jenkins executes pipeline stages:
   • Checkout code
   • Install dependencies for all services
   • Run linting and tests
   • Build all microservices
   • Build Docker image (single image, all services)
   • Push to Docker Hub (mbuaku/cloudmastershub-backend:build-XX)
           │
           ▼
4. Jenkins updates GitOps repository:
   • Clones gitops-repo
   • Updates apps/backend/kustomization.yaml with new image tag
   • Commits and pushes changes
           │
           ▼
5. ArgoCD detects GitOps changes (within 3 minutes)
           │
           ▼
6. ArgoCD syncs Kubernetes manifests:
   • Updates all service Deployments with new image
   • Kubernetes performs rolling update for each service
           │
           ▼
7. All backend services are updated atomically
   • API Gateway: https://api.cloudmastershub.com
   • All microservices running with same image version
```

### 3.2 Manual Deployment (If Needed)

If you need to deploy manually without code changes:

```bash
# 1. Update the image tag in GitOps repository
cd /home/master/projects/cloudmastershub/gitops-repo

# 2. Edit kustomization.yaml
sed -i 's|newTag: build-.*|newTag: build-NEW_NUMBER|' apps/backend/kustomization.yaml

# 3. Commit and push
git add apps/backend/kustomization.yaml
git commit -m "Deploy backend build-NEW_NUMBER"
git push origin main

# 4. ArgoCD will automatically sync within 3 minutes
# Or force sync via UI/CLI:
argocd app sync cloudmastershub-backend
```

### 3.3 Trigger Manual Jenkins Build

1. Go to Jenkins: `http://apollo.elitessystems.com/job/cloudmastershub-backend/`
2. Click **"Build Now"** in the left sidebar
3. Monitor build progress in **"Build History"**
4. Click on build number to see **"Console Output"**

---

## Step 4: Verification

### 4.1 Verify Jenkins Build Success

```bash
# Check recent builds
# Go to: http://apollo.elitessystems.com/job/cloudmastershub-backend/

# Expected output in Console:
# ✅ Backend CI pipeline completed successfully!
# 🐳 Image pushed: mbuaku/cloudmastershub-backend:build-XX
# 📝 Ready for GitOps deployment via ArgoCD
```

### 4.2 Verify Docker Image

```bash
# Check Docker Hub for the new image
docker pull mbuaku/cloudmastershub-backend:build-XX

# Or view on Docker Hub:
# https://hub.docker.com/r/mbuaku/cloudmastershub-backend/tags
```

### 4.3 Verify GitOps Update

```bash
# Check GitOps repository for updated image tag
cd /home/master/projects/cloudmastershub/gitops-repo
git pull
grep "newTag" apps/backend/kustomization.yaml

# Expected output:
#   newTag: build-XX
```

### 4.4 Verify ArgoCD Sync

```bash
# Via kubectl
kubectl get applications -n argocd
kubectl get application cloudmastershub-backend -n argocd -o jsonpath='{.status.sync.status}'

# Expected: Synced

# Via ArgoCD CLI (if installed)
argocd app get cloudmastershub-backend
```

### 4.5 Verify All Backend Services

```bash
# Check all pods
kubectl get pods -n cloudmastershub-dev | grep -E "api-gateway|user-service|course-service|payment|admin|marketing|mongodb|redis|postgres"

# Check all deployments have the same image
for deployment in cloudmastershub-backend cloudmastershub-user-service cloudmastershub-course-service cloudmastershub-payment-service cloudmastershub-admin-service cloudmastershub-marketing-service; do
    echo "$deployment:"
    kubectl get deployment $deployment -n cloudmastershub-dev -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null
    echo
done

# Check services are running
kubectl get svc -n cloudmastershub-dev
```

### 4.6 Verify API Gateway Health

```bash
# Check API Gateway is accessible
curl -I https://api.cloudmastershub.com/health

# Expected: HTTP/2 200

# Check specific service health via API Gateway
curl https://api.cloudmastershub.com/api/users/health
curl https://api.cloudmastershub.com/api/courses/health
```

### 4.7 Verify Service Communication

```bash
# Check inter-service communication
kubectl logs -n cloudmastershub-dev deployment/cloudmastershub-backend --tail=50

# Check individual service logs
kubectl logs -n cloudmastershub-dev deployment/cloudmastershub-user-service --tail=50
kubectl logs -n cloudmastershub-dev deployment/cloudmastershub-course-service --tail=50
```

---

## Service-Specific Notes

### API Gateway (Port 3000)

The API Gateway routes requests to internal services:

```yaml
# Routing configuration
/api/users/*   → user-service:3001
/api/courses/* → course-service:3002
/api/labs/*    → lab-service:3003
/api/payments/* → payment-service:3004
/api/admin/*   → admin-service:3005
/api/marketing/* → marketing-service:3006
```

### Database Dependencies

Each service has specific database requirements:

| Service | Database | Connection |
|---------|----------|------------|
| User Service | PostgreSQL | `postgres:5432/cloudmastershub` |
| Course Service | MongoDB | `mongodb:27017/cloudmastershub` |
| Lab Service | Redis | `redis:6379` |
| Payment Service | PostgreSQL | `postgres:5432/cloudmastershub` |
| Admin Service | PostgreSQL | `postgres:5432/cloudmastershub` |
| Marketing Service | MongoDB | `mongodb:27017/cloudmastershub` |

### Environment Variables

Each service deployment includes these environment variables:

```yaml
env:
  - name: SERVICE_NAME
    value: "user-service"  # Determines which service starts
  - name: NODE_ENV
    value: "production"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: cloudmastershub-secrets
        key: database-url
  - name: JWT_SECRET
    valueFrom:
      secretKeyRef:
        name: cloudmastershub-secrets
        key: jwt-secret
  - name: REDIS_URL
    value: "redis://redis:6379"
```

---

## Troubleshooting

### Common Issues

#### Issue: Jenkins Build Fails at npm install

```bash
# Solution 1: Clear npm cache
npm cache clean --force

# Solution 2: Check package-lock.json is committed
git status | grep package-lock.json

# Solution 3: Check Node.js version (requires 18+)
node --version
```

#### Issue: Build Fails for Specific Service

```bash
# Check which service failed in Jenkins console
# Usually shows: "npm run build --workspace=@cloudmastershub/SERVICE failed"

# Test locally:
cd backend/services/SERVICE_NAME
npm run build

# Check for TypeScript errors
npm run type-check
```

#### Issue: Docker Build Fails

```bash
# Check Dockerfile exists
ls -la Dockerfile

# Check start.sh exists
ls -la scripts/start.sh

# Test local Docker build
docker build -t test-backend .
```

#### Issue: GitOps Update Fails

```bash
# Check GitHub credentials in Jenkins
# Credentials ID: github-credentials

# Verify GitOps repo is accessible
git clone https://github.com/cloudmastershub/cloudmastershub-gitop.git test-clone
rm -rf test-clone

# Check for merge conflicts
cd gitops-repo
git pull origin main
```

#### Issue: ArgoCD Not Syncing

```bash
# Check ArgoCD application status
kubectl get application cloudmastershub-backend -n argocd

# Force refresh
argocd app refresh cloudmastershub-backend

# Check for sync errors
kubectl describe application cloudmastershub-backend -n argocd
```

#### Issue: Pods CrashLoopBackOff

```bash
# Check pod events
kubectl describe pod -n cloudmastershub-dev -l app=cloudmastershub-user-service

# Check SERVICE_NAME env var is set
kubectl get deployment cloudmastershub-user-service -n cloudmastershub-dev \
  -o jsonpath='{.spec.template.spec.containers[0].env}' | jq '.[] | select(.name=="SERVICE_NAME")'

# Check pod logs
kubectl logs -n cloudmastershub-dev deployment/cloudmastershub-user-service --previous
```

#### Issue: Database Connection Errors

```bash
# Check MongoDB credentials
kubectl get secret cloudmastershub-secrets -n cloudmastershub-dev \
  -o jsonpath='{.data.mongodb-password}' | base64 -d

# Check PostgreSQL is running
kubectl get pods -n cloudmastershub-dev | grep postgres

# Check MongoDB is running
kubectl get pods -n cloudmastershub-dev | grep mongodb

# Test database connectivity
kubectl exec -it deployment/cloudmastershub-user-service -n cloudmastershub-dev \
  -- nc -zv postgres 5432
```

#### Issue: Service Communication Failures

```bash
# Check inter-service network policy
kubectl get networkpolicy -n cloudmastershub-dev

# Apply backend-to-backend network policy if missing
kubectl apply -f k8s/network-policies/backend-to-backend-networkpolicy.yaml

# Test service discovery
kubectl exec -it deployment/cloudmastershub-backend -n cloudmastershub-dev \
  -- nslookup cloudmastershub-user-service
```

### Rollback Procedure

If a deployment fails and you need to rollback:

```bash
# 1. Find the previous working build number
kubectl get deployment cloudmastershub-backend -n cloudmastershub-dev \
  -o jsonpath='{.spec.template.spec.containers[0].image}'

# 2. Update GitOps to previous version
cd /home/master/projects/cloudmastershub/gitops-repo
sed -i 's|newTag: build-CURRENT|newTag: build-PREVIOUS|' apps/backend/kustomization.yaml
git add . && git commit -m "Rollback backend to build-PREVIOUS" && git push

# 3. ArgoCD will automatically deploy the rollback
# Or force sync:
argocd app sync cloudmastershub-backend
```

### Debug Commands

```bash
# View Jenkins build logs
# http://apollo.elitessystems.com/job/cloudmastershub-backend/BUILD_NUMBER/console

# View ArgoCD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller --tail=100

# View all backend service logs
for svc in backend user-service course-service payment-service admin-service marketing-service; do
    echo "=== cloudmastershub-$svc ==="
    kubectl logs -n cloudmastershub-dev deployment/cloudmastershub-$svc --tail=20 2>/dev/null || echo "Not running"
done

# Check all backend resources
kubectl get all -n cloudmastershub-dev -l app.kubernetes.io/part-of=cloudmastershub
```

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Jenkins | `http://apollo.elitessystems.com` |
| ArgoCD | `http://argocd.elitessystems.com` |
| API Gateway | `https://api.cloudmastershub.com` |
| Docker Hub | `https://hub.docker.com/r/mbuaku/cloudmastershub-backend` |

### Credentials

| System | Credential ID | Usage |
|--------|--------------|-------|
| Jenkins | `github-credentials` | Clone repos, push to GitOps |
| Jenkins | `dockerhub-creds` | Push Docker images |
| ArgoCD | admin / 1ECWGGQYjuP8jFVm | ArgoCD dashboard access |

### Key Commands

```bash
# Trigger build
# Click "Build Now" in Jenkins UI

# Check all backend pods
kubectl get pods -n cloudmastershub-dev | grep cloudmastershub

# Force ArgoCD sync
argocd app sync cloudmastershub-backend

# View service logs
kubectl logs -n cloudmastershub-dev deployment/cloudmastershub-user-service --tail=100

# Check API health
curl https://api.cloudmastershub.com/health
```

---

## Related Documentation

- [Main README](../README.md) - Backend overview and development guide
- [CI-CD-SETUP.md](../CI-CD-SETUP.md) - General CI/CD architecture
- [JENKINS-SETUP.md](../JENKINS-SETUP.md) - Jenkins troubleshooting guide
- [k8s/TROUBLESHOOTING.md](../k8s/TROUBLESHOOTING.md) - Kubernetes troubleshooting
- [GitOps Repository](https://github.com/cloudmastershub/cloudmastershub-gitop) - Kubernetes manifests
- [Infrastructure Guide](/home/master/terraform/docs/DEPLOYER-GUIDE.md) - Platform deployment guide
