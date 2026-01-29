import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { AuthRequest } from '@cloudmastershub/types';
import { executeQuery, executeTransaction } from '../services/database.service';
import { convertToUuid } from '../utils/userIdConverter';
import { setCache, getCache, deleteCache } from '../services/redis.service';
import { getStripe, createCustomer, createCheckoutSession as createStripeCheckoutSession } from '../services/stripe.service';
import {
  Bootcamp,
  BootcampEnrollment,
  BootcampEnrollmentWithDetails,
  BootcampCheckoutRequest,
  CreateBootcampRequest,
  UpdateBootcampRequest,
  ManualEnrollmentRequest,
  UpdateEnrollmentRequest,
  BootcampSession,
  BootcampSessionWithStats,
  CreateSessionRequest,
  UpdateSessionRequest,
  rowToBootcamp,
  rowToEnrollment,
  rowToSession,
  rowToSessionWithStats
} from '../models/bootcamp.model';
import { PoolClient } from 'pg';

const CACHE_TTL = 3600; // 1 hour for bootcamp list
const ENROLLMENT_CACHE_TTL = 300; // 5 minutes for enrollments

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

export const getBootcamps = async (req: Request, res: Response) => {
  try {
    const cacheKey = 'bootcamps:active';
    let bootcamps = await getCache<Bootcamp[]>(cacheKey);

    if (!bootcamps) {
      const rows = await executeQuery(
        `SELECT * FROM bootcamps WHERE active = true ORDER BY sort_order ASC, name ASC`
      );
      bootcamps = rows.map(rowToBootcamp);
      await setCache(cacheKey, bootcamps, CACHE_TTL);
    }

    res.json({
      success: true,
      data: bootcamps
    });
  } catch (error) {
    logger.error('Error fetching bootcamps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bootcamps'
    });
  }
};

export const getBootcampBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const cacheKey = `bootcamp:${slug}`;

    let bootcamp = await getCache<Bootcamp>(cacheKey);

    if (!bootcamp) {
      const rows = await executeQuery(
        'SELECT * FROM bootcamps WHERE slug = $1 AND active = true',
        [slug]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Bootcamp not found'
        });
      }

      bootcamp = rowToBootcamp(rows[0]);
      await setCache(cacheKey, bootcamp, CACHE_TTL);
    }

    res.json({
      success: true,
      data: bootcamp
    });
  } catch (error) {
    logger.error('Error fetching bootcamp by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bootcamp'
    });
  }
};

// ============================================================================
// PROTECTED ENDPOINTS
// ============================================================================

