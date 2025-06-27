import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { AuthRequest } from '@cloudmastershub/types';
import { executeQuery, executeTransaction } from '../services/database.service';
import { getStripe } from '../services/stripe.service';
import { PoolClient } from 'pg';
import Stripe from 'stripe';

export const getPaymentHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user?.id;
    
    // Verify user can access this data
    if (authenticatedUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get payment history with related information
    const payments = await executeQuery(`
      SELECT 
        p.*,
        s.id as subscription_name,
        sp.name as plan_name,
        pur.purchasable_type,
        pur.purchasable_id
      FROM payments p
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
      LEFT JOIN purchases pur ON p.purchase_id = pur.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [userId]);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    logger.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};

export const getPaymentMethods = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user?.id;
    
    // Verify user can access this data
    if (authenticatedUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get saved payment methods
    const paymentMethods = await executeQuery(`
      SELECT 
        id,
        type,
        last_four,
        brand,
        exp_month,
        exp_year,
        is_default,
        created_at
      FROM payment_methods 
      WHERE user_id = $1 AND active = true
      ORDER BY is_default DESC, created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: paymentMethods
    });
  } catch (error) {
    logger.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods'
    });
  }
};

export const addPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { payment_method_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!payment_method_id) {
      return res.status(400).json({
        success: false,
        message: 'payment_method_id is required'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Get or create Stripe customer
      const mappingResults = await client.query(
        'SELECT stripe_customer_id FROM user_stripe_mapping WHERE user_id = $1',
        [userId]
      );

      let stripeCustomerId: string;
      
      if (mappingResults.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No Stripe customer found. Please create a subscription first.'
        });
      }

      stripeCustomerId = mappingResults.rows[0].stripe_customer_id;

      // Get payment method details from Stripe
      const stripe = getStripe();
      const stripePaymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

      // Attach payment method to customer
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: stripeCustomerId,
      });

      // Extract payment method details
      let type: string = stripePaymentMethod.type;
      let lastFour: string = '';
      let brand: string = '';
      let expMonth: number | null = null;
      let expYear: number | null = null;

      if (stripePaymentMethod.card) {
        lastFour = stripePaymentMethod.card.last4;
        brand = stripePaymentMethod.card.brand;
        expMonth = stripePaymentMethod.card.exp_month;
        expYear = stripePaymentMethod.card.exp_year;
      }

      // Save payment method to database
      const result = await client.query(`
        INSERT INTO payment_methods (
          user_id, type, last_four, brand, exp_month, exp_year,
          stripe_payment_method_id, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        userId,
        type,
        lastFour,
        brand,
        expMonth,
        expYear,
        payment_method_id,
        false // New payment methods are not default by default
      ]);

      const savedPaymentMethod = result.rows[0];

      res.json({
        success: true,
        message: 'Payment method added successfully',
        data: {
          id: savedPaymentMethod.id,
          type: savedPaymentMethod.type,
          last_four: savedPaymentMethod.last_four,
          brand: savedPaymentMethod.brand,
          exp_month: savedPaymentMethod.exp_month,
          exp_year: savedPaymentMethod.exp_year,
          is_default: savedPaymentMethod.is_default,
          created_at: savedPaymentMethod.created_at
        }
      });
    });
  } catch (error: any) {
    logger.error('Error adding payment method:', error);
    
    if (error.code === 'resource_missing') {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add payment method'
    });
  }
};

export const removePaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentMethodId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Verify payment method belongs to user
      const paymentMethods = await client.query(
        'SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [paymentMethodId, userId]
      );

      if (paymentMethods.rows.length === 0) {
        throw new Error('Payment method not found');
      }

      const paymentMethod = paymentMethods.rows[0];

      // Detach from Stripe
      const stripe = getStripe();
      await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);

      // Mark as inactive in database
      await client.query(
        'UPDATE payment_methods SET active = false, updated_at = NOW() WHERE id = $1',
        [paymentMethodId]
      );

      // If this was the default payment method, unset it
      if (paymentMethod.is_default) {
        await client.query(
          'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
          [userId]
        );
      }

      res.json({
        success: true,
        message: 'Payment method removed successfully'
      });
    });
  } catch (error: any) {
    logger.error('Error removing payment method:', error);
    
    if (error.message === 'Payment method not found') {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to remove payment method'
    });
  }
};

export const setDefaultPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    const { paymentMethodId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Verify payment method belongs to user
      const paymentMethods = await client.query(
        'SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2 AND active = true FOR UPDATE',
        [paymentMethodId, userId]
      );

      if (paymentMethods.rows.length === 0) {
        throw new Error('Payment method not found');
      }

      const paymentMethod = paymentMethods.rows[0];

      // Get Stripe customer ID
      const mappingResults = await client.query(
        'SELECT stripe_customer_id FROM user_stripe_mapping WHERE user_id = $1',
        [userId]
      );

      if (mappingResults.rows.length === 0) {
        throw new Error('No Stripe customer found');
      }

      const stripeCustomerId = mappingResults.rows[0].stripe_customer_id;

      // Update default payment method in Stripe
      const stripe = getStripe();
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.stripe_payment_method_id,
        },
      });

      // Unset all other default payment methods for this user
      await client.query(
        'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
        [userId]
      );

      // Set this payment method as default
      await client.query(
        'UPDATE payment_methods SET is_default = true, updated_at = NOW() WHERE id = $1',
        [paymentMethodId]
      );

      res.json({
        success: true,
        message: 'Default payment method updated successfully'
      });
    });
  } catch (error: any) {
    logger.error('Error setting default payment method:', error);
    
    if (error.message === 'Payment method not found') {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    if (error.message === 'No Stripe customer found') {
      return res.status(400).json({
        success: false,
        message: 'No Stripe customer found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to set default payment method'
    });
  }
};

export const createSetupIntent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Get or create Stripe customer
    const mappingResults = await executeQuery(
      'SELECT stripe_customer_id FROM user_stripe_mapping WHERE user_id = $1',
      [userId]
    );

    let stripeCustomerId: string;
    
    if (mappingResults.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe customer found. Please create a subscription first.'
      });
    }

    stripeCustomerId = mappingResults[0].stripe_customer_id;

    // Create setup intent for future payments
    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      usage: 'off_session', // Indicates this payment method is intended for future payments
    });

    res.json({
      success: true,
      data: {
        client_secret: setupIntent.client_secret,
        setup_intent_id: setupIntent.id
      }
    });
  } catch (error) {
    logger.error('Error creating setup intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create setup intent'
    });
  }
};