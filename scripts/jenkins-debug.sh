#!/bin/bash

# Jenkins Environment Debug Script
# Run this script in Jenkins to diagnose environment issues

set -e

echo "=== CloudMastersHub Jenkins Environment Debug ==="
echo "Timestamp: $(date)"
echo "Hostname: $(hostname)"
echo "User: $(whoami)"
echo "Working Directory: $(pwd)"
echo

# Check system information
echo "=== System Information ==="
echo "OS: $(uname -a)"
echo "Memory: $(free -h | head -2)"
echo "Disk Space: $(df -h . | tail -1)"
echo

# Check required tools
echo "=== Required Tools Check ==="

# Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js: Not found"
fi

# NPM
if command -v npm &> /dev/null; then
    echo "✅ NPM: $(npm --version)"
else
    echo "❌ NPM: Not found"
fi

# Git
if command -v git &> /dev/null; then
    echo "✅ Git: $(git --version)"
else
    echo "❌ Git: Not found"
fi

# Docker
if command -v docker &> /dev/null; then
    echo "✅ Docker: $(docker --version)"
    if docker info &> /dev/null; then
        echo "✅ Docker Daemon: Running"
    else
        echo "❌ Docker Daemon: Not accessible"
    fi
else
    echo "❌ Docker: Not found"
fi

# Kubectl
if command -v kubectl &> /dev/null; then
    echo "✅ Kubectl: $(kubectl version --client --short 2>/dev/null || echo 'Version check failed')"
else
    echo "❌ Kubectl: Not found"
fi

# Trivy
if command -v trivy &> /dev/null; then
    echo "✅ Trivy: $(trivy --version | head -1)"
else
    echo "❌ Trivy: Not found (optional)"
fi

echo

# Check environment variables
echo "=== Environment Variables ==="
echo "WORKSPACE: ${WORKSPACE:-'Not set'}"
echo "BUILD_NUMBER: ${BUILD_NUMBER:-'Not set'}"
echo "BUILD_URL: ${BUILD_URL:-'Not set'}"
echo "JOB_NAME: ${JOB_NAME:-'Not set'}"
echo "BRANCH_NAME: ${BRANCH_NAME:-'Not set'}"
echo "NODE_ENV: ${NODE_ENV:-'Not set'}"
echo "PATH: ${PATH}"
echo

# Check Jenkins-specific directories
echo "=== Jenkins Directories ==="
echo "Jenkins Home: ${JENKINS_HOME:-'Not set'}"
echo "Jenkins Workspace: ${WORKSPACE:-'Not set'}"
if [ -n "${WORKSPACE}" ] && [ -d "${WORKSPACE}" ]; then
    echo "Workspace Contents: $(ls -la ${WORKSPACE} | wc -l) items"
    echo "Workspace Size: $(du -sh ${WORKSPACE} 2>/dev/null || echo 'Cannot calculate')"
fi
echo

# Check network connectivity
echo "=== Network Connectivity ==="
if ping -c 1 google.com &> /dev/null; then
    echo "✅ Internet: Connected"
else
    echo "❌ Internet: No connectivity"
fi

if ping -c 1 registry-1.docker.io &> /dev/null; then
    echo "✅ Docker Hub: Accessible"
else
    echo "❌ Docker Hub: Not accessible"
fi

if command -v curl &> /dev/null; then
    if curl -s https://api.github.com/zen &> /dev/null; then
        echo "✅ GitHub API: Accessible"
    else
        echo "❌ GitHub API: Not accessible"
    fi
else
    echo "❌ curl: Not available for testing"
fi
echo

# Check Git repository
echo "=== Git Repository Check ==="
if [ -d ".git" ]; then
    echo "✅ Git Repository: Found"
    echo "Current Branch: $(git branch --show-current 2>/dev/null || echo 'Cannot determine')"
    echo "Current Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'Cannot determine')"
    echo "Remote URL: $(git remote get-url origin 2>/dev/null || echo 'Cannot determine')"
    echo "Git Status: $(git status --porcelain | wc -l) modified files"
else
    echo "❌ Git Repository: Not found"
fi
echo

