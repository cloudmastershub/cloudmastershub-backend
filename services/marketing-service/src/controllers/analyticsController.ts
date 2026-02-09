import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import logger from '../utils/logger';

function parseDateRange(req: Request): { startDate?: Date; endDate?: Date } {
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

  if (startDate && isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate format. Use ISO 8601.');
  }
  if (endDate && isNaN(endDate.getTime())) {
    throw new Error('Invalid endDate format. Use ISO 8601.');
  }

  return { startDate, endDate };
}

/**
 * GET /admin/analytics/overview
 */
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const data = await analyticsService.getDashboardOverview(startDate, endDate);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Analytics overview error:', error);
    res.status(error.message?.includes('Invalid') ? 400 : 500).json({
      success: false,
      error: { message: error.message || 'Failed to get dashboard overview' },
    });
  }
};

/**
 * GET /admin/analytics/email
 */
export const getEmailPerformance = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const data = await analyticsService.getEmailPerformance(startDate, endDate);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Email analytics error:', error);
    res.status(error.message?.includes('Invalid') ? 400 : 500).json({
      success: false,
      error: { message: error.message || 'Failed to get email performance' },
    });
  }
};

/**
 * GET /admin/analytics/sequences
 * GET /admin/analytics/sequences/:id
 */
export const getSequencePerformance = async (req: Request, res: Response) => {
  try {
    const sequenceId = req.params.id;
    const data = await analyticsService.getSequencePerformance(sequenceId);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Sequence analytics error:', error);
    res.status(error.message?.includes('Invalid') ? 400 : 500).json({
      success: false,
      error: { message: error.message || 'Failed to get sequence performance' },
    });
  }
};

/**
 * GET /admin/analytics/lifecycle
 */
export const getLifecycleFunnel = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const data = await analyticsService.getLifecycleFunnel(startDate, endDate);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Lifecycle analytics error:', error);
    res.status(error.message?.includes('Invalid') ? 400 : 500).json({
      success: false,
      error: { message: error.message || 'Failed to get lifecycle funnel' },
    });
  }
};

/**
 * GET /admin/analytics/funnels/:id
 */
export const getFunnelStepAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req);
    const data = await analyticsService.getFunnelStepAnalytics(req.params.id, startDate, endDate);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Funnel analytics error:', error);
    res.status(error.message?.includes('Invalid') ? 400 : 500).json({
      success: false,
      error: { message: error.message || 'Failed to get funnel step analytics' },
    });
  }
};
