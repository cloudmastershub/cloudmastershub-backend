import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { AuthRequest } from '@cloudmastershub/types';
import { executeQuery, executeTransaction } from '../services/database.service';
import { convertToUuid } from '../utils/userIdConverter';
import { setCache, getCache, deleteCache } from '../services/redis.service';
import {
  createCheckoutSession as createStripeCheckoutSession,
  createCustomer,
  cancelSubscription as cancelStripeSubscription,
  retrieveSubscription,
  getStripe,
  pauseSubscription as pauseStripeSubscription,
  resumeSubscription as resumeStripeSubscription,
  extendTrialPeriod
} from '../services/stripe.service';
import { publishEvent } from '../services/redis.service';
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
        `SELECT
          id, name, description, price, yearly_price, interval, tier,
          features_json, max_courses, max_labs, max_storage_gb,
          stripe_price_id, stripe_price_id_yearly,
          active, created_at, updated_at
        FROM subscription_plans
        WHERE active = true
        ORDER BY
          CASE
            WHEN tier = 'free' THEN 1
            WHEN tier = 'basic' THEN 2
            WHEN tier = 'premium' THEN 3
            WHEN tier = 'enterprise' THEN 4
            ELSE 5
          END`
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

export const getPlanByStripePrice = async (req: Request, res: Response) => {
  try {
    const { stripePriceId } = req.params;
    
    const plans = await executeQuery<SubscriptionPlan>(
      'SELECT id, name, tier, stripe_price_id FROM subscription_plans WHERE stripe_price_id = $1 AND active = true',
      [stripePriceId]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found for the provided Stripe price ID'
      });
    }

    const plan = plans[0];
    res.json({
      success: true,
      data: {
        plan_id: plan.id,
        tier: plan.tier,
        name: plan.name
      }
    });
  } catch (error) {
    logger.error('Error fetching plan by Stripe price:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plan by Stripe price ID'
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
        [convertToUuid(userId)]
      );

      // Get purchases
      const purchases = await executeQuery(
        'SELECT * FROM purchases WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
        [convertToUuid(userId), 'completed']
      );

      // Get access records
      const access = await executeQuery(
        `SELECT * FROM user_access 
         WHERE user_id = $1 
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
        [convertToUuid(userId)]
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

    const { type, plan_id, billing_cycle, purchasable_type, purchasable_id, success_url, cancel_url } = body;

    // Validate request
    if (type === 'subscription' && !plan_id) {
      return res.status(400).json({
        success: false,
        message: 'plan_id is required for subscription checkout'
      });
    }

    // Validate billing_cycle if provided
    if (billing_cycle && !['monthly', 'yearly'].includes(billing_cycle)) {
      return res.status(400).json({
        success: false,
        message: 'billing_cycle must be "monthly" or "yearly"'
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

    let trialDays: number | undefined;

    if (type === 'subscription') {
      // Get plan details including trial configuration
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

      // Use yearly price if billing_cycle is yearly
      if (billing_cycle === 'yearly') {
        if (!plan.stripe_price_id_yearly) {
          return res.status(400).json({
            success: false,
            message: 'This plan does not have a yearly billing option'
          });
        }
        stripe_price_id = plan.stripe_price_id_yearly;
        metadata.billing_cycle = 'yearly';
      } else {
        stripe_price_id = plan.stripe_price_id;
        metadata.billing_cycle = 'monthly';
      }

      metadata.plan_id = plan_id!;

      // Check if plan offers trial and user hasn't used trial before
      if (plan.trial_available && plan.trial_days > 0) {
        // Check if user has already had a trial subscription
        const previousTrials = await executeQuery(
          `SELECT id FROM subscriptions
           WHERE user_id = $1 AND trial_ends_at IS NOT NULL
           LIMIT 1`,
          [convertToUuid(userId)]
        );

        if (previousTrials.length === 0) {
          trialDays = plan.trial_days;
          metadata.has_trial = 'true';
          metadata.trial_days = String(plan.trial_days);
          logger.info(`User ${userId} eligible for ${plan.trial_days}-day trial on ${plan.tier} plan`);
        } else {
          logger.info(`User ${userId} not eligible for trial - already used trial before`);
        }
      }
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
      [convertToUuid(userId)]
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
        [convertToUuid(userId), stripeCustomerId]
      );
    }

    // Create Stripe checkout session
    const session = await createStripeCheckoutSession({
      customer_id: stripeCustomerId,
      price_id: stripe_price_id,
      success_url,
      cancel_url,
      metadata,
      mode: type === 'subscription' ? 'subscription' : 'payment',
      trial_period_days: trialDays
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
      [convertToUuid(userId), 'active', 'trialing']
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
      [convertToUuid(userId)]
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
        [convertToUuid(userId), stripeCustomerId]
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
      `, [convertToUuid(userId), subscriptionId]);

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

// Maximum pause duration in days
const MAX_PAUSE_DAYS = 30;

export const pauseSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Verify subscription belongs to user and is active
      const subscriptions = await client.query<Subscription>(
        'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [subscriptionId, userId]
      );

      if (subscriptions.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subscriptions.rows[0];

      if (subscription.status === 'paused') {
        throw new Error('Subscription is already paused');
      }

      if (!['active', 'trialing'].includes(subscription.status)) {
        throw new Error('Only active or trialing subscriptions can be paused');
      }

      if (!subscription.stripe_subscription_id) {
        throw new Error('No Stripe subscription ID found');
      }

      // Pause in Stripe
      await pauseStripeSubscription(subscription.stripe_subscription_id);

      const pausedAt = new Date();
      const pauseExpiresAt = new Date(pausedAt.getTime() + MAX_PAUSE_DAYS * 24 * 60 * 60 * 1000);

      // Update local database
      await client.query(`
        UPDATE subscriptions
        SET
          status = 'paused',
          paused_at = $1,
          pause_expires_at = $2,
          pause_reason = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [pausedAt, pauseExpiresAt, reason || null, subscriptionId]);

      // Record in pause history
      await client.query(`
        INSERT INTO subscription_pause_history (
          subscription_id, user_id, paused_at, pause_reason, pause_duration_days,
          stripe_pause_collection_behavior
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [subscriptionId, userId, pausedAt, reason || null, MAX_PAUSE_DAYS, 'mark_uncollectible']);

      // Clear cache
      await deleteCache(`subscription_status:${userId}`);

      // Publish event
      await publishEvent('subscription.paused', {
        user_id: userId,
        subscription_id: subscriptionId,
        paused_at: pausedAt.toISOString(),
        pause_expires_at: pauseExpiresAt.toISOString(),
        reason: reason || null,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Subscription paused successfully',
        data: {
          subscription_id: subscriptionId,
          paused_at: pausedAt.toISOString(),
          pause_expires_at: pauseExpiresAt.toISOString(),
          max_pause_days: MAX_PAUSE_DAYS
        }
      });
    });
  } catch (error: any) {
    logger.error('Error pausing subscription:', error);

    if (error.message === 'Subscription not found') {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (error.message === 'Subscription is already paused') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is already paused'
      });
    }

    if (error.message === 'Only active or trialing subscriptions can be paused') {
      return res.status(400).json({
        success: false,
        message: 'Only active or trialing subscriptions can be paused'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to pause subscription'
    });
  }
};

