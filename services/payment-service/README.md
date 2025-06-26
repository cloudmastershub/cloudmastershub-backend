# CloudMastersHub Payment Service

The Payment Service handles all payment processing, subscription management, and billing for the CloudMastersHub platform.

## Features

- **Subscription Management**: Platform-wide subscriptions (Free, Premium, Enterprise)
- **Individual Purchases**: One-time course and learning path purchases
- **Payment Processing**: Stripe integration with webhook handling
- **Access Control**: Centralized user access management
- **Billing**: Automated invoice generation and payment tracking

## Technology Stack

- **Framework**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with UUID primary keys
- **Cache**: Redis for session and access caching
- **Payment Provider**: Stripe
- **Authentication**: JWT-based auth (shared with other services)

## Database Schema

### Core Tables

- `subscription_plans`: Available subscription tiers
- `subscriptions`: User subscription records
- `payments`: Payment transaction history
- `payment_methods`: Stored user payment methods
- `purchases`: Individual course/path purchases
- `user_access`: Centralized access control mapping
- `invoices`: Billing invoices

## API Endpoints

### Subscription Management
```
GET    /subscriptions/plans              # List available plans
GET    /subscriptions/status/:userId     # Get user subscription status
POST   /subscriptions/checkout-session   # Create Stripe checkout
POST   /subscriptions/create             # Direct subscription creation
POST   /subscriptions/:id/cancel         # Cancel subscription
```

### Payment Management
```
GET    /payments/history/:userId         # Payment history
GET    /payments/methods/:userId         # List payment methods
POST   /payments/methods                 # Add payment method
DELETE /payments/methods/:id             # Remove payment method
POST   /payments/methods/:id/default     # Set default method
```

### Individual Purchases
```
POST   /purchases/create                 # Purchase course/path
GET    /purchases/history/:userId        # Purchase history
GET    /purchases/:id/status             # Purchase status
```

### Webhooks
```
POST   /webhooks/stripe                  # Stripe webhook handler
```

### Health Checks
```
GET    /health                           # Service health
GET    /health/liveness                  # Kubernetes liveness probe
GET    /health/readiness                 # Kubernetes readiness probe
```

## Setup Instructions

### 1. Environment Variables

Create a `.env` file with:

```bash
# Service Configuration
PORT=3004
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cloudmastershub
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cloudmastershub
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379/3

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# JWT Authentication (shared with other services)
JWT_SECRET=your-jwt-secret

# CORS
CORS_ORIGIN=http://localhost:3000,https://cloudmastershub.com
```

### 2. Database Setup

Run the database migrations:

```bash
# Setup database tables and seed data
npm run db:setup

# Or run manually
node scripts/setup-database.js
```

### 3. Stripe Configuration

1. Create Stripe products and prices:
   - Premium Monthly: $39/month
   - Premium Annual: $348/year ($29/month)
   - Enterprise: $99/month

2. Update subscription plans with Stripe price IDs:
   ```sql
   UPDATE subscription_plans SET stripe_price_id = 'price_premium_monthly' WHERE name = 'Premium';
   UPDATE subscription_plans SET stripe_price_id = 'price_premium_annual' WHERE name = 'Premium Annual';
   UPDATE subscription_plans SET stripe_price_id = 'price_enterprise' WHERE name = 'Enterprise';
   ```

3. Configure Stripe webhooks to point to `/webhooks/stripe`

### 4. Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check
```

## Deployment

### Docker

The service is included in the main CloudMastersHub Docker image:

```bash
# Build
docker build -t cloudmastershub-backend .

# Run payment service
docker run -e SERVICE_NAME=payment-service -p 3004:3004 cloudmastershub-backend
```

### Kubernetes

Deploy using the provided manifests:

```bash
# Deploy payment service
kubectl apply -f k8s/microservices-deployment.yaml

# Check status
kubectl get pods -l service=payment-service -n cloudmastershub-dev
```

## Monitoring

The service provides comprehensive health checks:

- **Liveness**: Basic service responsiveness
- **Readiness**: Database and Redis connectivity
- **Health**: Detailed component status including Stripe configuration

## Security

- **Non-root containers**: Runs as user ID 1001
- **Read-only filesystem**: Prevents runtime modifications
- **No privilege escalation**: Security-hardened containers
- **Webhook verification**: Stripe signature validation
- **JWT authentication**: Secure inter-service communication

## Integration with Other Services

### Event-Driven Communication

The payment service publishes events via Redis pub/sub:

- `subscription.created`
- `subscription.updated`
- `subscription.cancelled`
- `payment.succeeded`
- `payment.failed`
- `purchase.completed`

### Service Dependencies

- **User Service**: User authentication and profile data
- **Course Service**: Course and learning path information
- **API Gateway**: Request routing and authentication
- **Redis**: Caching and event publishing
- **PostgreSQL**: Data persistence

## Access Control Logic

The service implements a flexible access control system:

1. **Platform Subscriptions**: Grant access to all standard content
2. **Individual Purchases**: Grant access to specific courses/paths
3. **Trials**: Temporary access with expiration
4. **Promotions**: Special access grants

Access is determined by querying the `user_access` table, which consolidates all access grants from various sources.

## Troubleshooting

### Common Issues

1. **Database Connection**: Verify PostgreSQL is running and credentials are correct
2. **Redis Connection**: Check Redis service availability
3. **Stripe Webhooks**: Verify webhook URL and secret configuration
4. **JWT Verification**: Ensure JWT_SECRET matches other services

### Logs

Check service logs for detailed error information:

```bash
# Kubernetes
kubectl logs -f deployment/cloudmastershub-payment-service -n cloudmastershub-dev

# Docker
docker logs payment-service-container
```

## Development Roadmap

- [ ] Implement complete Stripe integration
- [ ] Add payment method management
- [ ] Create subscription upgrade/downgrade flows
- [ ] Add refund processing
- [ ] Implement usage-based billing
- [ ] Add payment analytics dashboard
- [ ] Create admin interface for payment management