export const createBootcampCheckout = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { bootcamp_id, session_id, payment_type, success_url, cancel_url } = req.body as BootcampCheckoutRequest;

    if (!bootcamp_id || !payment_type || !success_url || !cancel_url) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: bootcamp_id, payment_type, success_url, cancel_url'
      });
    }

    if (!['full', 'installment'].includes(payment_type)) {
      return res.status(400).json({
        success: false,
        message: 'payment_type must be "full" or "installment"'
      });
    }

    // Validate session if provided
    if (session_id) {
      const sessionRows = await executeQuery(
        'SELECT * FROM bootcamp_sessions WHERE id = $1 AND bootcamp_id = $2',
        [session_id, bootcamp_id]
      );

      if (sessionRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Session not found for this bootcamp'
        });
      }

      const session = sessionRows[0];

      if (!session.enrollment_open) {
        return res.status(400).json({
          success: false,
          message: 'Enrollment is not open for this session'
        });
      }

      // Check capacity if set
      if (session.max_capacity) {
        const enrollmentCount = await executeQuery(
          'SELECT COUNT(*) as count FROM bootcamp_enrollments WHERE session_id = $1 AND status IN ($2, $3)',
          [session_id, 'pending', 'active']
        );

        if (parseInt(enrollmentCount[0].count) >= session.max_capacity) {
          return res.status(400).json({
            success: false,
            message: 'This session has reached maximum capacity'
          });
        }
      }
    }

    // Get bootcamp
    const bootcamps = await executeQuery(
      'SELECT * FROM bootcamps WHERE id = $1 AND active = true',
      [bootcamp_id]
    );

    if (bootcamps.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bootcamp not found'
      });
    }

    const bootcamp = rowToBootcamp(bootcamps[0]);

    // Check for existing active enrollment
    const existingEnrollments = await executeQuery(
      `SELECT * FROM bootcamp_enrollments
       WHERE user_id = $1 AND bootcamp_id = $2 AND status IN ('pending', 'active')`,
      [convertToUuid(userId), bootcamp_id]
    );

    if (existingEnrollments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active enrollment for this bootcamp'
      });
    }

    // Get or create Stripe customer
    const mappingResults = await executeQuery<{ stripe_customer_id: string }>(
      'SELECT stripe_customer_id FROM user_stripe_mapping WHERE user_id = $1',
      [convertToUuid(userId)]
    );

    let stripeCustomerId: string;

    if (mappingResults.length > 0) {
      stripeCustomerId = mappingResults[0].stripe_customer_id;
    } else {
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

    const metadata: Record<string, string> = {
      user_id: userId,
      bootcamp_id: bootcamp.id,
      bootcamp_name: bootcamp.name,
      payment_type,
      type: 'bootcamp'
    };

    // Add session_id to metadata if provided
    if (session_id) {
      metadata.session_id = session_id;
    }

    if (payment_type === 'full') {
      // One-time payment for pay-in-full
      const priceId = bootcamp.stripe_price_id_full;
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: 'Bootcamp is not configured for Stripe payments'
        });
      }

      const session = await createStripeCheckoutSession({
        customer_id: stripeCustomerId,
        price_id: priceId,
        success_url,
        cancel_url,
        metadata,
        mode: 'payment'
      });

      return res.json({
        success: true,
        data: {
          checkout_url: session.url,
          session_id: session.id,
          payment_type: 'full',
          amount: bootcamp.price_full_discounted
        }
      });
    } else {
      // Installment plan using subscription schedule
      const priceId = bootcamp.stripe_price_id_installment;
      if (!priceId) {
        return res.status(400).json({
          success: false,
          message: 'Bootcamp installment pricing is not configured'
        });
      }

      const stripe = getStripe();

      // Create a subscription schedule for fixed number of payments
      const subscriptionSchedule = await stripe.subscriptionSchedules.create({
        customer: stripeCustomerId,
        start_date: 'now',
        end_behavior: 'cancel',
        phases: [{
          items: [{ price: priceId, quantity: 1 }],
          iterations: bootcamp.installment_count,
          metadata
        }],
        metadata
      });

      // Create checkout session for the subscription schedule
      // We'll use subscription mode with the installment price
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url,
        cancel_url,
        metadata: {
          ...metadata,
          schedule_id: subscriptionSchedule.id
        },
        subscription_data: {
          metadata: {
            ...metadata,
            schedule_id: subscriptionSchedule.id,
            is_installment: 'true',
            total_installments: bootcamp.installment_count.toString()
          }
        },
        billing_address_collection: 'required'
      });

      return res.json({
        success: true,
        data: {
          checkout_url: session.url,
          session_id: session.id,
          schedule_id: subscriptionSchedule.id,
          payment_type: 'installment',
          installment_amount: bootcamp.installment_amount,
          total_installments: bootcamp.installment_count,
          total_amount: bootcamp.price_installment_total
        }
      });
    }
  } catch (error) {
    logger.error('Error creating bootcamp checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
};

export const getUserEnrollments = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;

    // Users can only view their own enrollments unless admin
    if (requestingUserId !== userId && !req.user?.roles?.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const cacheKey = `bootcamp_enrollments:${userId}`;
    let enrollments = await getCache<BootcampEnrollmentWithDetails[]>(cacheKey);

    if (!enrollments) {
      const rows = await executeQuery(
        `SELECT
          be.*,
          b.name as bootcamp_name,
          b.slug as bootcamp_slug,
          b.description as bootcamp_description,
          b.duration as bootcamp_duration,
          b.includes_premium_access as bootcamp_includes_premium,
          b.curriculum_json as bootcamp_curriculum
         FROM bootcamp_enrollments be
         JOIN bootcamps b ON be.bootcamp_id = b.id
         WHERE be.user_id = $1
         ORDER BY be.created_at DESC`,
        [convertToUuid(userId)]
      );

      enrollments = rows.map(row => ({
        ...rowToEnrollment(row),
        bootcamp: {
          id: row.bootcamp_id,
          name: row.bootcamp_name,
          slug: row.bootcamp_slug,
          description: row.bootcamp_description,
          duration: row.bootcamp_duration,
          includes_premium_access: row.bootcamp_includes_premium,
          curriculum_json: row.bootcamp_curriculum
        } as Bootcamp
      }));

      await setCache(cacheKey, enrollments, ENROLLMENT_CACHE_TTL);
    }

    res.json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    logger.error('Error fetching user enrollments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollments'
    });
  }
};

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

