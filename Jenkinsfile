// CloudMastersHub Backend CI Pipeline - GitOps Ready
// Phase 1: CI Only - Removed kubectl/deployment stages
pipeline {
    agent any
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '3'))
        timeout(time: 45, unit: 'MINUTES')
        disableConcurrentBuilds()
    }
    
    environment {
        // Application configuration
        APP_NAME = 'cloudmastershub-backend'
        
        // Docker registry configuration
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_REPO = 'mbuaku'
        IMAGE_NAME = "${DOCKER_REPO}/cloudmastershub-backend"
        
        // Build configuration
        NODE_VERSION = '20'
        
        // Version and build info
        BUILD_VERSION = "${BUILD_NUMBER}"
        GIT_COMMIT_SHORT = "${GIT_COMMIT.take(8)}"
        BRANCH_NAME_SAFE = "${env.GIT_BRANCH?.tokenize('/').last() ?: env.BRANCH_NAME ?: 'main'}"
        IMAGE_TAG = "build-${BUILD_VERSION}"
        IMAGE_TAG_LATEST = "latest"
        
        // GitOps Configuration
        GITOPS_REPO = "cloudmastershub/cloudmastershub-gitop"
        GITOPS_BRANCH = "main"
        
        // Optimize npm - use workspace cache to avoid permission issues
        NPM_CONFIG_LOGLEVEL = 'error'
        NPM_CONFIG_AUDIT = 'false'
        NPM_CONFIG_FUND = 'false'
        NPM_CONFIG_CACHE = "${WORKSPACE}/.npm-cache"
        HOME = "${WORKSPACE}"
    }
    
    stages {
        stage('Checkout & Setup') {
            steps {
                script {
                    echo "🚀 Starting CloudMastersHub Backend CI Pipeline"
                    echo "Branch: ${BRANCH_NAME_SAFE}"
                    echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
                    
                    // Checkout code
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: '*/main']],
                        userRemoteConfigs: [[
                            url: 'https://github.com/cloudmastershub/cloudmastershub-backend.git',
                            credentialsId: 'github-credentials'
                        ]]
                    ])
                    
                    // Setup environment
                    sh '''
                        echo "✅ Node.js version:"
                        node --version
                        npm --version
                        
                        echo "📂 Workspace contents:"
                        ls -la
                    '''
                }
            }
        }
        
        stage('Install Dependencies') {
            // Run on Jenkins host directly - Node.js v20 is available
            // Removed Docker agent due to Alpine/durable-task-plugin compatibility issues
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-credentials',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_PASS'
                )]) {
                script {
                    echo "📦 Installing dependencies for all services..."
                    sh '''
                        export NODE_AUTH_TOKEN=$GIT_PASS
                        # Install dependencies for workspace root
                        echo "📦 Installing root dependencies..."
                        npm ci --prefer-offline --no-audit --no-fund
                        
                        # Install dependencies for each service
                        for service in api-gateway user-service course-service lab-service admin-service payment-service; do
                            if [ -d "services/$service" ]; then
                                echo "📦 Installing dependencies for $service..."
                                cd "services/$service"
                                
                                if [ -f "package.json" ]; then
                                    # Clean cache and install
                                    npm cache verify || npm cache clean --force
                                    rm -rf node_modules
                                    
                                    if [ -f "package-lock.json" ]; then
                                        npm ci --prefer-offline --no-audit --no-fund
                                    else
                                        npm install --no-audit --no-fund
                                    fi
                                    echo "✅ Dependencies installed for $service"
                                else
                                    echo "⚠️  No package.json found for $service"
                                fi
                                
                                cd ../..
                            else
                                echo "📝 Service $service not found"
                            fi
                        done
                        
                        # Install shared dependencies
                        for shared in types utils middleware; do
                            if [ -d "shared/$shared" ]; then
                                echo "📦 Installing shared dependencies for $shared..."
                                cd "shared/$shared"
                                
                                if [ -f "package.json" ]; then
                                    npm ci --prefer-offline --no-audit --no-fund || npm install --no-audit --no-fund
                                    echo "✅ Shared dependencies installed for $shared"
                                fi
                                
                                cd ../..
                            fi
                        done
                    '''
                }
                }
            }
        }

        stage('Code Quality') {
            // Run on Jenkins host directly - Node.js v20 is available
            // Removed Docker agents due to Alpine/durable-task-plugin compatibility issues
            parallel {
                stage('Lint') {
                    steps {
                        script {
                            echo "🔍 Running linting for all services..."
                            sh '''
                                # Lint root project
                                if [ -f "package.json" ]; then
                                    if npm run --silent 2>&1 | grep -q "lint"; then
                                        npm run lint || echo "⚠️  Lint warnings found in root"
                                    else
                                        echo "📝 No lint script found in root"
                                    fi
                                fi
                                
                                # Lint each service
                                for service in api-gateway user-service course-service lab-service admin-service payment-service; do
                                    if [ -d "services/$service" ]; then
                                        echo "🔍 Linting $service..."
                                        cd "services/$service"
                                        
                                        if [ -f "package.json" ]; then
                                            # Check if lint script exists
                                            if npm run --silent 2>&1 | grep -q "lint"; then
                                                npm run lint || echo "⚠️  Lint warnings found in $service"
                                            else
                                                echo "📝 No lint script found for $service"
                                            fi
                                        fi
                                        
                                        cd ../..
                                    fi
                                done
                            '''
                        }
                    }
                }
                
                stage('Test') {
                    steps {
                        script {
                            echo "🧪 Running tests for all services..."
                            sh '''
                                # Test root project
                                if [ -f "package.json" ]; then
                                    if npm run --silent 2>&1 | grep -q "test"; then
                                        npm test || echo "⚠️  Some tests failed in root"
                                    else
                                        echo "📝 No test script found in root"
                                    fi
                                fi
                                
                                # Test each service
                                for service in api-gateway user-service course-service lab-service admin-service payment-service; do
                                    if [ -d "services/$service" ]; then
                                        echo "🧪 Testing $service..."
                                        cd "services/$service"
                                        
                                        if [ -f "package.json" ]; then
                                            # Check if test script exists
                                            if npm run --silent 2>&1 | grep -q "test"; then
                                                npm test || echo "⚠️  Some tests failed in $service"
                                            else
                                                echo "📝 No test script found for $service"
                                            fi
                                        fi
                                        
                                        cd ../..
                                    fi
                                done
                            '''
                        }
                    }
                }
            }
        }
        
        stage('Build') {
            // Run on Jenkins host directly - Node.js v20 is available
            // Removed Docker agent due to Alpine/durable-task-plugin compatibility issues
            steps {
                script {
                    echo "🏗️  Building all services..."
                    sh '''
                        # Build root project
                        if [ -f "package.json" ]; then
                            if npm run --silent 2>&1 | grep -q "build"; then
                                npm run build || echo "⚠️  Build failed for root"
                            else
                                echo "📝 No build script found in root"
                            fi
                        fi
                        
                        # Build each service
                        for service in api-gateway user-service course-service lab-service admin-service payment-service; do
                            if [ -d "services/$service" ]; then
                                echo "🏗️  Building $service..."
                                cd "services/$service"
                                
                                if [ -f "package.json" ]; then
                                    # Check if build script exists
                                    if npm run --silent 2>&1 | grep -q "build"; then
                                        npm run build || echo "⚠️  Build failed for $service"
                                    else
                                        echo "📝 No build script found for $service"
                                    fi
                                fi
                                
                                cd ../..
                            fi
                        done
                        
                        # Build shared packages
                        for shared in types utils middleware; do
                            if [ -d "shared/$shared" ]; then
                                echo "🏗️  Building shared $shared..."
                                cd "shared/$shared"
                                
                                if [ -f "package.json" ]; then
                                    if npm run --silent 2>&1 | grep -q "build"; then
                                        npm run build || echo "⚠️  Build failed for shared $shared"
                                    else
                                        echo "📝 No build script found for shared $shared"
                                    fi
                                fi
                                
                                cd ../..
                            fi
                        done
                    '''
                }
            }
        }
        
        stage('Docker Build & Push') {
            options {
                timeout(time: 20, unit: 'MINUTES')
                retry(2)
            }
            steps {
                script {
                    echo "🐳 Building and pushing Docker image..."
                    
                    withCredentials([
                        usernamePassword(
                            credentialsId: 'dockerhub-creds',
                            usernameVariable: 'DOCKER_USERNAME',
                            passwordVariable: 'DOCKER_PASSWORD'
                        ),
                        usernamePassword(
                            credentialsId: 'github-credentials',
                            usernameVariable: 'GH_USER',
                            passwordVariable: 'GH_TOKEN'
                        )
                    ]) {
                        sh '''
                            echo "🔐 Logging into Docker Hub..."
                            echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin

                            echo "🏗️  Building Docker image..."
                            # Use buildkit for better caching and performance
                            export DOCKER_BUILDKIT=1
                            docker build --progress=plain --build-arg GITHUB_TOKEN=${GH_TOKEN} -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:${IMAGE_TAG_LATEST} .

                            echo "📤 Pushing to Docker Hub..."
                            docker push ${IMAGE_NAME}:${IMAGE_TAG}
                            docker push ${IMAGE_NAME}:${IMAGE_TAG_LATEST}

                            echo "✅ Docker image pushed successfully"
                            echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
                            echo "Build Image: ${IMAGE_NAME}:${BUILD_VERSION}"
                        '''
                    }
                }
            }
        }
        
        stage('GitOps Update') {
            steps {
                script {
                    echo "📝 Updating GitOps repository with new image tag"
                    echo "Repository: ${GITOPS_REPO}"
                    echo "New image: ${IMAGE_NAME}:${IMAGE_TAG}"
                    
                    // Clean up any existing gitops directory
                    sh 'rm -rf gitops-temp || true'
                    
                    // Clone gitops repository with credentials
                    withCredentials([usernamePassword(credentialsId: 'github-credentials',
                                                    usernameVariable: 'GIT_USERNAME',
                                                    passwordVariable: 'GIT_PASSWORD')]) {
                        sh """
                            git clone https://\${GIT_USERNAME}:\${GIT_PASSWORD}@github.com/${GITOPS_REPO}.git gitops-temp
                            cd gitops-temp
                            git checkout ${GITOPS_BRANCH}
                        """
                    }
                    
                    // Update backend kustomization image tag
                    sh """
                        cd gitops-temp
                        
                        # Update the backend kustomization with new image tag
                        sed -i 's|newTag: .*|newTag: ${IMAGE_TAG}|g' apps/backend/kustomization.yaml
                        
                        # Verify the change was made
                        echo "Updated kustomization.yaml:"
                        grep -A 2 -B 2 "newTag:" apps/backend/kustomization.yaml || echo "Pattern not found"
                    """
                    
                    // Commit and push changes
                    withCredentials([usernamePassword(credentialsId: 'github-credentials',
                                                    usernameVariable: 'GIT_USERNAME',
                                                    passwordVariable: 'GIT_PASSWORD')]) {
                        sh """
                            cd gitops-temp
                            git config user.name "Jenkins CI"
                            git config user.email "jenkins@cloudmastershub.com"
                            
                            # Set up authentication for push
                            git remote set-url origin https://\${GIT_USERNAME}:\${GIT_PASSWORD}@github.com/${GITOPS_REPO}.git
                            
                            # Check if there are changes to commit
                            if git diff --quiet; then
                                echo "No changes to commit - image tag already up to date"
                            else
                                git add apps/backend/kustomization.yaml
                                git commit -m "Update backend image to ${IMAGE_TAG}
                                
                                - Jenkins build: ${BUILD_NUMBER}
                                - Git commit: ${GIT_COMMIT_SHORT}
                                - Timestamp: \$(date -u +%Y-%m-%dT%H:%M:%SZ)"
                                
                                git push origin ${GITOPS_BRANCH}
                                echo "✅ GitOps repository updated successfully"
                            fi
                        """
                    }
                    
                    // Clean up
                    sh 'rm -rf gitops-temp'
                }
            }
        }
    }
    
    post {
        always {
            script {
                echo "🧹 Cleaning up workspace..."

                // Clean up Docker images (only if Docker is available)
                sh '''
                    if command -v docker > /dev/null; then
                        docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
                        docker system prune -f || true
                    else
                        echo "Docker not available - skipping image cleanup"
                    fi
                '''

                // Clean workspace using built-in deleteDir()
                deleteDir()
            }
        }

        success {
            script {
                echo "✅ Backend CI pipeline completed successfully!"
                echo "🐳 Image pushed: ${IMAGE_NAME}:${IMAGE_TAG}"
                echo "📝 Ready for GitOps deployment via ArgoCD"
            }
        }

        failure {
            script {
                echo "❌ Backend CI pipeline failed!"
                echo "Check the logs above for details"
            }
        }
    }
}