export const resumeSubscription = async (req: AuthRequest, res: Response) => {
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
      // Verify subscription belongs to user and is paused
      const subscriptions = await client.query<Subscription>(
        'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [subscriptionId, userId]
      );

      if (subscriptions.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subscriptions.rows[0];

      if (subscription.status !== 'paused') {
        throw new Error('Subscription is not paused');
      }

      if (!subscription.stripe_subscription_id) {
        throw new Error('No Stripe subscription ID found');
      }

      // Resume in Stripe
      const stripeSubscription = await resumeStripeSubscription(subscription.stripe_subscription_id);

      const resumedAt = new Date();

      // Update local database - restore to active status
      await client.query(`
        UPDATE subscriptions
        SET
          status = 'active',
          paused_at = NULL,
          pause_expires_at = NULL,
          pause_reason = NULL,
          updated_at = NOW()
        WHERE id = $1
      `, [subscriptionId]);

      // Update pause history with resume timestamp
      await client.query(`
        UPDATE subscription_pause_history
        SET resumed_at = $1
        WHERE subscription_id = $2 AND resumed_at IS NULL
      `, [resumedAt, subscriptionId]);

      // Clear cache
      await deleteCache(`subscription_status:${userId}`);

      // Publish event
      await publishEvent('subscription.resumed', {
        user_id: userId,
        subscription_id: subscriptionId,
        resumed_at: resumedAt.toISOString(),
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Subscription resumed successfully',
        data: {
          subscription_id: subscriptionId,
          resumed_at: resumedAt.toISOString(),
          status: 'active',
          next_billing_date: stripeSubscription.current_period_end
            ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
            : null
        }
      });
    });
  } catch (error: any) {
    logger.error('Error resuming subscription:', error);

    if (error.message === 'Subscription not found') {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (error.message === 'Subscription is not paused') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not paused'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to resume subscription'
    });
  }
};