export const getAllBootcamps = async (req: AuthRequest, res: Response) => {
  try {
    const { active } = req.query;

    let query = 'SELECT * FROM bootcamps';
    const params: any[] = [];

    if (active !== undefined) {
      query += ' WHERE active = $1';
      params.push(active === 'true');
    }

    query += ' ORDER BY sort_order ASC, name ASC';

    const rows = await executeQuery(query, params);
    const bootcamps = rows.map(rowToBootcamp);

    res.json({
      success: true,
      data: bootcamps
    });
  } catch (error) {
    logger.error('Error fetching all bootcamps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bootcamps'
    });
  }
};

export const getBootcampById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const rows = await executeQuery(
      'SELECT * FROM bootcamps WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bootcamp not found'
      });
    }

    const bootcamp = rowToBootcamp(rows[0]);

    res.json({
      success: true,
      data: bootcamp
    });
  } catch (error) {
    logger.error('Error fetching bootcamp by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bootcamp'
    });
  }
};

export const createBootcamp = async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as CreateBootcampRequest;

    // Validate required fields
    if (!data.name || !data.slug || !data.duration) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, slug, duration'
      });
    }

    if (!data.price_full || !data.price_full_discounted || !data.installment_amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing pricing fields: price_full, price_full_discounted, installment_amount'
      });
    }

    // Check for slug uniqueness
    const existing = await executeQuery(
      'SELECT id FROM bootcamps WHERE slug = $1',
      [data.slug]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A bootcamp with this slug already exists'
      });
    }

    const result = await executeQuery(
      `INSERT INTO bootcamps (
        name, slug, description, duration, live_sessions_per_week,
        price_full, price_full_discounted, price_installment_total,
        installment_count, installment_amount, includes_premium_access,
        core_benefits, pay_in_full_benefits, installment_unlock_schedule,
        curriculum_json, stripe_product_id, stripe_price_id_full,
        stripe_price_id_installment, sort_order, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        data.name,
        data.slug,
        data.description || null,
        data.duration,
        data.live_sessions_per_week || null,
        data.price_full,
        data.price_full_discounted,
        data.price_installment_total || (data.installment_amount * (data.installment_count || 4)),
        data.installment_count || 4,
        data.installment_amount,
        data.includes_premium_access ?? true,
        JSON.stringify(data.core_benefits || []),
        JSON.stringify(data.pay_in_full_benefits || []),
        JSON.stringify(data.installment_unlock_schedule || {}),
        JSON.stringify(data.curriculum_json || {}),
        data.stripe_product_id || null,
        data.stripe_price_id_full || null,
        data.stripe_price_id_installment || null,
        data.sort_order || 0,
        data.active ?? true
      ]
    );

    const bootcamp = rowToBootcamp(result[0]);

    // Clear cache
    await deleteCache('bootcamps:active');

    res.status(201).json({
      success: true,
      data: bootcamp,
      message: 'Bootcamp created successfully'
    });
  } catch (error) {
    logger.error('Error creating bootcamp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bootcamp'
    });
  }
};

export const updateBootcamp = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdateBootcampRequest;

    // Check bootcamp exists
    const existing = await executeQuery(
      'SELECT * FROM bootcamps WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bootcamp not found'
      });
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existing[0].slug) {
      const slugExists = await executeQuery(
        'SELECT id FROM bootcamps WHERE slug = $1 AND id != $2',
        [data.slug, id]
      );
      if (slugExists.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A bootcamp with this slug already exists'
        });
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = [
      'name', 'slug', 'description', 'duration', 'live_sessions_per_week',
      'price_full', 'price_full_discounted', 'price_installment_total',
      'installment_count', 'installment_amount', 'includes_premium_access',
      'stripe_product_id', 'stripe_price_id_full', 'stripe_price_id_installment',
      'sort_order', 'active'
    ];

    const jsonFields = ['core_benefits', 'pay_in_full_benefits', 'installment_unlock_schedule', 'curriculum_json'];

    for (const field of fields) {
      if (data[field as keyof UpdateBootcampRequest] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(data[field as keyof UpdateBootcampRequest]);
        paramIndex++;
      }
    }

    for (const field of jsonFields) {
      if (data[field as keyof UpdateBootcampRequest] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(JSON.stringify(data[field as keyof UpdateBootcampRequest]));
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await executeQuery(
      `UPDATE bootcamps SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const bootcamp = rowToBootcamp(result[0]);

    // Clear caches
    await deleteCache('bootcamps:active');
    await deleteCache(`bootcamp:${existing[0].slug}`);
    if (data.slug && data.slug !== existing[0].slug) {
      await deleteCache(`bootcamp:${data.slug}`);
    }

    res.json({
      success: true,
      data: bootcamp,
      message: 'Bootcamp updated successfully'
    });
  } catch (error) {
    logger.error('Error updating bootcamp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bootcamp'
    });
  }
};

