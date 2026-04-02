import { Router, Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { executeQuery } from '../services/database.service';

const router = Router();

/**
 * GET /admin/stats
 * Returns summary payment/subscription stats for the admin dashboard.
 * Called internally by user-service — no auth middleware (internal service header check).
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const internalService = req.headers['x-internal-service'];
    if (!internalService) {
      res.status(403).json({ success: false, message: 'Internal service access only' });
      return;
    }

    // Total revenue (all time, succeeded payments)
    const revenueRows = await executeQuery<{ total_revenue: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total_revenue
       FROM payments
       WHERE status = 'succeeded'`
    );

    // Monthly revenue (current calendar month)
    const monthlyRows = await executeQuery<{ monthly_revenue: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS monthly_revenue
       FROM payments
       WHERE status = 'succeeded'
         AND created_at >= date_trunc('month', NOW())`
    );

    // Previous month revenue (for growth calculation)
    const prevMonthRows = await executeQuery<{ prev_revenue: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS prev_revenue
       FROM payments
       WHERE status = 'succeeded'
         AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month')
         AND created_at < date_trunc('month', NOW())`
    );

    // Active subscriptions count
    const activeSubRows = await executeQuery<{ active_count: string }>(
      `SELECT COUNT(*) AS active_count
       FROM subscriptions
       WHERE status IN ('active', 'trialing')`
    );

    const totalRevenue = parseFloat(revenueRows[0]?.total_revenue || '0');
    const monthlyRevenue = parseFloat(monthlyRows[0]?.monthly_revenue || '0');
    const prevMonthRevenue = parseFloat(prevMonthRows[0]?.prev_revenue || '0');
    const monthlyGrowth = prevMonthRevenue > 0
      ? parseFloat((((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(1))
      : 0;
    const activeSubscriptions = parseInt(activeSubRows[0]?.active_count || '0');

    res.json({
      success: true,
      data: {
        totalRevenue,
        monthlyRevenue,
        monthlyGrowth,
        activeSubscriptions,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment stats',
    });
  }
});

export default router;