export const getTrialStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get subscription with plan info
    const subscriptions = await executeQuery<Subscription & { tier: string; trial_days: number }>(
      `SELECT s.*, sp.tier, sp.trial_days
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [subscriptionId, userId]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = subscriptions[0];
    const isTrialing = subscription.status === 'trialing';
    const trialEndsAt = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;

    let daysRemaining = 0;
    if (isTrialing && trialEndsAt) {
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      data: {
        subscription_id: subscriptionId,
        is_trialing: isTrialing,
        trial_ends_at: trialEndsAt?.toISOString() || null,
        days_remaining: daysRemaining,
        trial_days_total: subscription.trial_days,
        tier: subscription.tier,
        status: subscription.status
      }
    });
  } catch (error) {
    logger.error('Error getting trial status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trial status'
    });
  }
};

export const extendTrial = async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { days } = req.body;
    const userId = req.user?.id;
    const userRoles = req.user?.roles || [];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Only admins can extend trials
    if (!userRoles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can extend trial periods'
      });
    }

    if (!days || days < 1 || days > 30) {
      return res.status(400).json({
        success: false,
        message: 'days must be between 1 and 30'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Get subscription (admin can extend any subscription)
      const subscriptions = await client.query<Subscription>(
        'SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE',
        [subscriptionId]
      );

      if (subscriptions.rows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subscriptions.rows[0];

      if (subscription.status !== 'trialing') {
        throw new Error('Subscription is not in trial period');
      }

      if (!subscription.stripe_subscription_id) {
        throw new Error('No Stripe subscription ID found');
      }

      // Calculate new trial end date
      const currentTrialEnd = subscription.trial_ends_at
        ? new Date(subscription.trial_ends_at)
        : new Date();
      const newTrialEnd = new Date(currentTrialEnd.getTime() + days * 24 * 60 * 60 * 1000);
      const newTrialEndTimestamp = Math.floor(newTrialEnd.getTime() / 1000);

      // Extend in Stripe
      await extendTrialPeriod(subscription.stripe_subscription_id, newTrialEndTimestamp);

      // Update local database
      await client.query(`
        UPDATE subscriptions
        SET
          trial_ends_at = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [newTrialEnd, subscriptionId]);

      // Update trial reminders if any are scheduled
      await client.query(`
        UPDATE trial_reminders
        SET status = 'skipped'
        WHERE subscription_id = $1 AND status = 'pending'
      `, [subscriptionId]);

      // Clear cache for subscription owner
      await deleteCache(`subscription_status:${subscription.user_id}`);

      // Publish event
      await publishEvent('subscription.trial_extended', {
        subscription_id: subscriptionId,
        user_id: subscription.user_id,
        extended_by: userId,
        days_extended: days,
        new_trial_end: newTrialEnd.toISOString(),
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Trial extended by ${days} days`,
        data: {
          subscription_id: subscriptionId,
          new_trial_ends_at: newTrialEnd.toISOString(),
          days_extended: days
        }
      });
    });
  } catch (error: any) {
    logger.error('Error extending trial:', error);

    if (error.message === 'Subscription not found') {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (error.message === 'Subscription is not in trial period') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not in trial period'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to extend trial'
    });
  }
};