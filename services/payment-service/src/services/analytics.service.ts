import { executeQuery } from './database.service';
import { logger } from '@cloudmastershub/utils';

/**
 * Parse timeframe string (e.g., '30d', '7d', '1m') into a PostgreSQL interval
 */
function timeframeToInterval(timeframe: string): string {
  const match = timeframe.match(/^(\d+)([dwmy])$/);
  if (!match) return '30 days';

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd': return `${value} days`;
    case 'w': return `${value * 7} days`;
    case 'm': return `${value} months`;
    case 'y': return `${value} years`;
    default: return '30 days';
  }
}

export async function getRevenueAnalytics(timeframe: string) {
  const interval = timeframeToInterval(timeframe);

  // Total revenue in timeframe
  const revenueRows = await executeQuery<{
    total_revenue: string;
    successful_payments: string;
    failed_payments: string;
    avg_payment: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END), 0) AS total_revenue,
       COUNT(CASE WHEN status = 'succeeded' THEN 1 END) AS successful_payments,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_payments,
       COALESCE(AVG(CASE WHEN status = 'succeeded' THEN amount END), 0) AS avg_payment
     FROM payments
     WHERE created_at >= NOW() - $1::interval`,
    [interval]
  );

  // Revenue by day for chart data
  const dailyRevenue = await executeQuery<{
    date: string;
    revenue: string;
    count: string;
  }>(
    `SELECT
       DATE(created_at) AS date,
       COALESCE(SUM(amount), 0) AS revenue,
       COUNT(*) AS count
     FROM payments
     WHERE status = 'succeeded'
       AND created_at >= NOW() - $1::interval
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [interval]
  );

  // Bootcamp revenue in timeframe
  const bootcampRevenue = await executeQuery<{
    total: string;
    enrollment_count: string;
  }>(
    `SELECT
       COALESCE(SUM(amount_paid), 0) AS total,
       COUNT(*) AS enrollment_count
     FROM bootcamp_enrollments
     WHERE status IN ('active', 'completed')
       AND created_at >= NOW() - $1::interval`,
    [interval]
  );

  // Previous period for comparison
  const previousRevenue = await executeQuery<{ total_revenue: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_revenue
     FROM payments
     WHERE status = 'succeeded'
       AND created_at >= NOW() - ($1::interval * 2)
       AND created_at < NOW() - $1::interval`,
    [interval]
  );

  const current = parseFloat(revenueRows[0]?.total_revenue || '0');
  const previous = parseFloat(previousRevenue[0]?.total_revenue || '0');
  const growthRate = previous > 0 ? ((current - previous) / previous) * 100 : 0;

  return {
    totalRevenue: current,
    successfulPayments: parseInt(revenueRows[0]?.successful_payments || '0'),
    failedPayments: parseInt(revenueRows[0]?.failed_payments || '0'),
    averagePayment: parseFloat(parseFloat(revenueRows[0]?.avg_payment || '0').toFixed(2)),
    growthRate: parseFloat(growthRate.toFixed(1)),
    bootcampRevenue: parseFloat(bootcampRevenue[0]?.total || '0'),
    bootcampEnrollments: parseInt(bootcampRevenue[0]?.enrollment_count || '0'),
    dailyRevenue: dailyRevenue.map(row => ({
      date: row.date,
      revenue: parseFloat(row.revenue),
      count: parseInt(row.count),
    })),
    currency: 'usd',
    timeframe,
  };
}

export async function getSubscriptionAnalytics(timeframe: string) {
  const interval = timeframeToInterval(timeframe);

  // Current subscription breakdown by status
  const statusBreakdown = await executeQuery<{
    status: string;
    count: string;
  }>(
    `SELECT status, COUNT(*) AS count
     FROM subscriptions
     GROUP BY status
     ORDER BY count DESC`
  );

  // Subscription breakdown by plan tier
  const tierBreakdown = await executeQuery<{
    tier: string;
    count: string;
  }>(
    `SELECT sp.tier, COUNT(s.id) AS count
     FROM subscriptions s
     JOIN subscription_plans sp ON s.plan_id = sp.id
     WHERE s.status IN ('active', 'trialing')
     GROUP BY sp.tier
     ORDER BY count DESC`
  );

  // New subscriptions in timeframe
  const newSubs = await executeQuery<{
    new_subscriptions: string;
  }>(
    `SELECT COUNT(*) AS new_subscriptions
     FROM subscriptions
     WHERE created_at >= NOW() - $1::interval`,
    [interval]
  );

  // Cancelled subscriptions in timeframe (churn)
  const cancelledSubs = await executeQuery<{
    cancelled: string;
  }>(
    `SELECT COUNT(*) AS cancelled
     FROM subscriptions
     WHERE cancelled_at IS NOT NULL
       AND cancelled_at >= NOW() - $1::interval`,
    [interval]
  );

  // Total active subscriptions
  const activeSubs = await executeQuery<{ active_count: string }>(
    `SELECT COUNT(*) AS active_count
     FROM subscriptions
     WHERE status IN ('active', 'trialing')`
  );

  // MRR (Monthly Recurring Revenue) — sum of active subscription plan prices
  const mrr = await executeQuery<{ mrr: string }>(
    `SELECT COALESCE(SUM(
       CASE
         WHEN sp.interval = 'month' THEN sp.price
         WHEN sp.interval = 'year' THEN sp.price / 12
         ELSE 0
       END
     ), 0) AS mrr
     FROM subscriptions s
     JOIN subscription_plans sp ON s.plan_id = sp.id
     WHERE s.status = 'active'`
  );

  const activeCount = parseInt(activeSubs[0]?.active_count || '0');
  const newCount = parseInt(newSubs[0]?.new_subscriptions || '0');
  const cancelledCount = parseInt(cancelledSubs[0]?.cancelled || '0');
  const churnRate = activeCount > 0 ? (cancelledCount / activeCount) * 100 : 0;

  return {
    totalActive: activeCount,
    newSubscriptions: newCount,
    cancelledSubscriptions: cancelledCount,
    churnRate: parseFloat(churnRate.toFixed(1)),
    mrr: parseFloat(parseFloat(mrr[0]?.mrr || '0').toFixed(2)),
    statusBreakdown: statusBreakdown.map(row => ({
      status: row.status,
      count: parseInt(row.count),
    })),
    tierBreakdown: tierBreakdown.map(row => ({
      tier: row.tier,
      count: parseInt(row.count),
    })),
    timeframe,
  };
}
