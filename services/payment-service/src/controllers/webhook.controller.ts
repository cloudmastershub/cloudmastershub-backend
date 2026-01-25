import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { constructWebhookEvent, getStripe } from '../services/stripe.service';
import { publishEvent } from '../services/redis.service';
import { executeTransaction, executeQuery } from '../services/database.service';
import { convertToUuid } from '../utils/userIdConverter';
import { PoolClient } from 'pg';
import Stripe from 'stripe';

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

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
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

const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  try {
    const session = event.data.object as Stripe.Checkout.Session;
    const { customer, subscription, payment_intent, metadata } = session;

    logger.info('Processing checkout session completion', {
      sessionId: session.id,
      customerId: customer,
      metadata
    });

    await executeTransaction(async (client: PoolClient) => {
      // Extract metadata
      const userId = metadata?.user_id;
      const type = metadata?.type || 'subscription';
      const planId = metadata?.plan_id;

      if (!userId) {
        throw new Error('Missing user_id in session metadata');
      }

      if (type === 'subscription' && subscription) {
        // Get subscription details from Stripe
        const stripe = getStripe();
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription as string);

        // Create or update subscription record
        const subscriptionResult = await client.query(`
          INSERT INTO subscriptions (
            user_id, plan_id, status, stripe_subscription_id, 
            stripe_customer_id, started_at, metadata_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (stripe_subscription_id) 
          DO UPDATE SET 
            status = EXCLUDED.status,
            updated_at = NOW()
          RETURNING id
        `, [
          userId,
          planId,
          stripeSubscription.status,
          subscription,
          customer,
          new Date(stripeSubscription.created * 1000),
          JSON.stringify({
            stripe_price_id: stripeSubscription.items.data[0]?.price.id,
            payment_method: session.payment_method_types?.[0]
          })
        ]);

        const subscriptionId = subscriptionResult.rows[0].id;

        // Create payment record
        if (payment_intent) {
          await client.query(`
            INSERT INTO payments (
              user_id, subscription_id, amount, currency, status,
              payment_method, stripe_payment_intent_id, processed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            userId,
            subscriptionId,
            session.amount_total! / 100, // Convert from cents
            session.currency,
            'succeeded',
            session.payment_method_types?.[0],
            payment_intent,
            new Date()
          ]);
        }

        // Grant platform access
        await grantUserAccess(client, userId, 'subscription', subscriptionId, 'platform', null);

        // Publish event for other services
        await publishEvent('subscription.created', {
          user_id: userId,
          subscription_id: subscriptionId,
          plan_id: planId,
          stripe_subscription_id: subscription,
          timestamp: new Date().toISOString()
        });

      } else if (type === 'bootcamp') {
        // Handle bootcamp enrollment
        await handleBootcampCheckout(client, session, metadata);

      } else if (type === 'purchase') {
        // Handle individual purchase
        const purchasableType = metadata?.purchasable_type;
        const purchasableId = metadata?.purchasable_id;

        if (!purchasableType || !purchasableId) {
          throw new Error('Missing purchase metadata');
        }

        // Create purchase record
        const purchaseResult = await client.query(`
          INSERT INTO purchases (
            user_id, purchasable_type, purchasable_id, amount, 
            currency, status, stripe_payment_intent_id, purchased_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          userId,
          purchasableType,
          purchasableId,
          session.amount_total! / 100,
          session.currency,
          'completed',
          payment_intent,
          new Date()
        ]);

        const purchaseId = purchaseResult.rows[0].id;

        // Create payment record
        await client.query(`
          INSERT INTO payments (
            user_id, purchase_id, amount, currency, status,
            payment_method, stripe_payment_intent_id, processed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          userId,
          purchaseId,
          session.amount_total! / 100,
          session.currency,
          'succeeded',
          session.payment_method_types?.[0],
          payment_intent,
          new Date()
        ]);

        // Grant access to specific resource
        await grantUserAccess(
          client, 
          userId, 
          'purchase', 
          purchaseId, 
          purchasableType as 'course' | 'learning_path',
          purchasableId
        );

        // Publish event
        await publishEvent('purchase.completed', {
          user_id: userId,
          purchase_id: purchaseId,
          purchasable_type: purchasableType,
          purchasable_id: purchasableId,
          timestamp: new Date().toISOString()
        });
      }
    });

  } catch (error) {
    logger.error('Error handling checkout session completion:', error);
    throw error;
  }
};

const handleInvoicePaymentSucceeded = async (event: Stripe.Event) => {
  try {
    const invoice = event.data.object as Stripe.Invoice;

    await executeTransaction(async (client: PoolClient) => {
      // Check if this is a bootcamp installment payment
      if (invoice.subscription) {
        const isBootcampPayment = await handleBootcampInstallmentPayment(client, invoice);
        if (isBootcampPayment) {
          return; // Bootcamp payment handled, skip regular subscription processing
        }
      }

      // Update or create invoice record
      await client.query(`
        INSERT INTO invoices (
          stripe_invoice_id, user_id, subscription_id, invoice_number,
          amount_due, amount_paid, currency, status, billing_period_start,
          billing_period_end, paid_at, hosted_invoice_url, invoice_pdf_url
        ) 
        SELECT 
          $1, s.user_id, s.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        FROM subscriptions s
        WHERE s.stripe_subscription_id = $12
        ON CONFLICT (stripe_invoice_id) 
        DO UPDATE SET 
          amount_paid = EXCLUDED.amount_paid,
          status = EXCLUDED.status,
          paid_at = EXCLUDED.paid_at,
          updated_at = NOW()
      `, [
        invoice.id,
        invoice.number,
        invoice.amount_due / 100,
        invoice.amount_paid / 100,
        invoice.currency,
        'paid',
        invoice.period_start ? new Date(invoice.period_start * 1000) : null,
        invoice.period_end ? new Date(invoice.period_end * 1000) : null,
        new Date(),
        invoice.hosted_invoice_url,
        invoice.invoice_pdf,
        invoice.subscription
      ]);

      // Create payment record
      await client.query(`
        INSERT INTO payments (
          user_id, subscription_id, amount, currency, status,
          stripe_invoice_id, processed_at
        )
        SELECT 
          s.user_id, s.id, $1, $2, $3, $4, $5
        FROM subscriptions s
        WHERE s.stripe_subscription_id = $6
      `, [
        invoice.amount_paid / 100,
        invoice.currency,
        'succeeded',
        invoice.id,
        new Date(),
        invoice.subscription
      ]);

      // Extend subscription expiry if needed
      if (invoice.subscription && invoice.period_end) {
        await client.query(`
          UPDATE subscriptions 
          SET expires_at = $1, updated_at = NOW()
          WHERE stripe_subscription_id = $2
        `, [
          new Date(invoice.period_end * 1000),
          invoice.subscription
        ]);
      }
    });

    // Publish event
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

const handleInvoicePaymentFailed = async (event: Stripe.Event) => {
  try {
    const invoice = event.data.object as Stripe.Invoice;
    
    await executeTransaction(async (client: PoolClient) => {
      // Update invoice record
      await client.query(`
        UPDATE invoices 
        SET status = 'open', updated_at = NOW()
        WHERE stripe_invoice_id = $1
      `, [invoice.id]);

      // Create failed payment record
      await client.query(`
        INSERT INTO payments (
          user_id, subscription_id, amount, currency, status,
          stripe_invoice_id, failure_reason, processed_at
        )
        SELECT 
          s.user_id, s.id, $1, $2, $3, $4, $5, $6
        FROM subscriptions s
        WHERE s.stripe_subscription_id = $7
      `, [
        invoice.amount_due / 100,
        invoice.currency,
        'failed',
        invoice.id,
        'Invoice payment failed',
        new Date(),
        invoice.subscription
      ]);

      // Update subscription status if needed
      if (invoice.subscription) {
        await client.query(`
          UPDATE subscriptions 
          SET status = 'past_due', updated_at = NOW()
          WHERE stripe_subscription_id = $1
        `, [invoice.subscription]);
      }
    });

    // Publish event
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

const handleSubscriptionCreated = async (event: Stripe.Event) => {
  try {
    const subscription = event.data.object as Stripe.Subscription;
    
    await executeTransaction(async (client: PoolClient) => {
      // Get user_id from Stripe customer metadata
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
      const userId = customer.metadata?.user_id;

      if (!userId) {
        logger.error('No user_id found in customer metadata', { customerId: subscription.customer });
        return;
      }

      // Get plan_id from our database based on Stripe price
      const planResult = await client.query(`
        SELECT id FROM subscription_plans 
        WHERE stripe_price_id = $1
      `, [subscription.items.data[0].price.id]);

      if (planResult.rows.length === 0) {
        logger.error('No matching plan found for Stripe price', { 
          priceId: subscription.items.data[0].price.id 
        });
        return;
      }

      const planId = planResult.rows[0].id;

      // Create or update subscription record
      const subscriptionResult = await client.query(`
        INSERT INTO subscriptions (
          user_id, plan_id, status, stripe_subscription_id,
          stripe_customer_id, started_at, expires_at, trial_ends_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (stripe_subscription_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
        RETURNING id
      `, [
        userId,
        planId,
        subscription.status,
        subscription.id,
        subscription.customer,
        new Date(subscription.created * 1000),
        subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
      ]);

      const subscriptionId = subscriptionResult.rows[0].id;

      // Grant access if subscription is active
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        await grantUserAccess(client, userId, 'subscription', subscriptionId, 'platform', null);
      }
    });

    // Publish event
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

const handleSubscriptionUpdated = async (event: Stripe.Event) => {
  try {
    const subscription = event.data.object as Stripe.Subscription;
    const previousAttributes = event.data.previous_attributes as any;
    
    await executeTransaction(async (client: PoolClient) => {
      // Update subscription record
      const result = await client.query(`
        UPDATE subscriptions 
        SET 
          status = $1,
          expires_at = $2,
          updated_at = NOW()
        WHERE stripe_subscription_id = $3
        RETURNING id, user_id
      `, [
        subscription.status,
        subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
        subscription.id
      ]);

      if (result.rows.length === 0) {
        logger.warn('Subscription not found for update', { subscriptionId: subscription.id });
        return;
      }

      const { id: subscriptionId, user_id: userId } = result.rows[0];

      // Handle status changes
      if (previousAttributes?.status && previousAttributes.status !== subscription.status) {
        if (subscription.status === 'active' && ['past_due', 'incomplete'].includes(previousAttributes.status)) {
          // Reactivate access
          await grantUserAccess(client, userId, 'subscription', subscriptionId, 'platform', null);
        } else if (['cancelled', 'incomplete_expired'].includes(subscription.status)) {
          // Revoke access
          await revokeUserAccess(client, userId, 'subscription', subscriptionId);
        }
      }

      // Handle plan changes (upgrade/downgrade)
      if (previousAttributes?.items) {
        const oldPriceId = previousAttributes.items.data[0]?.price?.id;
        const newPriceId = subscription.items.data[0]?.price?.id;

        if (oldPriceId !== newPriceId) {
          // Update plan_id
          const planResult = await client.query(`
            UPDATE subscriptions s
            SET plan_id = sp.id
            FROM subscription_plans sp
            WHERE s.stripe_subscription_id = $1
            AND sp.stripe_price_id = $2
          `, [subscription.id, newPriceId]);

          logger.info('Subscription plan changed', { 
            subscriptionId: subscription.id,
            oldPriceId,
            newPriceId
          });
        }
      }
    });

    // Publish event
    await publishEvent('subscription.updated', {
      subscription_id: subscription.id,
      status: subscription.status,
      previous_status: previousAttributes?.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error handling subscription update:', error);
    throw error;
  }
};

const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  try {
    const subscription = event.data.object as Stripe.Subscription;
    
    await executeTransaction(async (client: PoolClient) => {
      // Update subscription record
      const result = await client.query(`
        UPDATE subscriptions 
        SET 
          status = 'cancelled',
          cancelled_at = NOW(),
          updated_at = NOW()
        WHERE stripe_subscription_id = $1
        RETURNING id, user_id
      `, [subscription.id]);

      if (result.rows.length === 0) {
        logger.warn('Subscription not found for deletion', { subscriptionId: subscription.id });
        return;
      }

      const { id: subscriptionId, user_id: userId } = result.rows[0];

      // Revoke access
      await revokeUserAccess(client, userId, 'subscription', subscriptionId);
    });

    // Publish event
    await publishEvent('subscription.cancelled', {
      subscription_id: subscription.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error handling subscription deletion:', error);
    throw error;
  }
};

const handlePaymentIntentSucceeded = async (event: Stripe.Event) => {
  try {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Update payment record if exists
    await executeQuery(`
      UPDATE payments 
      SET 
        status = 'succeeded',
        processed_at = NOW(),
        updated_at = NOW()
      WHERE stripe_payment_intent_id = $1
    `, [paymentIntent.id]);

  } catch (error) {
    logger.error('Error handling payment intent success:', error);
    throw error;
  }
};

const handlePaymentIntentFailed = async (event: Stripe.Event) => {
  try {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Update payment record if exists
    await executeQuery(`
      UPDATE payments 
      SET 
        status = 'failed',
        failure_reason = $1,
        processed_at = NOW(),
        updated_at = NOW()
      WHERE stripe_payment_intent_id = $2
    `, [
      paymentIntent.last_payment_error?.message || 'Payment failed',
      paymentIntent.id
    ]);

  } catch (error) {
    logger.error('Error handling payment intent failure:', error);
    throw error;
  }
};

// ============================================================================
// BOOTCAMP HANDLERS
// ============================================================================

async function handleBootcampCheckout(
  client: PoolClient,
  session: Stripe.Checkout.Session,
  metadata: Stripe.Metadata
) {
  const userId = metadata.user_id;
  const bootcampId = metadata.bootcamp_id;
  const paymentType = metadata.payment_type as 'full' | 'installment';
  const scheduleId = metadata.schedule_id;

  if (!userId || !bootcampId) {
    throw new Error('Missing bootcamp metadata: user_id or bootcamp_id');
  }

  // Get bootcamp details
  const bootcampResult = await client.query(`
    SELECT * FROM bootcamps WHERE id = $1
  `, [bootcampId]);

  if (bootcampResult.rows.length === 0) {
    throw new Error(`Bootcamp not found: ${bootcampId}`);
  }

  const bootcamp = bootcampResult.rows[0];

  if (paymentType === 'full') {
    // Full payment - create enrollment with active status
    const amountTotal = parseFloat(bootcamp.price_full_discounted);

    const enrollmentResult = await client.query(`
      INSERT INTO bootcamp_enrollments (
        user_id, bootcamp_id, payment_type, payment_method,
        amount_paid, amount_total, installments_paid,
        stripe_payment_intent_id, benefits_unlocked,
        status, enrolled_at
      ) VALUES ($1, $2, 'full', 'stripe', $3, $4, 1, $5, $6, 'active', NOW())
      ON CONFLICT (user_id, bootcamp_id) WHERE status IN ('pending', 'active')
      DO UPDATE SET
        amount_paid = EXCLUDED.amount_paid,
        status = 'active',
        enrolled_at = NOW(),
        stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
        updated_at = NOW()
      RETURNING id
    `, [
      userId,
      bootcampId,
      amountTotal,
      amountTotal,
      session.payment_intent,
      JSON.stringify([...bootcamp.core_benefits || [], ...bootcamp.pay_in_full_benefits || []])
    ]);

    const enrollmentId = enrollmentResult.rows[0].id;

    // Create payment record
    await client.query(`
      INSERT INTO payments (
        user_id, amount, currency, status,
        payment_method, stripe_payment_intent_id, processed_at,
        metadata_json
      ) VALUES ($1, $2, $3, 'succeeded', $4, $5, NOW(), $6)
    `, [
      userId,
      session.amount_total! / 100,
      session.currency,
      session.payment_method_types?.[0],
      session.payment_intent,
      JSON.stringify({
        type: 'bootcamp_enrollment',
        bootcamp_id: bootcampId,
        enrollment_id: enrollmentId,
        payment_type: 'full'
      })
    ]);

    // Grant bootcamp access
    await grantBootcampAccess(client, userId, bootcampId, enrollmentId, bootcamp.includes_premium_access);

    // Publish event
    await publishEvent('bootcamp.enrolled', {
      user_id: userId,
      bootcamp_id: bootcampId,
      enrollment_id: enrollmentId,
      payment_type: 'full',
      timestamp: new Date().toISOString()
    });

    logger.info('Bootcamp full payment enrollment completed', {
      userId,
      bootcampId,
      enrollmentId
    });

  } else if (paymentType === 'installment') {
    // Installment payment - create enrollment with first installment
    const installmentAmount = parseFloat(bootcamp.installment_amount);
    const installmentTotal = parseFloat(bootcamp.price_installment_total);

    // Get first installment benefits
    const unlockSchedule = bootcamp.installment_unlock_schedule || {};
    const firstInstallmentBenefits = unlockSchedule['1'] || [];

    const enrollmentResult = await client.query(`
      INSERT INTO bootcamp_enrollments (
        user_id, bootcamp_id, payment_type, payment_method,
        amount_paid, amount_total, installments_paid,
        stripe_subscription_id, stripe_schedule_id,
        benefits_unlocked, status, enrolled_at,
        next_installment_due
      ) VALUES ($1, $2, 'installment', 'stripe', $3, $4, 1, $5, $6, $7, 'active', NOW(), $8)
      ON CONFLICT (user_id, bootcamp_id) WHERE status IN ('pending', 'active')
      DO UPDATE SET
        amount_paid = EXCLUDED.amount_paid,
        installments_paid = 1,
        status = 'active',
        enrolled_at = NOW(),
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_schedule_id = EXCLUDED.stripe_schedule_id,
        next_installment_due = EXCLUDED.next_installment_due,
        updated_at = NOW()
      RETURNING id
    `, [
      userId,
      bootcampId,
      installmentAmount,
      installmentTotal,
      session.subscription,
      scheduleId,
      JSON.stringify(firstInstallmentBenefits),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    ]);

    const enrollmentId = enrollmentResult.rows[0].id;

    // Create payment record
    await client.query(`
      INSERT INTO payments (
        user_id, amount, currency, status,
        payment_method, stripe_payment_intent_id, processed_at,
        metadata_json
      ) VALUES ($1, $2, $3, 'succeeded', $4, $5, NOW(), $6)
    `, [
      userId,
      session.amount_total! / 100,
      session.currency,
      session.payment_method_types?.[0],
      session.payment_intent,
      JSON.stringify({
        type: 'bootcamp_installment',
        bootcamp_id: bootcampId,
        enrollment_id: enrollmentId,
        installment_number: 1,
        total_installments: bootcamp.installment_count
      })
    ]);

    // Grant partial bootcamp access
    await grantBootcampAccess(client, userId, bootcampId, enrollmentId, bootcamp.includes_premium_access);

    // Publish event
    await publishEvent('bootcamp.enrolled', {
      user_id: userId,
      bootcamp_id: bootcampId,
      enrollment_id: enrollmentId,
      payment_type: 'installment',
      installment_number: 1,
      timestamp: new Date().toISOString()
    });

    logger.info('Bootcamp installment enrollment started', {
      userId,
      bootcampId,
      enrollmentId,
      installmentPaid: 1
    });
  }
}

// Handle bootcamp installment payment
async function handleBootcampInstallmentPayment(
  client: PoolClient,
  invoice: Stripe.Invoice
) {
  const subscriptionId = invoice.subscription as string;

  // Find enrollment by subscription ID
  const enrollmentResult = await client.query(`
    SELECT be.*, b.installment_unlock_schedule, b.installment_count
    FROM bootcamp_enrollments be
    JOIN bootcamps b ON be.bootcamp_id = b.id
    WHERE be.stripe_subscription_id = $1
  `, [subscriptionId]);

  if (enrollmentResult.rows.length === 0) {
    // Not a bootcamp subscription
    return false;
  }

  const enrollment = enrollmentResult.rows[0];
  const newInstallmentCount = enrollment.installments_paid + 1;
  const installmentTotal = enrollment.installment_count;

  // Get newly unlocked benefits
  const unlockSchedule = enrollment.installment_unlock_schedule || {};
  const newBenefits = unlockSchedule[newInstallmentCount.toString()] || [];
  const existingBenefits = enrollment.benefits_unlocked || [];
  const allBenefits = [...existingBenefits, ...newBenefits];

  // Check if this completes the enrollment
  const isComplete = newInstallmentCount >= installmentTotal;

  await client.query(`
    UPDATE bootcamp_enrollments
    SET
      amount_paid = amount_paid + $1,
      installments_paid = $2,
      benefits_unlocked = $3,
      status = $4,
      completed_at = $5,
      next_installment_due = $6,
      updated_at = NOW()
    WHERE id = $7
  `, [
    invoice.amount_paid / 100,
    newInstallmentCount,
    JSON.stringify(allBenefits),
    isComplete ? 'completed' : 'active',
    isComplete ? new Date() : null,
    isComplete ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    enrollment.id
  ]);

  // Create payment record
  await client.query(`
    INSERT INTO payments (
      user_id, amount, currency, status,
      stripe_invoice_id, processed_at,
      metadata_json
    ) VALUES ($1, $2, $3, 'succeeded', $4, NOW(), $5)
  `, [
    enrollment.user_id,
    invoice.amount_paid / 100,
    invoice.currency,
    invoice.id,
    JSON.stringify({
      type: 'bootcamp_installment',
      bootcamp_id: enrollment.bootcamp_id,
      enrollment_id: enrollment.id,
      installment_number: newInstallmentCount,
      total_installments: installmentTotal
    })
  ]);

  // Publish event
  await publishEvent('bootcamp.installment_paid', {
    user_id: enrollment.user_id,
    bootcamp_id: enrollment.bootcamp_id,
    enrollment_id: enrollment.id,
    installment_number: newInstallmentCount,
    is_complete: isComplete,
    timestamp: new Date().toISOString()
  });

  logger.info('Bootcamp installment payment processed', {
    enrollmentId: enrollment.id,
    installmentNumber: newInstallmentCount,
    isComplete
  });

  return true;
}

// Grant bootcamp access to user
async function grantBootcampAccess(
  client: PoolClient,
  userId: string,
  bootcampId: string,
  enrollmentId: string,
  includesPremiumAccess: boolean
) {
  // Grant bootcamp-specific access
  await client.query(`
    INSERT INTO user_access (
      user_id, access_type, access_id, resource_type,
      resource_id, source, granted_at
    ) VALUES ($1, 'bootcamp', $2, 'bootcamp', $3, 'bootcamp_enrollment', NOW())
    ON CONFLICT DO NOTHING
  `, [convertToUuid(userId), enrollmentId, bootcampId]);

  // Grant premium access if bootcamp includes it
  if (includesPremiumAccess) {
    await client.query(`
      INSERT INTO user_access (
        user_id, access_type, access_id, resource_type,
        source, granted_at
      ) VALUES ($1, 'bootcamp', $2, 'platform', 'bootcamp_premium', NOW())
      ON CONFLICT DO NOTHING
    `, [convertToUuid(userId), enrollmentId]);
  }

  logger.info('Bootcamp access granted', {
    userId,
    bootcampId,
    enrollmentId,
    includesPremiumAccess
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper functions for access control
async function grantUserAccess(
  client: PoolClient,
  userId: string,
  accessType: 'subscription' | 'purchase' | 'trial' | 'promotion',
  accessId: string,
  resourceType: 'platform' | 'course' | 'learning_path' | 'lab',
  resourceId: string | null
) {
  await client.query(`
    INSERT INTO user_access (
      user_id, access_type, access_id, resource_type, 
      resource_id, source, granted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (user_id, access_type, access_id, resource_type, COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'))
    DO UPDATE SET
      revoked_at = NULL,
      updated_at = NOW()
  `, [
    convertToUuid(userId),
    accessType,
    accessId,
    resourceType,
    resourceId,
    accessType
  ]);

  logger.info('User access granted', {
    userId,
    accessType,
    resourceType,
    resourceId
  });
}

async function revokeUserAccess(
  client: PoolClient,
  userId: string,
  accessType: 'subscription' | 'purchase' | 'trial' | 'promotion',
  accessId: string
) {
  await client.query(`
    UPDATE user_access 
    SET 
      revoked_at = NOW(),
      updated_at = NOW()
    WHERE user_id = $1 
    AND access_type = $2 
    AND access_id = $3
    AND revoked_at IS NULL
  `, [convertToUuid(userId), accessType, accessId]);

  logger.info('User access revoked', {
    userId,
    accessType,
    accessId
  });
}