export const deleteBootcamp = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check for existing enrollments
    const enrollments = await executeQuery(
      'SELECT COUNT(*) as count FROM bootcamp_enrollments WHERE bootcamp_id = $1',
      [id]
    );

    if (parseInt(enrollments[0].count) > 0) {
      // Soft delete by deactivating
      await executeQuery(
        'UPDATE bootcamps SET active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      await deleteCache('bootcamps:active');

      return res.json({
        success: true,
        message: 'Bootcamp deactivated (has existing enrollments)'
      });
    }

    // Hard delete if no enrollments
    const result = await executeQuery(
      'DELETE FROM bootcamps WHERE id = $1 RETURNING slug',
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bootcamp not found'
      });
    }

    // Clear caches
    await deleteCache('bootcamps:active');
    await deleteCache(`bootcamp:${result[0].slug}`);

    res.json({
      success: true,
      message: 'Bootcamp deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting bootcamp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bootcamp'
    });
  }
};

// ============================================================================
// ADMIN ENROLLMENT MANAGEMENT
// ============================================================================

export const createManualEnrollment = async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body as ManualEnrollmentRequest;

    if (!data.user_id || !data.bootcamp_id || !data.payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: user_id, bootcamp_id, payment_method'
      });
    }

    // Check bootcamp exists
    const bootcamps = await executeQuery(
      'SELECT * FROM bootcamps WHERE id = $1',
      [data.bootcamp_id]
    );

    if (bootcamps.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bootcamp not found'
      });
    }

    const bootcamp = rowToBootcamp(bootcamps[0]);

    // Validate session if provided
    if (data.session_id) {
      const sessionRows = await executeQuery(
        'SELECT * FROM bootcamp_sessions WHERE id = $1 AND bootcamp_id = $2',
        [data.session_id, data.bootcamp_id]
      );

      if (sessionRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Session not found for this bootcamp'
        });
      }
    }

    // Check for existing active enrollment
    const existingEnrollments = await executeQuery(
      `SELECT * FROM bootcamp_enrollments
       WHERE user_id = $1 AND bootcamp_id = $2 AND status IN ('pending', 'active')`,
      [data.user_id, data.bootcamp_id]
    );

    if (existingEnrollments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User already has an active enrollment for this bootcamp'
      });
    }

    const amountPaid = data.amount_paid || 0;
    const amountTotal = bootcamp.price_full_discounted;
    const status = amountPaid >= amountTotal ? 'active' : 'pending';

    const result = await executeQuery(
      `INSERT INTO bootcamp_enrollments (
        user_id, bootcamp_id, session_id, payment_type, payment_method,
        amount_paid, amount_total, status, enrolled_at, admin_notes
      ) VALUES ($1, $2, $3, 'manual', $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.user_id,
        data.bootcamp_id,
        data.session_id || null,
        data.payment_method,
        amountPaid,
        amountTotal,
        status,
        status === 'active' ? new Date() : null,
        data.admin_notes || null
      ]
    );

    const enrollment = rowToEnrollment(result[0]);

    // Grant access if fully paid
    if (status === 'active') {
      await grantBootcampAccess(data.user_id, data.bootcamp_id, enrollment.id);
    }

    // Clear cache
    await deleteCache(`bootcamp_enrollments:${data.user_id}`);

    res.status(201).json({
      success: true,
      data: enrollment,
      message: 'Manual enrollment created successfully'
    });
  } catch (error) {
    logger.error('Error creating manual enrollment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create enrollment'
    });
  }
};

export const updateEnrollment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdateEnrollmentRequest;

    // Get existing enrollment
    const existing = await executeQuery(
      'SELECT * FROM bootcamp_enrollments WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    const enrollment = rowToEnrollment(existing[0]);

    // Build update
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.amount_paid !== undefined) {
      updates.push(`amount_paid = $${paramIndex}`);
      values.push(data.amount_paid);
      paramIndex++;
    }

    if (data.installments_paid !== undefined) {
      updates.push(`installments_paid = $${paramIndex}`);
      values.push(data.installments_paid);
      paramIndex++;
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(data.status);
      paramIndex++;

      if (data.status === 'active' && enrollment.status !== 'active') {
        updates.push(`enrolled_at = NOW()`);
      } else if (data.status === 'completed' && enrollment.status !== 'completed') {
        updates.push(`completed_at = NOW()`);
      } else if (data.status === 'cancelled' && enrollment.status !== 'cancelled') {
        updates.push(`cancelled_at = NOW()`);
      }
    }

    if (data.benefits_unlocked !== undefined) {
      updates.push(`benefits_unlocked = $${paramIndex}`);
      values.push(JSON.stringify(data.benefits_unlocked));
      paramIndex++;
    }

    if (data.admin_notes !== undefined) {
      updates.push(`admin_notes = $${paramIndex}`);
      values.push(data.admin_notes);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await executeQuery(
      `UPDATE bootcamp_enrollments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updated = rowToEnrollment(result[0]);

    // Handle access changes
    if (data.status === 'active' && enrollment.status !== 'active') {
      await grantBootcampAccess(enrollment.user_id, enrollment.bootcamp_id, enrollment.id);
    } else if (data.status === 'cancelled' && enrollment.status !== 'cancelled') {
      await revokeBootcampAccess(enrollment.user_id, enrollment.id);
    }

    // Clear cache
    await deleteCache(`bootcamp_enrollments:${enrollment.user_id}`);

    res.json({
      success: true,
      data: updated,
      message: 'Enrollment updated successfully'
    });
  } catch (error) {
    logger.error('Error updating enrollment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update enrollment'
    });
  }
};

