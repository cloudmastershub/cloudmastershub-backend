import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { AuthRequest, CreatePurchaseRequest } from '@cloudmastershub/types';
import { executeQuery, executeTransaction } from '../services/database.service';
import { convertToUuid } from '../utils/userIdConverter';
import { getStripe, createCheckoutSession } from '../services/stripe.service';
import { PoolClient } from 'pg';

export const createPurchase = async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as CreatePurchaseRequest;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { purchasable_type, purchasable_id, amount, currency = 'usd', success_url, cancel_url } = body;

    // Validate required fields
    if (!purchasable_type || !purchasable_id || !amount || !success_url || !cancel_url) {
      return res.status(400).json({
        success: false,
        message: 'purchasable_type, purchasable_id, amount, success_url, and cancel_url are required'
      });
    }

    // Validate purchasable_type
    if (!['course', 'learning_path'].includes(purchasable_type)) {
      return res.status(400).json({
        success: false,
        message: 'purchasable_type must be either "course" or "learning_path"'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Check if user already owns this item
      const existingPurchases = await client.query(`
        SELECT * FROM purchases 
        WHERE user_id = $1 
        AND purchasable_type = $2 
        AND purchasable_id = $3 
        AND status = 'completed'
      `, [convertToUuid(userId), purchasable_type, purchasable_id]);

      if (existingPurchases.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'You already own this item'
        });
      }

      // Check if user has active subscription that includes this item
      const activeSubscriptions = await client.query(`
        SELECT s.*, sp.name as plan_name
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.user_id = $1 
        AND s.status IN ('active', 'trialing')
        AND (s.expires_at IS NULL OR s.expires_at > NOW())
      `, [convertToUuid(userId)]);

      if (activeSubscriptions.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'You have an active subscription that includes access to this content'
        });
      }

      // Get or create Stripe customer
      const mappingResults = await client.query(
        'SELECT stripe_customer_id FROM user_stripe_mapping WHERE user_id = $1',
        [convertToUuid(userId)]
      );

      let stripeCustomerId: string;
      
      if (mappingResults.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No Stripe customer found. Please create a subscription first.'
        });
      }

      stripeCustomerId = mappingResults.rows[0].stripe_customer_id;

      // Create one-time price in Stripe
      const stripe = getStripe();
      const price = await stripe.prices.create({
        unit_amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        product_data: {
          name: `${purchasable_type === 'course' ? 'Course' : 'Learning Path'}: ${purchasable_id}`,
          metadata: {
            type: purchasable_type,
            id: purchasable_id
          }
        },
      });

      // Create metadata for checkout session
      const metadata = {
        user_id: userId,
        type: 'purchase',
        purchasable_type,
        purchasable_id,
        amount: amount.toString(),
        currency
      };

      // Create Stripe checkout session
      const session = await createCheckoutSession({
        customer_id: stripeCustomerId,
        price_id: price.id,
        success_url,
        cancel_url,
        metadata,
        mode: 'payment'
      });

      // Create pending purchase record
      const purchaseResult = await client.query(`
        INSERT INTO purchases (
          user_id, purchasable_type, purchasable_id, amount, 
          currency, status, metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        userId,
        purchasable_type,
        purchasable_id,
        amount,
        currency,
        'pending',
        JSON.stringify({
          checkout_session_id: session.id,
          stripe_price_id: price.id
        })
      ]);

      res.json({
        success: true,
        message: 'Purchase checkout session created',
        data: {
          purchase_id: purchaseResult.rows[0].id,
          checkout_url: session.url,
          session_id: session.id
        }
      });
    });
  } catch (error) {
    logger.error('Error creating purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase'
    });
  }
};

export const getPurchaseHistory = async (req: AuthRequest, res: Response) => {
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

    const purchases = await executeQuery(`
      SELECT 
        p.*,
        CASE 
          WHEN ua.id IS NOT NULL THEN true 
          ELSE false 
        END as has_access
      FROM purchases p
      LEFT JOIN user_access ua ON (
        ua.user_id = p.user_id 
        AND ua.access_type = 'purchase'
        AND ua.access_id = p.id::text
        AND ua.revoked_at IS NULL
        AND (ua.expires_at IS NULL OR ua.expires_at > NOW())
      )
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `, [convertToUuid(userId)]);

    res.json({
      success: true,
      data: purchases
    });
  } catch (error) {
    logger.error('Error fetching purchase history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase history'
    });
  }
};

export const getPurchaseStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const purchases = await executeQuery(`
      SELECT 
        p.*,
        CASE 
          WHEN ua.id IS NOT NULL THEN true 
          ELSE false 
        END as has_access,
        ua.granted_at,
        ua.expires_at as access_expires_at
      FROM purchases p
      LEFT JOIN user_access ua ON (
        ua.user_id = p.user_id 
        AND ua.access_type = 'purchase'
        AND ua.access_id = p.id::text
        AND ua.revoked_at IS NULL
      )
      WHERE p.id = $1 AND p.user_id = $2
    `, [purchaseId, userId]);

    if (purchases.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.json({
      success: true,
      data: purchases[0]
    });
  } catch (error) {
    logger.error('Error fetching purchase status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase status'
    });
  }
};

export const refundPurchase = async (req: AuthRequest, res: Response) => {
  try {
    const { purchaseId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    await executeTransaction(async (client: PoolClient) => {
      // Verify purchase belongs to user and is refundable
      const purchases = await client.query(`
        SELECT * FROM purchases 
        WHERE id = $1 AND user_id = $2 AND status = 'completed'
        FOR UPDATE
      `, [purchaseId, userId]);

      if (purchases.rows.length === 0) {
        throw new Error('Purchase not found or not refundable');
      }

      const purchase = purchases.rows[0];

      // Check if purchase is within refund window (e.g., 30 days)
      const purchaseDate = new Date(purchase.purchased_at || purchase.created_at);
      const now = new Date();
      const daysDiff = (now.getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24);

      if (daysDiff > 30) {
        throw new Error('Purchase is outside the 30-day refund window');
      }

      // Find the payment record
      const payments = await client.query(`
        SELECT * FROM payments 
        WHERE purchase_id = $1 AND status = 'succeeded'
        ORDER BY created_at DESC LIMIT 1
      `, [purchaseId]);

      if (payments.rows.length === 0) {
        throw new Error('No successful payment found for this purchase');
      }

      const payment = payments.rows[0];

      // Create refund in Stripe
      const stripe = getStripe();
      let refund;
      
      if (payment.stripe_payment_intent_id) {
        refund = await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          reason: 'requested_by_customer',
          metadata: {
            purchase_id: purchaseId,
            user_id: userId,
            reason: reason || 'Customer requested refund'
          }
        });
      } else {
        throw new Error('No Stripe payment intent found');
      }

      // Update purchase status
      await client.query(`
        UPDATE purchases 
        SET 
          status = 'refunded',
          refund_amount = $1,
          refunded_at = NOW(),
          metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
        WHERE id = $3
      `, [
        purchase.amount,
        JSON.stringify({
          refund_id: refund.id,
          refund_reason: reason || 'Customer requested refund'
        }),
        purchaseId
      ]);

      // Create refund payment record
      await client.query(`
        INSERT INTO payments (
          user_id, purchase_id, amount, currency, status,
          payment_method, stripe_payment_intent_id, processed_at,
          metadata_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        userId,
        purchaseId,
        -purchase.amount, // Negative amount for refund
        purchase.currency,
        'succeeded',
        'refund',
        refund.payment_intent,
        new Date(),
        JSON.stringify({
          refund_id: refund.id,
          original_payment_id: payment.id
        })
      ]);

      // Revoke access
      await client.query(`
        UPDATE user_access 
        SET 
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1 
        AND access_type = 'purchase' 
        AND access_id = $2
        AND revoked_at IS NULL
      `, [convertToUuid(userId), purchaseId]);

      res.json({
        success: true,
        message: 'Purchase refunded successfully',
        data: {
          purchase_id: purchaseId,
          refund_id: refund.id,
          refund_amount: purchase.amount,
          refunded_at: new Date().toISOString()
        }
      });
    });
  } catch (error: any) {
    logger.error('Error refunding purchase:', error);
    
    if (error.message === 'Purchase not found or not refundable') {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found or not refundable'
      });
    }

    if (error.message.includes('refund window')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to refund purchase'
    });
  }
};