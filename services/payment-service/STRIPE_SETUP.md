# Stripe Integration Setup Guide

## 🔐 Security Best Practices for Stripe Credentials

### Never Commit Secrets
- **NEVER** commit actual Stripe keys to version control
- Always use environment variables for sensitive data
- Use `.env` files for local development (already in .gitignore)
- Use secure secret management for production (Kubernetes Secrets, AWS Secrets Manager, etc.)

### Environment Setup

#### Local Development
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Stripe test keys to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_KEY
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_WEBHOOK_SECRET
   STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_PUBLISHABLE_KEY
   ```

3. **IMPORTANT**: The `.env` file is gitignored and will NOT be committed

#### Production Deployment

##### Option 1: Kubernetes Secrets (Recommended)
```bash
# Create secret from command line
kubectl create secret generic stripe-secrets \
  --from-literal=STRIPE_SECRET_KEY='sk_live_YOUR_LIVE_KEY' \
  --from-literal=STRIPE_WEBHOOK_SECRET='whsec_YOUR_WEBHOOK_SECRET' \
  --from-literal=STRIPE_PUBLISHABLE_KEY='pk_live_YOUR_LIVE_KEY' \
  -n cloudmastershub-prod

# Or create from file
kubectl create secret generic stripe-secrets \
  --from-env-file=.env.production \
  -n cloudmastershub-prod
```

##### Option 2: Environment Variables in CI/CD
- Store secrets in Jenkins/GitHub Actions secrets
- Inject during build/deployment process
- Never log or echo secret values

##### Option 3: Cloud Secret Managers
- AWS Secrets Manager
- Azure Key Vault
- Google Secret Manager
- HashiCorp Vault

### Webhook Setup

1. **Local Development** (using Stripe CLI):
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe

   # Login to Stripe
   stripe login

   # Forward webhooks to local service
   stripe listen --forward-to localhost:3004/api/webhooks/stripe

   # Copy the webhook signing secret and add to .env
   ```

2. **Production Setup**:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://api.cloudmastershub.com/api/webhooks/stripe`
   - Select events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the signing secret to your production secrets

### Testing Stripe Integration

1. **Test Mode Keys** (Safe for development):
   - Always use `sk_test_` and `pk_test_` prefixed keys for development
   - Test mode transactions don't charge real cards
   - Use Stripe's test card numbers (e.g., 4242 4242 4242 4242)

2. **Production Keys** (Handle with care):
   - Live keys start with `sk_live_` and `pk_live_`
   - Only use in production environment
   - Restrict access to team members who need it
   - Enable API key rolling in Stripe Dashboard

### Security Checklist

- [ ] `.env` file is NOT tracked in git
- [ ] No secrets in code comments or logs
- [ ] Using test keys for development
- [ ] Production secrets stored securely
- [ ] Webhook signature validation enabled
- [ ] API keys have appropriate restrictions
- [ ] Regular key rotation scheduled
- [ ] Audit logs enabled in Stripe Dashboard

### Emergency Procedures

If keys are accidentally exposed:
1. Immediately roll the keys in Stripe Dashboard
2. Update all environments with new keys
3. Check Stripe logs for unauthorized usage
4. Notify security team
5. Review and update security practices

### Additional Resources

- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)
- [Stripe API Keys Documentation](https://stripe.com/docs/keys)
- [Webhook Security](https://stripe.com/docs/webhooks/best-practices)