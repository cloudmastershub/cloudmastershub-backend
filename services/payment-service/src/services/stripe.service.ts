import Stripe from 'stripe';
import { logger } from '@cloudmastershub/utils';
import {
  createStripeClient,
  createCustomer as libCreateCustomer,
  createCheckoutSession as libCreateCheckoutSession,
  createSubscription as libCreateSubscription,
  getSubscription as libGetSubscription,
  cancelSubscription as libCancelSubscription,
  pauseSubscription as libPauseSubscription,
  resumeSubscription as libResumeSubscription,
  extendTrial as libExtendTrial,
  verifyWebhookSignature,
} from '@elites-systems/payments';

// Initialize client once — replaces the old singleton
const stripe = createStripeClient({
  apiKey: process.env.STRIPE_SECRET_KEY!,
});

logger.info('Stripe service initialized via @elites-systems/payments');

export const getStripe = (): Stripe => stripe;

// Thin wrappers that inject the stripe client and map parameter names
// to preserve the existing API surface for all controllers

export const createCustomer = async (params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> => {
  return libCreateCustomer(stripe, params);
};

export const createCheckoutSession = async (params: {
  customer_id?: string;
  price_id: string;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  mode?: 'payment' | 'subscription';
  trial_period_days?: number;
}): Promise<Stripe.Checkout.Session> => {
  return libCreateCheckoutSession(stripe, {
    customerId: params.customer_id || '',
    priceId: params.price_id,
    successUrl: params.success_url,
    cancelUrl: params.cancel_url,
    mode: params.mode || 'subscription',
    metadata: params.metadata,
    trialPeriodDays: params.trial_period_days,
  });
};

export const createSubscription = async (params: {
  customer_id: string;
  price_id: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Subscription> => {
  return libCreateSubscription(stripe, {
    customerId: params.customer_id,
    priceId: params.price_id,
    metadata: params.metadata,
  });
};

export const cancelSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  return libCancelSubscription(stripe, subscriptionId);
};

export const retrieveSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  return libGetSubscription(stripe, subscriptionId);
};

export const pauseSubscription = async (
  subscriptionId: string,
  behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void' = 'mark_uncollectible'
): Promise<Stripe.Subscription> => {
  return libPauseSubscription(stripe, subscriptionId, behavior);
};

export const resumeSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  return libResumeSubscription(stripe, subscriptionId);
};

export const extendTrialPeriod = async (
  subscriptionId: string,
  newTrialEnd: number | 'now'
): Promise<Stripe.Subscription> => {
  const trialEndDate = newTrialEnd === 'now' ? new Date() : new Date(newTrialEnd * 1000);
  return libExtendTrial(stripe, subscriptionId, trialEndDate);
};

export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }
  return verifyWebhookSignature(stripe, payload, signature, webhookSecret);
};