export const getEnrollmentsByBootcamp = async (req: AuthRequest, res: Response) => {
  try {
    const { bootcampId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT be.*, b.name as bootcamp_name
      FROM bootcamp_enrollments be
      JOIN bootcamps b ON be.bootcamp_id = b.id
      WHERE be.bootcamp_id = $1
    `;
    const params: any[] = [bootcampId];

    if (status) {
      query += ` AND be.status = $2`;
      params.push(status);
    }

    query += ' ORDER BY be.created_at DESC';

    const rows = await executeQuery(query, params);
    const enrollments = rows.map(rowToEnrollment);

    res.json({
      success: true,
      data: enrollments
    });
  } catch (error) {
    logger.error('Error fetching bootcamp enrollments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enrollments'
    });
  }
};

// ============================================================================
// SESSION MANAGEMENT - PUBLIC
// ============================================================================

export const getBootcampSessions = async (req: Request, res: Response) => {
  try {
    const { bootcampId } = req.params;

    // Get sessions for this bootcamp
    // Returns: previous (most recent ended), current (ongoing), next (upcoming with enrollment open)
    const rows = await executeQuery(
      `SELECT bs.*,
              (SELECT COUNT(*) FROM bootcamp_enrollments be WHERE be.session_id = bs.id) as enrollment_count
       FROM bootcamp_sessions bs
       WHERE bs.bootcamp_id = $1
       AND (
         -- Most recent ended session
         (bs.status = 'ended' AND bs.id = (
           SELECT id FROM bootcamp_sessions
           WHERE bootcamp_id = $1 AND status = 'ended'
           ORDER BY end_date DESC LIMIT 1
         ))
         OR
         -- Current ongoing session
         bs.status = 'ongoing'
         OR
         -- Next upcoming session with enrollment open
         (bs.status = 'upcoming' AND bs.enrollment_open = true AND bs.id = (
           SELECT id FROM bootcamp_sessions
           WHERE bootcamp_id = $1 AND status = 'upcoming' AND enrollment_open = true
           ORDER BY start_date ASC LIMIT 1
         ))
       )
       ORDER BY
         CASE bs.status
           WHEN 'upcoming' THEN 1
           WHEN 'ongoing' THEN 2
           WHEN 'ended' THEN 3
         END,
         bs.start_date ASC`,
      [bootcampId]
    );

    const sessions = rows.map(rowToSessionWithStats);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Error fetching bootcamp sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bootcamp sessions'
    });
  }
};

// ============================================================================
// SESSION MANAGEMENT - ADMIN
// ============================================================================

export const getAllSessions = async (req: AuthRequest, res: Response) => {
  try {
    const { bootcampId } = req.params;

    const rows = await executeQuery(
      `SELECT bs.*,
              b.name as bootcamp_name,
              (SELECT COUNT(*) FROM bootcamp_enrollments be WHERE be.session_id = bs.id) as enrollment_count
       FROM bootcamp_sessions bs
       JOIN bootcamps b ON bs.bootcamp_id = b.id
       WHERE bs.bootcamp_id = $1
       ORDER BY bs.start_date DESC`,
      [bootcampId]
    );

    const sessions = rows.map(rowToSessionWithStats);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Error fetching all sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions'
    });
  }
};

export const getSessionById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const rows = await executeQuery(
      `SELECT bs.*,
              b.name as bootcamp_name,
              (SELECT COUNT(*) FROM bootcamp_enrollments be WHERE be.session_id = bs.id) as enrollment_count
       FROM bootcamp_sessions bs
       JOIN bootcamps b ON bs.bootcamp_id = b.id
       WHERE bs.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const session = rowToSessionWithStats(rows[0]);

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Error fetching session by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session'
    });
  }
};

