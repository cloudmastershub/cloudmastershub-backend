import Stripe from 'stripe';
import { logger } from '@cloudmastershub/utils';

let stripe: Stripe | null = null;

export const initializeStripe = (): Stripe => {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    logger.info('Stripe service initialized');
  }
  return stripe;
};

export const getStripe = (): Stripe => {
  if (!stripe) {
    return initializeStripe();
  }
  return stripe;
};

export const createCustomer = async (params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> => {
  try {
    const stripeClient = getStripe();
    const customer = await stripeClient.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata || {},
    });
    
    logger.info(`Created Stripe customer: ${customer.id}`);
    return customer;
  } catch (error) {
    logger.error('Failed to create Stripe customer:', error);
    throw error;
  }
};

export const createCheckoutSession = async (params: {
  customer_id?: string;
  price_id: string;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, string>;
  mode?: 'payment' | 'subscription';
}): Promise<Stripe.Checkout.Session> => {
  try {
    const stripeClient = getStripe();
    const session = await stripeClient.checkout.sessions.create({
      customer: params.customer_id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.price_id,
          quantity: 1,
        },
      ],
      mode: params.mode || 'subscription',
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      metadata: params.metadata || {},
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
    });

    logger.info(`Created Stripe checkout session: ${session.id}`);
    return session;
  } catch (error) {
    logger.error('Failed to create Stripe checkout session:', error);
    throw error;
  }
};

export const createSubscription = async (params: {
  customer_id: string;
  price_id: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Subscription> => {
  try {
    const stripeClient = getStripe();
    const subscription = await stripeClient.subscriptions.create({
      customer: params.customer_id,
      items: [{ price: params.price_id }],
      metadata: params.metadata || {},
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    logger.info(`Created Stripe subscription: ${subscription.id}`);
    return subscription;
  } catch (error) {
    logger.error('Failed to create Stripe subscription:', error);
    throw error;
  }
};

export const cancelSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  try {
    const stripeClient = getStripe();
    const subscription = await stripeClient.subscriptions.cancel(subscriptionId);
    
    logger.info(`Cancelled Stripe subscription: ${subscriptionId}`);
    return subscription;
  } catch (error) {
    logger.error('Failed to cancel Stripe subscription:', error);
    throw error;
  }
};

export const retrieveSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  try {
    const stripeClient = getStripe();
    return await stripeClient.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    logger.error('Failed to retrieve Stripe subscription:', error);
    throw error;
  }
};

export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }

  try {
    const stripeClient = getStripe();
    return stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    logger.error('Failed to construct Stripe webhook event:', error);
    throw error;
  }
};