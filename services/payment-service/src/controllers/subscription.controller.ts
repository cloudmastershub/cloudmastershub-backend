import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { AuthRequest } from '@cloudmastershub/types';
import { executeQuery, executeTransaction } from '../services/database.service';
import { setCache, getCache, deleteCache } from '../services/redis.service';
import { 
  createCheckoutSession as createStripeCheckoutSession, 
  createCustomer,
  cancelSubscription as cancelStripeSubscription,
  retrieveSubscription,
  getStripe
} from '../services/stripe.service';
import {
  SubscriptionPlan,
  Subscription,
  SubscriptionStatusResponse,
  CreateCheckoutSessionRequest,
  CreateSubscriptionRequest
} from '../models/subscription.model';
import { PoolClient } from 'pg';

export const getSubscriptionPlans = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'subscription_plans';
    let plans = await getCache<SubscriptionPlan[]>(cacheKey);

    if (!plans) {
      plans = await executeQuery<SubscriptionPlan>(
        'SELECT * FROM subscription_plans WHERE active = true ORDER BY price ASC'
      );
      await setCache(cacheKey, plans, 3600); // Cache for 1 hour
    }

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans'
    });
  }
};

export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const cacheKey = `subscription_status:${userId}`;
    
    let status = await getCache<SubscriptionStatusResponse>(cacheKey);

    if (!status) {
      // Get active subscription
      const subscriptions = await executeQuery<Subscription>(
        `SELECT s.*, sp.* FROM subscriptions s 
         JOIN subscription_plans sp ON s.plan_id = sp.id 
         WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
         ORDER BY s.created_at DESC LIMIT 1`,
        [userId]
      );

      // Get purchases
      const purchases = await executeQuery(
        'SELECT * FROM purchases WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
        [userId, 'completed']
      );

      // Get access records
      const access = await executeQuery(
        `SELECT * FROM user_access 
         WHERE user_id = $1 
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId]
      );

      status = {
        user_id: userId,
        subscription: subscriptions.length > 0 ? {
          id: subscriptions[0].id,
          plan: subscriptions[0] as any,
          status: subscriptions[0].status,
          started_at: subscriptions[0].started_at,
          expires_at: subscriptions[0].expires_at,
          trial_ends_at: subscriptions[0].trial_ends_at
        } : null,
        purchases,
        access
      };

      await setCache(cacheKey, status, 300); // Cache for 5 minutes
    }

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error fetching subscription status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription status'
    });
  }
};

export const createCheckoutSession = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as CreateCheckoutSessionRequest;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { type, plan_id, purchasable_type, purchasable_id, success_url, cancel_url } = body;

    // Validate request
    if (type === 'subscription' && !plan_id) {
      return res.status(400).json({
        success: false,
        message: 'plan_id is required for subscription checkout'
      });
    }

    if (type === 'purchase' && (!purchasable_type || !purchasable_id)) {
      return res.status(400).json({
        success: false,
        message: 'purchasable_type and purchasable_id are required for purchase checkout'
      });
    }

    let stripe_price_id!: string;
    let metadata: Record<string, string> = {
      user_id: userId,
      type
    };

    if (type === 'subscription') {
      // Get plan details
      const plans = await executeQuery<SubscriptionPlan>(
        'SELECT * FROM subscription_plans WHERE id = $1 AND active = true',
        [plan_id]
      );

      if (plans.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Subscription plan not found'
        });
      }

      stripe_price_id = plans[0].stripe_price_id;
      metadata.plan_id = plan_id!;
    } else if (type === 'purchase') {
      // Handle individual purchase
      if (!purchasable_type || !purchasable_id) {
        return res.status(400).json({
          success: false,
          message: 'purchasable_type and purchasable_id are required for purchases'
        });
      }

      // For purchases, redirect to the purchase controller
      return res.status(400).json({
        success: false,
        message: 'Use POST /api/purchases/create endpoint for individual purchases'
      });
    }

    // Get or create Stripe customer
    // First check our mapping table
    const mappingResults = await executeQuery<{stripe_customer_id: string}>(
      'SELECT stripe_customer_id FROM user_stripe_mapping WHERE user_id = $1',
      [userId]
    );

    let stripeCustomerId: string;
    
    if (mappingResults.length > 0) {
      stripeCustomerId = mappingResults[0].stripe_customer_id;
    } else {
      // For now, we'll need the user's email from the JWT or request
      // In production, this would come from the user service
      const userEmail = req.user?.email || `user-${userId}@cloudmastershub.com`;
      
      const customer = await createCustomer({
        email: userEmail,
        metadata: { user_id: userId }
      });
      
      stripeCustomerId = customer.id;
      
      // Store in our mapping table
      await executeQuery(
        'INSERT INTO user_stripe_mapping (user_id, stripe_customer_id) VALUES ($1, $2)',
        [userId, stripeCustomerId]
      );
    }

    // Create Stripe checkout session
    const session = await createStripeCheckoutSession({
      customer_id: stripeCustomerId,
      price_id: stripe_price_id,
      success_url,
      cancel_url,
      metadata,
      mode: type === 'subscription' ? 'subscription' : 'payment'
    });

    res.json({
      success: true,
      data: {
        checkout_url: session.url,
        session_id: session.id
      }
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
};

export const createSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as CreateSubscriptionRequest;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { plan_id, payment_method_id } = body;

    // Validate plan exists
    const plans = await executeQuery<SubscriptionPlan>(
      'SELECT * FROM subscription_plans WHERE id = $1 AND active = true',
      [plan_id]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    const plan = plans[0];

    // Check if user already has active subscription
    const existingSubscriptions = await executeQuery(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND status IN ($2, $3)',
      [userId, 'active', 'trialing']
    );

    if (existingSubscriptions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    // Get or create Stripe customer
    const mappingResults = await executeQuery<{stripe_customer_id: string}>(
      'SELECT stripe_customer_id FROM user_stripe_mapping WHERE user_id = $1',
      [userId]
    );

    let stripeCustomerId: string;
    
    if (mappingResults.length > 0) {
      stripeCustomerId = mappingResults[0].stripe_customer_id;
    } else {
      // For now, we'll need the user's email from the JWT or request
      const userEmail = req.user?.email || `user-${userId}@cloudmastershub.com`;
      
      const customer = await createCustomer({
        email: userEmail,
        metadata: { user_id: userId }
      });
      
      stripeCustomerId = customer.id;
      
      await executeQuery(
        'INSERT INTO user_stripe_mapping (user_id, stripe_customer_id) VALUES ($1, $2)',
        [userId, stripeCustomerId]
      );
    }

    // Attach payment method to customer if provided
    if (payment_method_id) {
      const stripe = getStripe();
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: stripeCustomerId,
      });
      
      // Set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });
    }

    // Create subscription via checkout session instead
    // This ensures proper payment confirmation flow
    res.json({
      success: false,
      message: 'Please use checkout session for subscription creation',
      data: {
        recommendation: 'Use POST /api/subscriptions/checkout-session endpoint'
      }
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription'
    });
  }
};

export const cancelSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Verify subscription belongs to user
      const subscriptions = await client.query<Subscription>(
        'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [subscriptionId, userId]
      );

      if (subscriptions.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subscriptions.rows[0];
      
      if (!['active', 'trialing'].includes(subscription.status)) {
        throw new Error('Subscription is not active');
      }

      if (!subscription.stripe_subscription_id) {
        throw new Error('No Stripe subscription ID found');
      }

      // Cancel in Stripe
      const cancelledStripeSubscription = await cancelStripeSubscription(
        subscription.stripe_subscription_id
      );

      // Update local database
      await client.query(`
        UPDATE subscriptions 
        SET 
          status = $1,
          cancelled_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, ['cancelled', subscriptionId]);

      // Revoke access
      await client.query(`
        UPDATE user_access 
        SET 
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1 
        AND access_type = 'subscription' 
        AND access_id = $2
        AND revoked_at IS NULL
      `, [userId, subscriptionId]);

      // Clear cache
      await deleteCache(`subscription_status:${userId}`);

      res.json({
        success: true,
        message: 'Subscription cancelled successfully',
        data: {
          subscription_id: subscriptionId,
          cancelled_at: new Date().toISOString(),
          effective_date: cancelledStripeSubscription.current_period_end 
            ? new Date(cancelledStripeSubscription.current_period_end * 1000).toISOString()
            : new Date().toISOString()
        }
      });
    });
  } catch (error: any) {
    logger.error('Error cancelling subscription:', error);
    
    if (error.message === 'Subscription not found') {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    if (error.message === 'Subscription is not active') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not active'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};

export const updateSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { plan_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!plan_id) {
      return res.status(400).json({
        success: false,
        message: 'plan_id is required'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Verify subscription belongs to user
      const subscriptions = await client.query<Subscription>(
        'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [subscriptionId, userId]
      );

      if (subscriptions.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subscriptions.rows[0];
      
      if (subscription.status !== 'active') {
        throw new Error('Subscription is not active');
      }

      // Get new plan details
      const plans = await client.query<SubscriptionPlan>(
        'SELECT * FROM subscription_plans WHERE id = $1 AND active = true',
        [plan_id]
      );

      if (plans.rows.length === 0) {
        throw new Error('Plan not found');
      }

      const newPlan = plans.rows[0];

      // Update Stripe subscription
      const stripe = getStripe();
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id!
      );

      // Update the subscription item with new price
      await stripe.subscriptions.update(subscription.stripe_subscription_id!, {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripe_price_id,
        }],
        proration_behavior: 'create_prorations', // Create prorations for upgrade/downgrade
      });

      // Update local database
      await client.query(`
        UPDATE subscriptions 
        SET 
          plan_id = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [plan_id, subscriptionId]);

      // Clear cache
      await deleteCache(`subscription_status:${userId}`);

      res.json({
        success: true,
        message: 'Subscription updated successfully',
        data: {
          subscription_id: subscriptionId,
          new_plan_id: plan_id,
          updated_at: new Date().toISOString()
        }
      });
    });
  } catch (error: any) {
    logger.error('Error updating subscription:', error);
    
    if (error.message === 'Subscription not found') {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    if (error.message === 'Plan not found') {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    if (error.message === 'Subscription is not active') {
      return res.status(400).json({
        success: false,
        message: 'Can only update active subscriptions'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update subscription'
    });
  }
};