export const createSession = async (req: AuthRequest, res: Response) => {
  try {
    const { bootcampId } = req.params;
    const data = req.body as CreateSessionRequest;

    // Validate required fields
    if (!data.name || !data.slug || !data.start_date || !data.end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, slug, start_date, end_date'
      });
    }

    // Verify bootcamp exists
    const bootcampCheck = await executeQuery(
      'SELECT id FROM bootcamps WHERE id = $1',
      [bootcampId]
    );

    if (bootcampCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bootcamp not found'
      });
    }

    // Check slug uniqueness within bootcamp
    const slugCheck = await executeQuery(
      'SELECT id FROM bootcamp_sessions WHERE bootcamp_id = $1 AND slug = $2',
      [bootcampId, data.slug]
    );

    if (slugCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A session with this slug already exists for this bootcamp'
      });
    }

    // Validate dates
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const result = await executeQuery(
      `INSERT INTO bootcamp_sessions (
        bootcamp_id, name, slug, start_date, end_date,
        status, enrollment_open, max_capacity, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        bootcampId,
        data.name,
        data.slug,
        data.start_date,
        data.end_date,
        data.status || 'upcoming',
        data.enrollment_open ?? false,
        data.max_capacity || null,
        data.description || null
      ]
    );

    const session = rowToSession(result[0]);

    // Clear relevant caches
    await deleteCache(`bootcamp_sessions:${bootcampId}`);

    res.status(201).json({
      success: true,
      data: session,
      message: 'Session created successfully'
    });
  } catch (error) {
    logger.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session'
    });
  }
};

export const updateSession = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdateSessionRequest;

    // Get existing session
    const existing = await executeQuery(
      'SELECT * FROM bootcamp_sessions WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const session = existing[0];

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== session.slug) {
      const slugCheck = await executeQuery(
        'SELECT id FROM bootcamp_sessions WHERE bootcamp_id = $1 AND slug = $2 AND id != $3',
        [session.bootcamp_id, data.slug, id]
      );
      if (slugCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A session with this slug already exists for this bootcamp'
        });
      }
    }

    // Validate dates if provided
    if (data.start_date || data.end_date) {
      const startDate = new Date(data.start_date || session.start_date);
      const endDate = new Date(data.end_date || session.end_date);

      if (endDate <= startDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fields = ['name', 'slug', 'start_date', 'end_date', 'status', 'enrollment_open', 'max_capacity', 'description'];

    for (const field of fields) {
      if (data[field as keyof UpdateSessionRequest] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(data[field as keyof UpdateSessionRequest]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await executeQuery(
      `UPDATE bootcamp_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updatedSession = rowToSession(result[0]);

    // Clear relevant caches
    await deleteCache(`bootcamp_sessions:${session.bootcamp_id}`);

    res.json({
      success: true,
      data: updatedSession,
      message: 'Session updated successfully'
    });
  } catch (error) {
    logger.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update session'
    });
  }
};

