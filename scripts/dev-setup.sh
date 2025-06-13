#!/bin/bash

# CloudMastersHub Backend Development Setup Script
# This script sets up the development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing+=("Node.js")
    else
        local node_version=$(node --version | cut -d'v' -f2)
        local required_version="18.0.0"
        if ! [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" = "$required_version" ]; then
            warning "Node.js version $node_version found, but $required_version+ is recommended"
        else
            log "Node.js version $node_version ✓"
        fi
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    else
        log "npm version $(npm --version) ✓"
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing+=("Docker")
    else
        if docker info >/dev/null 2>&1; then
            log "Docker is running ✓"
        else
            warning "Docker is installed but not running"
        fi
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing+=("Docker Compose")
    else
        log "Docker Compose is available ✓"
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing prerequisites: ${missing[*]}"
        echo
        echo "Please install the missing tools:"
        echo "  Node.js: https://nodejs.org/"
        echo "  Docker: https://docs.docker.com/get-docker/"
        echo "  Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    success "All prerequisites are available"
}

# Setup environment files
setup_env_files() {
    log "Setting up environment files..."
    
    cd "${PROJECT_DIR}"
    
    local services=("api-gateway" "user-service" "course-service" "lab-service")
    
    for service in "${services[@]}"; do
        local env_file="services/${service}/.env"
        local env_example="services/${service}/.env.example"
        
        if [ -f "$env_example" ] && [ ! -f "$env_file" ]; then
            log "Creating $env_file from $env_example"
            cp "$env_example" "$env_file"
        elif [ -f "$env_file" ]; then
            log "$env_file already exists"
        fi
    done
    
    success "Environment files setup completed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    cd "${PROJECT_DIR}"
    
    # Clean install
    log "Running npm ci..."
    npm ci
    
    success "Dependencies installed"
}

# Build shared packages
build_shared() {
    log "Building shared packages..."
    
    cd "${PROJECT_DIR}"
    
    # Build in correct order
    npm run build --workspace=@cloudmastershub/types
    npm run build --workspace=@cloudmastershub/utils
    npm run build --workspace=@cloudmastershub/middleware
    
    success "Shared packages built"
}

# Setup databases with Docker
setup_databases() {
    log "Setting up development databases..."
    
    cd "${PROJECT_DIR}"
    
    # Start only database services
    log "Starting database containers..."
    docker-compose -f docker-compose.dev.yml up -d postgres mongodb redis
    
    # Wait for databases to be ready
    log "Waiting for databases to be ready..."
    
    # Wait for PostgreSQL
    log "Waiting for PostgreSQL..."
    until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres; do
        echo "PostgreSQL is starting up..."
        sleep 2
    done
    success "PostgreSQL is ready"
    
    # Wait for MongoDB
    log "Waiting for MongoDB..."
    until docker-compose -f docker-compose.dev.yml exec -T mongodb mongosh --eval "print('MongoDB is ready')"; do
        echo "MongoDB is starting up..."
        sleep 2
    done
    success "MongoDB is ready"
    
    # Wait for Redis
    log "Waiting for Redis..."
    until docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping; do
        echo "Redis is starting up..."
        sleep 2
    done
    success "Redis is ready"
    
    success "All databases are ready"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    cd "${PROJECT_DIR}"
    
    # Run linting
    log "Running ESLint..."
    npm run lint
    
    # Run type checking
    log "Running TypeScript type checking..."
    npm run typecheck
    
    # Run unit tests
    log "Running unit tests..."
    npm run test
    
    success "All tests passed"
}

# Create development scripts
create_dev_scripts() {
    log "Creating development scripts..."
    
    local scripts_dir="${PROJECT_DIR}/scripts"
    
    # Create start-dev script
    cat > "${scripts_dir}/start-dev.sh" << 'EOF'
#!/bin/bash
# Start all services in development mode

echo "Starting CloudMastersHub development environment..."

# Start databases
docker-compose -f docker-compose.dev.yml up -d postgres mongodb redis

# Wait a bit for databases
sleep 5

# Start all services
npm run dev

echo "Development environment started!"
echo "API Gateway: http://localhost:3000"
echo "User Service: http://localhost:3001"
echo "Course Service: http://localhost:3002"
echo "Lab Service: http://localhost:3003"
EOF

    chmod +x "${scripts_dir}/start-dev.sh"
    
    # Create stop-dev script
    cat > "${scripts_dir}/stop-dev.sh" << 'EOF'
#!/bin/bash
# Stop development environment

echo "Stopping CloudMastersHub development environment..."

# Stop all Docker containers
docker-compose -f docker-compose.dev.yml down

echo "Development environment stopped!"
EOF

    chmod +x "${scripts_dir}/stop-dev.sh"
    
    success "Development scripts created"
}

# Display next steps
show_next_steps() {
    echo
    success "Development environment setup completed!"
    echo
    log "Next steps:"
    echo "  1. Start development environment:"
    echo "     cd ${PROJECT_DIR}"
    echo "     ./scripts/start-dev.sh"
    echo
    echo "  2. Or start services individually:"
    echo "     npm run dev --workspace=@cloudmastershub/api-gateway"
    echo "     npm run dev --workspace=@cloudmastershub/user-service"
    echo
    echo "  3. Access services:"
    echo "     API Gateway:    http://localhost:3000"
    echo "     User Service:   http://localhost:3001"
    echo "     Course Service: http://localhost:3002"
    echo "     Lab Service:    http://localhost:3003"
    echo
    echo "  4. Database management:"
    echo "     PostgreSQL:     http://localhost:8080 (Adminer)"
    echo "     Redis:          http://localhost:8081 (Redis Commander)"
    echo "     MongoDB:        mongodb://localhost:27017"
    echo
    echo "  5. Useful commands:"
    echo "     ./scripts/build.sh               # Build Docker image"
    echo "     ./scripts/deploy.sh dev latest   # Deploy to dev environment"
    echo "     ./scripts/stop-dev.sh            # Stop development environment"
    echo
    log "Happy coding! 🚀"
}

# Main function
main() {
    log "CloudMastersHub Backend Development Setup"
    echo
    
    check_prerequisites
    setup_env_files
    install_dependencies
    build_shared
    
    # Ask user if they want to set up databases
    echo
    read -p "Do you want to set up development databases with Docker? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_databases
    fi
    
    # Ask user if they want to run tests
    echo
    read -p "Do you want to run tests to verify the setup? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_tests
    fi
    
    create_dev_scripts
    show_next_steps
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [action]"
        echo
        echo "Actions:"
        echo "  setup      Full development setup (default)"
        echo "  deps       Install dependencies only"
        echo "  env        Setup environment files only"
        echo "  db         Setup databases only"
        echo "  test       Run tests only"
        echo "  clean      Clean up development environment"
        echo
        echo "Examples:"
        echo "  $0           # Full setup"
        echo "  $0 deps      # Install dependencies only"
        echo "  $0 clean     # Clean up"
        exit 0
        ;;
    "deps")
        install_dependencies
        exit 0
        ;;
    "env")
        setup_env_files
        exit 0
        ;;
    "db")
        setup_databases
        exit 0
        ;;
    "test")
        run_tests
        exit 0
        ;;
    "clean")
        log "Cleaning up development environment..."
        cd "${PROJECT_DIR}"
        docker-compose -f docker-compose.dev.yml down -v
        rm -rf node_modules
        rm -rf */node_modules
        rm -rf dist
        rm -rf */dist
        success "Cleanup completed"
        exit 0
        ;;
esac

# Run main function
main