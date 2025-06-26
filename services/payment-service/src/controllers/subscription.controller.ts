import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { AuthRequest } from '@cloudmastershub/types';
import { executeQuery, executeTransaction } from '../services/database.service';
import { setCache, getCache } from '../services/redis.service';
import { createCheckoutSession as createStripeCheckoutSession, createCustomer } from '../services/stripe.service';
import {
  SubscriptionPlan,
  Subscription,
  SubscriptionStatusResponse,
  CreateCheckoutSessionRequest,
  CreateSubscriptionRequest
} from '../models/subscription.model';

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
         WHERE s.user_id = $1 AND s.status = 'active'
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
        'SELECT * FROM user_access WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())',
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
    const { user_id, type, plan_id, purchasable_type, purchasable_id, success_url, cancel_url } = body;

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

    let stripe_price_id: string;
    let metadata: Record<string, string> = {
      user_id,
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
    } else {
      // For purchases, we'll need to create a price or use a generic one
      // This is a simplified implementation - you might want to create dynamic prices
      return res.status(400).json({
        success: false,
        message: 'Individual purchases not yet implemented'
      });
    }

    // Create or get Stripe customer
    const customers = await executeQuery(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [user_id]
    );

    let customer_id: string | undefined;
    if (customers.length > 0 && customers[0].stripe_customer_id) {
      customer_id = customers[0].stripe_customer_id;
    }

    // Create Stripe checkout session
    const session = await createStripeCheckoutSession({
      customer_id,
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
    const { user_id, plan_id, payment_method_id } = body;

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

    // Check if user already has active subscription
    const existingSubscriptions = await executeQuery(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND status = $2',
      [user_id, 'active']
    );

    if (existingSubscriptions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    // Implementation would continue with Stripe subscription creation
    // This is a placeholder for the full implementation
    res.status(501).json({
      success: false,
      message: 'Direct subscription creation not yet implemented. Use checkout session instead.'
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
    const userId = req.user?.userId;

    // Verify subscription belongs to user
    const subscriptions = await executeQuery<Subscription>(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [subscriptionId, userId]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const subscription = subscriptions[0];
    if (subscription.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Subscription is not active'
      });
    }

    // Cancel in Stripe and update database
    // This would be implemented with proper transaction handling
    res.status(501).json({
      success: false,
      message: 'Subscription cancellation not yet implemented'
    });
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
};