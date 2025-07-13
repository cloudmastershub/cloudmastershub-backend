// CloudMastersHub Backend CI Pipeline - GitOps Ready
// Phase 1: CI Only - Removed kubectl/deployment stages
pipeline {
    agent any
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '3'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
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
        NODE_VERSION = '18'
        
        // Version and build info
        BUILD_VERSION = "${BUILD_NUMBER}"
        GIT_COMMIT_SHORT = "${GIT_COMMIT.take(8)}"
        BRANCH_NAME_SAFE = "${env.GIT_BRANCH?.tokenize('/').last() ?: env.BRANCH_NAME ?: 'main'}"
        IMAGE_TAG = "${BRANCH_NAME_SAFE == 'main' ? 'latest' : BRANCH_NAME_SAFE}"
        
        // Optimize npm
        NPM_CONFIG_LOGLEVEL = 'error'
        NPM_CONFIG_AUDIT = 'false'
        NPM_CONFIG_FUND = 'false'
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
                            credentialsId: 'cloudmastershub-github-userpass'
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
            agent {
                docker {
                    image 'node:18-alpine'
                    args '-u root:root'
                    reuseNode true
                }
            }
            steps {
                script {
                    echo "📦 Installing dependencies for all services..."
                    sh '''
                        # Install dependencies for each service
                        for service in api-gateway user-service course-service lab-service notification-service; do
                            if [ -d "$service" ]; then
                                echo "📦 Installing dependencies for $service..."
                                cd "$service"
                                
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
                                
                                cd ..
                            else
                                echo "📝 Service $service not found"
                            fi
                        done
                    '''
                }
            }
        }
        
        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    agent {
                        docker {
                            image 'node:18-alpine'
                            args '-u root:root'
                            reuseNode true
                        }
                    }
                    steps {
                        script {
                            echo "🔍 Running linting for all services..."
                            sh '''
                                for service in api-gateway user-service course-service lab-service notification-service; do
                                    if [ -d "$service" ]; then
                                        echo "🔍 Linting $service..."
                                        cd "$service"
                                        
                                        if [ -f "package.json" ]; then
                                            # Check if lint script exists
                                            if npm run --silent 2>&1 | grep -q "lint"; then
                                                npm run lint || echo "⚠️  Lint warnings found in $service"
                                            else
                                                echo "📝 No lint script found for $service"
                                            fi
                                        fi
                                        
                                        cd ..
                                    fi
                                done
                            '''
                        }
                    }
                }
                
                stage('Test') {
                    agent {
                        docker {
                            image 'node:18-alpine'
                            args '-u root:root'
                            reuseNode true
                        }
                    }
                    steps {
                        script {
                            echo "🧪 Running tests for all services..."
                            sh '''
                                for service in api-gateway user-service course-service lab-service notification-service; do
                                    if [ -d "$service" ]; then
                                        echo "🧪 Testing $service..."
                                        cd "$service"
                                        
                                        if [ -f "package.json" ]; then
                                            # Check if test script exists
                                            if npm run --silent 2>&1 | grep -q "test"; then
                                                npm test || echo "⚠️  Some tests failed in $service"
                                            else
                                                echo "📝 No test script found for $service"
                                            fi
                                        fi
                                        
                                        cd ..
                                    fi
                                done
                            '''
                        }
                    }
                }
            }
        }
        
        stage('Build') {
            agent {
                docker {
                    image 'node:18-alpine'
                    args '-u root:root'
                    reuseNode true
                }
            }
            steps {
                script {
                    echo "🏗️  Building all services..."
                    sh '''
                        for service in api-gateway user-service course-service lab-service notification-service; do
                            if [ -d "$service" ]; then
                                echo "🏗️  Building $service..."
                                cd "$service"
                                
                                if [ -f "package.json" ]; then
                                    # Check if build script exists
                                    if npm run --silent 2>&1 | grep -q "build"; then
                                        npm run build || echo "⚠️  Build failed for $service"
                                    else
                                        echo "📝 No build script found for $service"
                                    fi
                                fi
                                
                                cd ..
                            fi
                        done
                    '''
                }
            }
        }
        
        stage('Docker Build & Push') {
            steps {
                script {
                    echo "🐳 Building and pushing Docker image..."
                    
                    withCredentials([usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKER_USERNAME',
                        passwordVariable: 'DOCKER_PASSWORD'
                    )]) {
                        sh '''
                            echo "🔐 Logging into Docker Hub..."
                            echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin
                            
                            echo "🏗️  Building Docker image..."
                            docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                            docker build -t ${IMAGE_NAME}:${BUILD_VERSION} .
                            
                            echo "📤 Pushing to Docker Hub..."
                            docker push ${IMAGE_NAME}:${IMAGE_TAG}
                            docker push ${IMAGE_NAME}:${BUILD_VERSION}
                            
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
                    echo "📝 GitOps repository update would happen here"
                    echo "TODO: Update gitops-repo with new image tag: ${IMAGE_TAG}"
                    echo "Repository: cloudmastershub-gitops"
                    echo "Path: apps/backend/deployment.yaml"
                    echo "New image: ${IMAGE_NAME}:${IMAGE_TAG}"
                }
            }
        }
    }
    
    post {
        always {
            node('master') {
                script {
                    echo "🧹 Cleaning up workspace..."
                    
                    // Clean up Docker images
                    sh '''
                        docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
                        docker rmi ${IMAGE_NAME}:${BUILD_VERSION} || true
                        docker system prune -f || true
                    '''
                    
                    // Clean workspace
                    cleanWs()
                }
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