# Payment Service Testing Guide

## 🚀 Quick Start Testing

### Prerequisites
1. Docker installed and running
2. Stripe CLI installed and logged in
3. Node.js installed

### Step-by-Step Testing Process

#### 1. Start Development Environment

```bash
# Terminal 1: Start databases
cd BackEnd
docker compose -f docker-compose.dev.yml up -d postgres mongodb redis

# Create payment database
docker exec -it cloudmastershub-postgres psql -U cloudmaster -d cloudmastershub_users -c "CREATE DATABASE cloudmastershub_payments;"
```

#### 2. Setup Payment Service

```bash
# Terminal 2: Payment service setup
cd BackEnd/services/payment-service
npm install
npm run db:setup  # Run migrations
```

#### 3. Configure Stripe Webhook

```bash
# Terminal 3: Start Stripe webhook forwarding
stripe listen --forward-to localhost:3004/api/webhooks/stripe

# Copy the webhook secret (whsec_xxxxx) and add to your .env file
```

#### 4. Start Payment Service

```bash
# Terminal 2: Start the service
npm run dev
```

#### 5. Run Tests

```bash
# Terminal 4: Run test scripts
cd BackEnd/services/payment-service

# Basic integration test
node scripts/test-stripe.js

# Interactive checkout test
node scripts/test-checkout.js
```

## 🧪 Test Scenarios

### 1. Basic Health Check
```bash
curl http://localhost:3004/api/health
```

### 2. Fetch Subscription Plans
```bash
curl http://localhost:3004/api/subscriptions/plans
```

### 3. Test Webhook Reception
Watch Terminal 3 (Stripe CLI) for events when:
- Creating checkout sessions
- Completing test payments
- Canceling subscriptions

### 4. Complete Payment Flow
1. Run `node scripts/test-checkout.js`
2. Select a subscription plan
3. Open the checkout URL in browser
4. Use test card: `4242 4242 4242 4242`
5. Watch webhook events in Stripe CLI

## 📊 Monitoring

### Check Logs
- Payment Service logs: Terminal 2
- Webhook events: Terminal 3
- Database queries: Enable debug logging

### Verify Database
```bash
# Connect to database
docker exec -it cloudmastershub-postgres psql -U cloudmaster -d cloudmastershub_payments

# Check tables
\dt

# View subscriptions
SELECT * FROM subscriptions;

# View payments
SELECT * FROM payments;
```

## 🃏 Test Cards

| Scenario | Card Number | Additional Info |
|----------|-------------|-----------------|
| Success | 4242 4242 4242 4242 | Any future date, any CVC |
| Requires Authentication | 4000 0025 0000 3155 | 3D Secure test |
| Declined | 4000 0000 0000 9995 | Card declined |
| Insufficient Funds | 4000 0000 0000 9995 | Payment fails |

## 🐛 Troubleshooting

### Service Won't Start
- Check `.env` file has all required variables
- Ensure databases are running: `docker ps`
- Check port 3004 is not in use: `lsof -i :3004`

### Webhook Errors
- Verify webhook secret in `.env` matches Stripe CLI output
- Check Stripe CLI is running and forwarding to correct URL
- Look for signature verification errors in logs

### Database Connection Issues
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check connection string in `.env`
- Ensure payment database exists

### Stripe API Errors
- Verify secret key starts with `sk_test_`
- Check Stripe Dashboard for API logs
- Ensure test mode is enabled

## 📝 Test Checklist

- [ ] Payment service starts without errors
- [ ] Health endpoint returns 200 OK
- [ ] Subscription plans load from database
- [ ] Checkout session creates successfully
- [ ] Webhook receives and processes events
- [ ] Database stores subscription data
- [ ] Redis caches plan data
- [ ] Error handling works correctly

## 🔍 Next Steps

After successful testing:
1. Implement remaining payment methods
2. Add subscription management UI
3. Set up monitoring and alerts
4. Configure production environment
5. Plan for PCI compliance