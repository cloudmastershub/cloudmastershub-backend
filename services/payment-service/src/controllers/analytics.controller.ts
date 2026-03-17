import { Request, Response } from 'express';
import { logger } from '@cloudmastershub/utils';
import { getRevenueAnalytics, getSubscriptionAnalytics } from '../services/analytics.service';

export const revenueAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const timeframe = (req.query.timeframe as string) || '30d';
    logger.info('Fetching revenue analytics', { timeframe });

    const data = await getRevenueAnalytics(timeframe);

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Failed to fetch revenue analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analytics',
    });
  }
};

export const subscriptionAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const timeframe = (req.query.timeframe as string) || '30d';
    logger.info('Fetching subscription analytics', { timeframe });

    const data = await getSubscriptionAnalytics(timeframe);

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Failed to fetch subscription analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription analytics',
    });
  }
};
