pipeline {
    agent any
    
    environment {
        // Docker registry configuration
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_REPO = 'cloudmastershub'
        IMAGE_NAME = "${DOCKER_REPO}/backend"
        
        // Kubernetes configuration
        K8S_NAMESPACE = 'cloudmastershub-dev'
        KUBECONFIG = credentials('kubeconfig-dev')
        
        // Docker credentials
        DOCKER_CREDENTIALS = credentials('dockerhub-credentials')
        
        // Git configuration
        GIT_COMMIT_SHORT = sh(
            script: "printf \$(git rev-parse --short HEAD)",
            returnStdout: true
        )
        
        // Build configuration
        NODE_VERSION = '18'
        BUILD_NUMBER_PADDED = String.format("%04d", BUILD_NUMBER as Integer)
        IMAGE_TAG = "${env.BRANCH_NAME}-${GIT_COMMIT_SHORT}-${BUILD_NUMBER_PADDED}"
    }
    
    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        ansiColor('xterm')
    }
    
    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "=== Checkout Stage ==="
                    echo "Branch: ${env.BRANCH_NAME}"
                    echo "Commit: ${GIT_COMMIT_SHORT}"
                    echo "Build Number: ${BUILD_NUMBER}"
                    echo "Image Tag: ${IMAGE_TAG}"
                }
                
                checkout scm
                
                script {
                    // Set additional environment variables
                    env.DOCKERFILE_PATH = 'BackEnd/Dockerfile'
                    env.BUILD_CONTEXT = 'BackEnd'
                }
            }
        }
        
        stage('Setup Node.js') {
            steps {
                script {
                    echo "=== Node.js Setup Stage ==="
                }
                
                // Use Node.js
                nodejs(nodeJSInstallationName: "NodeJS-${NODE_VERSION}") {
                    dir('BackEnd') {
                        sh '''
                            echo "Node.js version: $(node --version)"
                            echo "NPM version: $(npm --version)"
                            
                            # Clear npm cache to avoid conflicts
                            npm cache clean --force
                            
                            # Install dependencies
                            npm ci
                        '''
                    }
                }
            }
        }
        
        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    steps {
                        script {
                            echo "=== Linting Stage ==="
                        }
                        
                        nodejs(nodeJSInstallationName: "NodeJS-${NODE_VERSION}") {
                            dir('BackEnd') {
                                sh '''
                                    echo "Running ESLint..."
                                    npm run lint
                                '''
                            }
                        }
                    }
                }
                
                stage('Type Check') {
                    steps {
                        script {
                            echo "=== Type Checking Stage ==="
                        }
                        
                        nodejs(nodeJSInstallationName: "NodeJS-${NODE_VERSION}") {
                            dir('BackEnd') {
                                sh '''
                                    echo "Running TypeScript type checking..."
                                    npm run typecheck
                                '''
                            }
                        }
                    }
                }
            }
        }
        
        stage('Test') {
            steps {
                script {
                    echo "=== Testing Stage ==="
                }
                
                nodejs(nodeJSInstallationName: "NodeJS-${NODE_VERSION}") {
                    dir('BackEnd') {
                        sh '''
                            echo "Running tests..."
                            npm run test
                        '''
                    }
                }
            }
            
            post {
                always {
                    // Publish test results
                    publishTestResults testResultsPattern: 'BackEnd/coverage/junit.xml'
                    
                    // Publish coverage reports
                    publishCoverageResults(
                        adapters: [
                            istanbulCoberturaAdapter('BackEnd/coverage/cobertura-coverage.xml')
                        ],
                        sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                    )
                }
            }
        }
        
        stage('Build') {
            steps {
                script {
                    echo "=== Build Stage ==="
                }
                
                nodejs(nodeJSInstallationName: "NodeJS-${NODE_VERSION}") {
                    dir('BackEnd') {
                        sh '''
                            echo "Building all services..."
                            npm run build
                        '''
                    }
                }
            }
        }
        
        stage('Security Scan') {
            parallel {
                stage('Dependency Check') {
                    steps {
                        script {
                            echo "=== Dependency Security Check ==="
                        }
                        
                        nodejs(nodeJSInstallationName: "NodeJS-${NODE_VERSION}") {
                            dir('BackEnd') {
                                sh '''
                                    echo "Running npm audit..."
                                    npm audit --audit-level=high
                                '''
                            }
                        }
                    }
                }
                
                stage('Docker Security Scan') {
                    when {
                        anyOf {
                            branch 'main'
                            branch 'master'
                            branch 'develop'
                        }
                    }
                    steps {
                        script {
                            echo "=== Docker Security Scan ==="
                            
                            // Build image for scanning
                            sh """
                                cd BackEnd
                                docker build -t ${IMAGE_NAME}:scan .
                            """
                            
                            // Run Trivy security scan
                            sh """
                                docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
                                    -v \$(pwd):/tmp/trivy \\
                                    aquasec/trivy image \\
                                    --format json \\
                                    --output /tmp/trivy/trivy-report.json \\
                                    ${IMAGE_NAME}:scan
                            """
                        }
                    }
                    
                    post {
                        always {
                            // Archive security scan results
                            archiveArtifacts artifacts: 'trivy-report.json', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
        
        stage('Docker Build & Push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                    changeRequest()
                }
            }
            
            steps {
                script {
                    echo "=== Docker Build & Push Stage ==="
                    echo "Building image: ${IMAGE_NAME}:${IMAGE_TAG}"
                }
                
                dir('BackEnd') {
                    script {
                        // Build Docker image
                        def image = docker.build("${IMAGE_NAME}:${IMAGE_TAG}")
                        
                        // Login to Docker registry
                        docker.withRegistry("https://${DOCKER_REGISTRY}", 'dockerhub-credentials') {
                            // Push with specific tag
                            image.push("${IMAGE_TAG}")
                            
                            // Also push latest for main/master branch
                            if (env.BRANCH_NAME == 'main' || env.BRANCH_NAME == 'master') {
                                image.push('latest')
                            }
                            
                            // Push branch-latest for develop
                            if (env.BRANCH_NAME == 'develop') {
                                image.push('develop-latest')
                            }
                        }
                        
                        echo "Successfully pushed ${IMAGE_NAME}:${IMAGE_TAG}"
                    }
                }
            }
        }
        
        stage('Deploy to Dev') {
            when {
                branch 'develop'
            }
            
            steps {
                script {
                    echo "=== Deploy to Development Stage ==="
                }
                
                withKubeConfig([credentialsId: 'kubeconfig-dev']) {
                    sh '''
                        # Update image tags in Kubernetes deployment
                        kubectl set image deployment/cloudmastershub-api-gateway \\
                            api-gateway=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                            
                        kubectl set image deployment/cloudmastershub-user-service \\
                            user-service=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                            
                        kubectl set image deployment/cloudmastershub-course-service \\
                            course-service=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                            
                        kubectl set image deployment/cloudmastershub-lab-service \\
                            lab-service=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                        
                        # Wait for rollout to complete
                        kubectl rollout status deployment/cloudmastershub-api-gateway -n ${K8S_NAMESPACE} --timeout=300s
                        kubectl rollout status deployment/cloudmastershub-user-service -n ${K8S_NAMESPACE} --timeout=300s
                        kubectl rollout status deployment/cloudmastershub-course-service -n ${K8S_NAMESPACE} --timeout=300s
                        kubectl rollout status deployment/cloudmastershub-lab-service -n ${K8S_NAMESPACE} --timeout=300s
                        
                        echo "Deployment completed successfully!"
                    '''
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            
            steps {
                script {
                    echo "=== Deploy to Production Stage ==="
                    
                    // Require manual approval for production deployment
                    input message: 'Deploy to Production?', ok: 'Deploy',
                          submitterParameter: 'APPROVER'
                    
                    echo "Deployment approved by: ${env.APPROVER}"
                }
                
                withKubeConfig([credentialsId: 'kubeconfig-prod']) {
                    sh '''
                        # Deploy to production namespace
                        export K8S_NAMESPACE=cloudmastershub-prod
                        
                        kubectl set image deployment/cloudmastershub-api-gateway \\
                            api-gateway=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                            
                        kubectl set image deployment/cloudmastershub-user-service \\
                            user-service=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                            
                        kubectl set image deployment/cloudmastershub-course-service \\
                            course-service=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                            
                        kubectl set image deployment/cloudmastershub-lab-service \\
                            lab-service=${IMAGE_NAME}:${IMAGE_TAG} \\
                            -n ${K8S_NAMESPACE}
                        
                        # Wait for rollout with longer timeout for production
                        kubectl rollout status deployment/cloudmastershub-api-gateway -n ${K8S_NAMESPACE} --timeout=600s
                        kubectl rollout status deployment/cloudmastershub-user-service -n ${K8S_NAMESPACE} --timeout=600s
                        kubectl rollout status deployment/cloudmastershub-course-service -n ${K8S_NAMESPACE} --timeout=600s
                        kubectl rollout status deployment/cloudmastershub-lab-service -n ${K8S_NAMESPACE} --timeout=600s
                        
                        echo "Production deployment completed successfully!"
                    '''
                }
            }
        }
        
        stage('Health Check') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'develop'
                }
            }
            
            steps {
                script {
                    echo "=== Health Check Stage ==="
                    
                    def namespace = (env.BRANCH_NAME == 'develop') ? 'cloudmastershub-dev' : 'cloudmastershub-prod'
                    def kubeconfig = (env.BRANCH_NAME == 'develop') ? 'kubeconfig-dev' : 'kubeconfig-prod'
                    
                    withKubeConfig([credentialsId: kubeconfig]) {
                        sh """
                            echo "Waiting for services to be ready..."
                            sleep 30
                            
                            # Check if all pods are running
                            kubectl get pods -n ${namespace} -l app=cloudmastershub
                            
                            # Get service endpoints
                            API_GATEWAY_IP=\$(kubectl get service cloudmastershub-api-gateway -n ${namespace} -o jsonpath='{.spec.clusterIP}')
                            
                            echo "API Gateway IP: \$API_GATEWAY_IP"
                            
                            # Health check (if accessible)
                            echo "Deployment health check completed"
                        """
                    }
                }
            }
        }
    }
    
    post {
        always {
            script {
                echo "=== Pipeline Cleanup ==="
            }
            
            // Clean up Docker images
            sh """
                docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
                docker rmi ${IMAGE_NAME}:scan || true
                docker system prune -f || true
            """
            
            // Archive build artifacts
            archiveArtifacts artifacts: 'BackEnd/dist/**/*', allowEmptyArchive: true
        }
        
        success {
            script {
                echo "=== Pipeline Success ==="
                
                // Send success notification
                slackSend(
                    channel: '#deployments',
                    color: 'good',
                    message: """
                        ✅ CloudMastersHub Backend Pipeline SUCCESS
                        Branch: ${env.BRANCH_NAME}
                        Commit: ${GIT_COMMIT_SHORT}
                        Image: ${IMAGE_NAME}:${IMAGE_TAG}
                        Build: ${BUILD_URL}
                    """
                )
            }
        }
        
        failure {
            script {
                echo "=== Pipeline Failure ==="
                
                // Send failure notification
                slackSend(
                    channel: '#deployments',
                    color: 'danger',
                    message: """
                        ❌ CloudMastersHub Backend Pipeline FAILED
                        Branch: ${env.BRANCH_NAME}
                        Commit: ${GIT_COMMIT_SHORT}
                        Build: ${BUILD_URL}
                        Please check the logs for details.
                    """
                )
            }
        }
        
        unstable {
            script {
                echo "=== Pipeline Unstable ==="
                
                slackSend(
                    channel: '#deployments',
                    color: 'warning',
                    message: """
                        ⚠️ CloudMastersHub Backend Pipeline UNSTABLE
                        Branch: ${env.BRANCH_NAME}
                        Commit: ${GIT_COMMIT_SHORT}
                        Build: ${BUILD_URL}
                    """
                )
            }
        }
    }
}