# Check project structure
echo "=== Project Structure Check ==="
if [ -f "package.json" ]; then
    echo "✅ package.json: Found"
    echo "Project Name: $(cat package.json | grep '"name"' | head -1 | cut -d'"' -f4 2>/dev/null || echo 'Cannot parse')"
    echo "Workspaces: $(cat package.json | grep '"workspaces"' | wc -l)"
else
    echo "❌ package.json: Not found"
fi

if [ -f "Dockerfile" ]; then
    echo "✅ Dockerfile: Found"
else
    echo "❌ Dockerfile: Not found"
fi

if [ -f "Jenkinsfile" ]; then
    echo "✅ Jenkinsfile: Found"
else
    echo "❌ Jenkinsfile: Not found"
fi

if [ -d "services" ]; then
    echo "✅ Services Directory: Found ($(ls services | wc -l) services)"
    echo "Services: $(ls services | tr '\n' ' ')"
else
    echo "❌ Services Directory: Not found"
fi

if [ -d "k8s" ]; then
    echo "✅ Kubernetes Directory: Found ($(ls k8s/*.yaml 2>/dev/null | wc -l) manifests)"
else
    echo "❌ Kubernetes Directory: Not found"
fi
echo

# Check npm configuration
echo "=== NPM Configuration ==="
if command -v npm &> /dev/null; then
    echo "NPM Config List:"
    npm config list | head -10
    echo "NPM Registry: $(npm config get registry)"
    echo "NPM Cache: $(npm config get cache)"
    echo
fi

# Check for node_modules
if [ -d "node_modules" ]; then
    echo "✅ node_modules: Found ($(ls node_modules | wc -l) packages)"
    echo "node_modules Size: $(du -sh node_modules 2>/dev/null || echo 'Cannot calculate')"
else
    echo "❌ node_modules: Not found (run npm install)"
fi
echo

# Check Docker environment
echo "=== Docker Environment ==="
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo "Docker Version: $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 'Cannot get version')"
        echo "Docker Images: $(docker images | wc -l) total"
        echo "Docker Containers: $(docker ps -a | wc -l) total ($(docker ps | wc -l) running)"
        echo "Docker Storage Driver: $(docker info --format '{{.Driver}}' 2>/dev/null || echo 'Unknown')"
        echo "Docker Disk Usage: $(docker system df 2>/dev/null || echo 'Cannot calculate')"
    fi
else
    echo "Docker not available"
fi
echo

# Check for credentials (without exposing values)
echo "=== Credentials Check ==="
echo "Note: This only checks if credential files/env vars exist, not their values"

# Check for Docker credentials
if [ -f "${HOME}/.docker/config.json" ]; then
    echo "✅ Docker config: Found at ${HOME}/.docker/config.json"
else
    echo "❌ Docker config: Not found"
fi

# Check for Kubernetes config
if [ -f "${HOME}/.kube/config" ]; then
    echo "✅ Kubernetes config: Found at ${HOME}/.kube/config"
elif [ -n "${KUBECONFIG}" ]; then
    echo "✅ KUBECONFIG env var: Set to ${KUBECONFIG}"
else
    echo "❌ Kubernetes config: Not found"
fi
echo

# Resource usage
echo "=== Resource Usage ==="
echo "CPU Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "Memory Usage: $(free | awk '/Mem:/ {printf "%.1f%%", $3/$2 * 100.0}')"
echo "Disk Usage: $(df . | awk 'NR==2 {printf "%s", $5}')"
echo

# Recommendations
echo "=== Recommendations ==="

if ! command -v node &> /dev/null; then
    echo "❗ Install Node.js 18+ for backend development"
fi

if ! command -v docker &> /dev/null; then
    echo "❗ Install Docker for containerization"
elif ! docker info &> /dev/null; then
    echo "❗ Start Docker daemon or check Docker permissions"
fi

if [ ! -d "node_modules" ]; then
    echo "❗ Run 'npm install' to install dependencies"
fi

if [ ! -f "Jenkinsfile" ]; then
    echo "❗ Jenkinsfile not found - check repository structure"
fi

echo
echo "=== Debug Complete ==="
echo "Timestamp: $(date)"
echo "Review the output above to identify any issues."
echo "For Jenkins-specific issues, check Jenkins system log and plugin configurations."