// CloudMastersHub Backend CI Pipeline - GitOps Ready
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

        // Optimize npm — persistent cache survives workspace cleanup
        NPM_CONFIG_LOGLEVEL = 'error'
        NPM_CONFIG_AUDIT = 'false'
        NPM_CONFIG_FUND = 'false'
        NPM_CONFIG_CACHE = '/var/jenkins_home/.npm-cache'
        HOME = "${WORKSPACE}"
    }

    stages {
        stage('Checkout & Setup') {
            steps {
                script {
                    echo "Starting CloudMastersHub Backend CI Pipeline"
                    echo "Branch: ${BRANCH_NAME_SAFE}"
                    echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"

                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: '*/main']],
                        userRemoteConfigs: [[
                            url: 'https://github.com/cloudmastershub/cloudmastershub-backend.git',
                            credentialsId: 'github-credentials'
                        ]]
                    ])

                    sh '''
                        node --version
                        npm --version
                    '''
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-credentials',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_PASS'
                )]) {
                    script {
                        echo "Installing dependencies for all services..."
                        timeout(time: 20, unit: 'MINUTES') {
                            sh '''
                                export NODE_AUTH_TOKEN=$GIT_PASS

                                # Single npm ci at root installs all workspace dependencies
                                npm ci --prefer-offline --no-audit --no-fund
                            '''
                        }
                    }
                }
            }
        }

        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    steps {
                        script {
                            sh '''
                                # Lint root project
                                if grep -q '"lint"' package.json; then
                                    npm run lint || echo "Lint warnings found in root"
                                fi

                                # Lint each service
                                for service in api-gateway user-service course-service lab-service admin-service payment-service; do
                                    if [ -d "services/$service" ] && grep -q '"lint"' "services/$service/package.json" 2>/dev/null; then
                                        echo "Linting $service..."
                                        npm run lint --workspace=@cloudmastershub/$service || echo "Lint warnings in $service"
                                    fi
                                done
                            '''
                        }
                    }
                }

                stage('Test') {
                    steps {
                        script {
                            sh '''
                                # Test root project
                                if grep -q '"test"' package.json; then
                                    npm test || echo "Some tests failed in root"
                                fi

                                # Test each service
                                for service in api-gateway user-service course-service lab-service admin-service payment-service; do
                                    if [ -d "services/$service" ] && grep -q '"test"' "services/$service/package.json" 2>/dev/null; then
                                        echo "Testing $service..."
                                        npm test --workspace=@cloudmastershub/$service || echo "Some tests failed in $service"
                                    fi
                                done
                            '''
                        }
                    }
                }
            }
        }

        // No host-side Build stage — Docker multi-stage build handles
        // install + build for all shared packages and services in one pass.

        stage('Docker Build & Push') {
            options {
                timeout(time: 20, unit: 'MINUTES')
                retry(2)
            }
            steps {
                script {
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
                            echo "Logging into Docker Hub..."
                            echo "${DOCKER_PASSWORD}" | docker login -u "${DOCKER_USERNAME}" --password-stdin

                            echo "Building Docker image..."
                            export DOCKER_BUILDKIT=1
                            docker build --progress=plain \
                                --build-arg GITHUB_TOKEN=${GH_TOKEN} \
                                -t ${IMAGE_NAME}:${IMAGE_TAG} \
                                -t ${IMAGE_NAME}:${IMAGE_TAG_LATEST} .

                            echo "Pushing to Docker Hub..."
                            docker push ${IMAGE_NAME}:${IMAGE_TAG}
                            docker push ${IMAGE_NAME}:${IMAGE_TAG_LATEST}

                            echo "Image pushed: ${IMAGE_NAME}:${IMAGE_TAG}"
                        '''
                    }
                }
            }
        }

        stage('GitOps Update') {
            steps {
                script {
                    echo "Updating GitOps repository with new image tag"

                    sh 'rm -rf gitops-temp || true'

                    withCredentials([usernamePassword(credentialsId: 'github-credentials',
                                                    usernameVariable: 'GIT_USERNAME',
                                                    passwordVariable: 'GIT_PASSWORD')]) {
                        sh """
                            git clone https://\${GIT_USERNAME}:\${GIT_PASSWORD}@github.com/${GITOPS_REPO}.git gitops-temp
                            cd gitops-temp
                            git checkout ${GITOPS_BRANCH}
                        """
                    }

                    sh """
                        cd gitops-temp
                        sed -i 's|newTag: .*|newTag: ${IMAGE_TAG}|g' apps/backend/kustomization.yaml
                        echo "Updated kustomization.yaml:"
                        grep -A 2 -B 2 "newTag:" apps/backend/kustomization.yaml || echo "Pattern not found"
                    """

                    withCredentials([usernamePassword(credentialsId: 'github-credentials',
                                                    usernameVariable: 'GIT_USERNAME',
                                                    passwordVariable: 'GIT_PASSWORD')]) {
                        sh """
                            cd gitops-temp
                            git config user.name "Jenkins CI"
                            git config user.email "jenkins@cloudmastershub.com"
                            git remote set-url origin https://\${GIT_USERNAME}:\${GIT_PASSWORD}@github.com/${GITOPS_REPO}.git

                            if git diff --quiet; then
                                echo "No changes to commit - image tag already up to date"
                            else
                                git add apps/backend/kustomization.yaml
                                git commit -m "Update backend image to ${IMAGE_TAG}

                                - Jenkins build: ${BUILD_NUMBER}
                                - Git commit: ${GIT_COMMIT_SHORT}
                                - Timestamp: \$(date -u +%Y-%m-%dT%H:%M:%SZ)"

                                git push origin ${GITOPS_BRANCH}
                                echo "GitOps repository updated successfully"
                            fi
                        """
                    }

                    sh 'rm -rf gitops-temp'
                }
            }
        }
    }

    post {
        always {
            script {
                sh '''
                    if command -v docker > /dev/null; then
                        # Remove only the build-specific image to free space
                        docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
                        # Remove dangling images only (fast, no full prune)
                        docker image prune -f || true
                    fi

                    # Selective cleanup — preserve npm cache (lives outside workspace)
                    rm -rf node_modules/ gitops-temp/ 2>/dev/null || true
                '''
            }
        }

        success {
            echo "Backend CI pipeline completed successfully! Image: ${IMAGE_NAME}:${IMAGE_TAG}"
        }

        failure {
            echo "Backend CI pipeline failed! Check the logs above for details."
        }
    }
}
