import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { constructWebhookEvent } from '../services/stripe.service';
import { publishEvent } from '../services/redis.service';

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    logger.warn('Stripe webhook received without signature');
    return res.status(400).json({
      success: false,
      message: 'Missing Stripe signature'
    });
  }

  try {
    const event = constructWebhookEvent(req.body, signature as string);
    
    logger.info(`Received Stripe webhook: ${event.type}`, {
      eventId: event.id,
      type: event.type
    });

    // Handle different webhook events
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      
      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

const handleCheckoutSessionCompleted = async (event: any) => {
  try {
    const session = event.data.object;
    const { user_id, type, plan_id } = session.metadata;

    logger.info('Processing checkout session completion', {
      sessionId: session.id,
      userId: user_id,
      type
    });

    if (type === 'subscription') {
      // TODO: Create subscription record in database
      // TODO: Grant access to user
      await publishEvent('subscription.created', {
        user_id,
        plan_id,
        subscription_id: session.subscription,
        timestamp: new Date().toISOString()
      });
    } else if (type === 'purchase') {
      // TODO: Create purchase record in database
      // TODO: Grant access to specific course/path
      await publishEvent('purchase.completed', {
        user_id,
        purchasable_type: session.metadata.purchasable_type,
        purchasable_id: session.metadata.purchasable_id,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Error handling checkout session completion:', error);
    throw error;
  }
};

const handleInvoicePaymentSucceeded = async (event: any) => {
  try {
    const invoice = event.data.object;
    logger.info('Invoice payment succeeded', { invoiceId: invoice.id });
    
    // TODO: Update payment record
    // TODO: Extend subscription if applicable
    await publishEvent('payment.succeeded', {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      amount: invoice.amount_paid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error handling invoice payment success:', error);
    throw error;
  }
};

const handleInvoicePaymentFailed = async (event: any) => {
  try {
    const invoice = event.data.object;
    logger.warn('Invoice payment failed', { invoiceId: invoice.id });
    
    // TODO: Update payment record
    // TODO: Handle subscription status change
    await publishEvent('payment.failed', {
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error handling invoice payment failure:', error);
    throw error;
  }
};

const handleSubscriptionCreated = async (event: any) => {
  try {
    const subscription = event.data.object;
    logger.info('Subscription created', { subscriptionId: subscription.id });
    
    // TODO: Create/update subscription record
    await publishEvent('subscription.created', {
      subscription_id: subscription.id,
      customer_id: subscription.customer,
      status: subscription.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error handling subscription creation:', error);
    throw error;
  }
};

const handleSubscriptionUpdated = async (event: any) => {
  try {
    const subscription = event.data.object;
    logger.info('Subscription updated', { subscriptionId: subscription.id });
    
    // TODO: Update subscription record
    await publishEvent('subscription.updated', {
      subscription_id: subscription.id,
      status: subscription.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error handling subscription update:', error);
    throw error;
  }
};

const handleSubscriptionDeleted = async (event: any) => {
  try {
    const subscription = event.data.object;
    logger.info('Subscription cancelled', { subscriptionId: subscription.id });
    
    // TODO: Update subscription record
    // TODO: Revoke access
    await publishEvent('subscription.cancelled', {
      subscription_id: subscription.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error handling subscription deletion:', error);
    throw error;
  }
};