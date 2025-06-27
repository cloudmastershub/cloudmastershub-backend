import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { AnalyticsRequest, ReportsRequest } from '@cloudmastershub/types';
import analyticsService from '../services/analyticsService';
import logger from '../utils/logger';

export const getDashboardOverview = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching dashboard overview', {
      adminId: req.adminId,
      timeframe
    });

    const result = await analyticsService.getPlatformOverview(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch dashboard overview'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getDashboardOverview controller:', error);
    next(error);
  }
};

export const getRevenueAnalytics = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching revenue analytics', {
      adminId: req.adminId,
      timeframe
    });

    const result = await analyticsService.getRevenueAnalytics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch revenue analytics'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getRevenueAnalytics controller:', error);
    next(error);
  }
};

export const getSubscriptionAnalytics = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching subscription analytics', {
      adminId: req.adminId,
      timeframe
    });

    const result = await analyticsService.getSubscriptionAnalytics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch subscription analytics'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getSubscriptionAnalytics controller:', error);
    next(error);
  }
};

export const getEngagementMetrics = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching engagement metrics', {
      adminId: req.adminId,
      timeframe
    });

    const result = await analyticsService.getEngagementMetrics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch engagement metrics'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getEngagementMetrics controller:', error);
    next(error);
  }
};

export const generateReport = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, timeframe, format, filters } = req.body as ReportsRequest;

    logger.info('Admin generating report', {
      adminId: req.adminId,
      type,
      timeframe,
      format
    });

    const result = await analyticsService.generateReport(type, timeframe, format, filters);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to generate report'
        }
      });
      return;
    }

    // Log the report generation
    logger.info('Report generated successfully', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      reportType: type,
      timeframe,
      format,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Report generated successfully',
      data: result.data
    });
  } catch (error) {
    logger.error('Error in generateReport controller:', error);
    next(error);
  }
};

export const getSystemHealth = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin checking system health', {
      adminId: req.adminId
    });

    const result = await analyticsService.getSystemHealth();

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to check system health'
        }
      });
      return;
    }

    // Return appropriate status code based on system health
    const statusCode = result.data.overallStatus === 'healthy' ? 200 : 
                      result.data.overallStatus === 'degraded' ? 206 : 503;

    res.status(statusCode).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getSystemHealth controller:', error);
    next(error);
  }
};

export const getAnalyticsSummary = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching analytics summary', {
      adminId: req.adminId,
      timeframe
    });

    // Get a quick summary of key metrics
    const [overview, engagement, health] = await Promise.allSettled([
      analyticsService.getPlatformOverview(timeframe),
      analyticsService.getEngagementMetrics(timeframe),
      analyticsService.getSystemHealth()
    ]);

    const summary = {
      timeframe,
      generatedAt: new Date().toISOString(),
      overview: overview.status === 'fulfilled' && overview.value.success ? overview.value.data : null,
      engagement: engagement.status === 'fulfilled' && engagement.value.success ? engagement.value.data : null,
      systemHealth: health.status === 'fulfilled' && health.value.success ? health.value.data : null,
      errors: [] as string[]
    };

    // Collect any errors
    if (overview.status === 'rejected' || (overview.status === 'fulfilled' && !overview.value.success)) {
      summary.errors.push('Failed to fetch platform overview');
    }
    if (engagement.status === 'rejected' || (engagement.status === 'fulfilled' && !engagement.value.success)) {
      summary.errors.push('Failed to fetch engagement metrics');
    }
    if (health.status === 'rejected' || (health.status === 'fulfilled' && !health.value.success)) {
      summary.errors.push('Failed to check system health');
    }

    const hasData = summary.overview || summary.engagement || summary.systemHealth;
    const statusCode = hasData ? (summary.errors.length > 0 ? 206 : 200) : 500;

    res.status(statusCode).json({
      success: hasData,
      data: summary,
      ...(summary.errors.length > 0 && { 
        warnings: summary.errors 
      })
    });
  } catch (error) {
    logger.error('Error in getAnalyticsSummary controller:', error);
    next(error);
  }
};

export const getRealTimeMetrics = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching real-time metrics', {
      adminId: req.adminId
    });

    // In a real implementation, this would fetch real-time data
    // For now, we'll return mock real-time metrics
    const realTimeData = {
      currentTimestamp: new Date().toISOString(),
      activeUsers: {
        current: 1247,
        peakToday: 1894,
        averageToday: 1156
      },
      systemLoad: {
        cpu: 45.2,
        memory: 67.8,
        storage: 34.1
      },
      activeTransactions: {
        payments: 23,
        enrollments: 156,
        labSessions: 89
      },
      errorRates: {
        api: 0.8,
        payments: 0.2,
        labs: 1.1
      },
      responseTime: {
        averageMs: 245,
        p95Ms: 680,
        p99Ms: 1200
      }
    };

    res.status(200).json({
      success: true,
      data: realTimeData
    });
  } catch (error) {
    logger.error('Error in getRealTimeMetrics controller:', error);
    next(error);
  }
};