export const deleteSession = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check for existing enrollments
    const enrollmentCheck = await executeQuery(
      'SELECT COUNT(*) as count FROM bootcamp_enrollments WHERE session_id = $1',
      [id]
    );

    if (parseInt(enrollmentCheck[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete session with existing enrollments. Set status to "ended" instead.'
      });
    }

    // Get session for cache clearing
    const sessionResult = await executeQuery(
      'SELECT bootcamp_id FROM bootcamp_sessions WHERE id = $1',
      [id]
    );

    if (sessionResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const bootcampId = sessionResult[0].bootcamp_id;

    // Delete the session
    await executeQuery(
      'DELETE FROM bootcamp_sessions WHERE id = $1',
      [id]
    );

    // Clear relevant caches
    await deleteCache(`bootcamp_sessions:${bootcampId}`);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete session'
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function grantBootcampAccess(userId: string, bootcampId: string, enrollmentId: string) {
  await executeQuery(
    `INSERT INTO user_access (
      user_id, access_type, access_id, resource_type, resource_id, source
    ) VALUES ($1, 'bootcamp', $2, 'bootcamp', $3, 'bootcamp')
    ON CONFLICT (user_id, access_type, access_id, resource_type, resource_id)
    WHERE revoked_at IS NULL
    DO NOTHING`,
    [convertToUuid(userId), enrollmentId, bootcampId]
  );

  // Also grant premium access if bootcamp includes it
  const bootcamp = await executeQuery(
    'SELECT includes_premium_access FROM bootcamps WHERE id = $1',
    [bootcampId]
  );

  if (bootcamp.length > 0 && bootcamp[0].includes_premium_access) {
    await executeQuery(
      `INSERT INTO user_access (
        user_id, access_type, access_id, resource_type, source
      ) VALUES ($1, 'bootcamp', $2, 'platform', 'bootcamp_premium')
      ON CONFLICT (user_id, access_type, access_id, resource_type, resource_id)
      WHERE revoked_at IS NULL
      DO NOTHING`,
      [convertToUuid(userId), enrollmentId]
    );
  }

  // Clear subscription status cache to reflect new access
  await deleteCache(`subscription_status:${convertToUuid(userId)}`);
}

async function revokeBootcampAccess(userId: string, enrollmentId: string) {
  await executeQuery(
    `UPDATE user_access
     SET revoked_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND access_id = $2 AND access_type = 'bootcamp'
     AND revoked_at IS NULL`,
    [convertToUuid(userId), enrollmentId]
  );

  // Clear subscription status cache
  await deleteCache(`subscription_status:${convertToUuid(userId)}`);
}

// Export for webhook handler
export { grantBootcampAccess, revokeBootcampAccess };
