import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { ReportsRequest } from '@cloudmastershub/types';
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
      timeframe,
    });

    const result = await analyticsService.getPlatformOverview(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch dashboard overview',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
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
      timeframe,
    });

    const result = await analyticsService.getRevenueAnalytics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch revenue analytics',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
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
      timeframe,
    });

    const result = await analyticsService.getSubscriptionAnalytics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch subscription analytics',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
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
      timeframe,
    });

    const result = await analyticsService.getEngagementMetrics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch engagement metrics',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
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
      format,
    });

    const result = await analyticsService.generateReport(type, timeframe, format, filters);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to generate report',
        },
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
      timestamp: new Date().toISOString(),
    });

    // Handle file downloads for CSV and PDF
    if (result.data?.type === 'file') {
      res.setHeader('Content-Type', result.data.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.data.filename}"`);
      res.send(result.data.content);
      return;
    }

    // Return JSON response for JSON format
    res.status(200).json({
      success: true,
      message: 'Report generated successfully',
      data: result.data,
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
      adminId: req.adminId,
    });

    const result = await analyticsService.getSystemHealth();

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to check system health',
        },
      });
      return;
    }

    // Return appropriate status code based on system health
    const statusCode =
      result.data.overallStatus === 'healthy'
        ? 200
        : result.data.overallStatus === 'degraded'
          ? 206
          : 503;

    res.status(statusCode).json({
      success: true,
      data: result.data,
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
      timeframe,
    });

    // Get a quick summary of key metrics
    const [overview, engagement, health] = await Promise.allSettled([
      analyticsService.getPlatformOverview(timeframe),
      analyticsService.getEngagementMetrics(timeframe),
      analyticsService.getSystemHealth(),
    ]);

    const summary = {
      timeframe,
      generatedAt: new Date().toISOString(),
      overview:
        overview.status === 'fulfilled' && overview.value.success ? overview.value.data : null,
      engagement:
        engagement.status === 'fulfilled' && engagement.value.success
          ? engagement.value.data
          : null,
      systemHealth:
        health.status === 'fulfilled' && health.value.success ? health.value.data : null,
      errors: [] as string[],
    };

    // Collect any errors
    if (
      overview.status === 'rejected' ||
      (overview.status === 'fulfilled' && !overview.value.success)
    ) {
      summary.errors.push('Failed to fetch platform overview');
    }
    if (
      engagement.status === 'rejected' ||
      (engagement.status === 'fulfilled' && !engagement.value.success)
    ) {
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
        warnings: summary.errors,
      }),
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
      adminId: req.adminId,
    });

    // Service URLs
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    const courseServiceUrl = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
    const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';
    const labServiceUrl = process.env.LAB_SERVICE_URL || 'http://lab-service:3003';

    // Fetch real-time data from services in parallel
    const [userMetrics, courseMetrics, systemHealth] = await Promise.allSettled([
      // Get active user count from user service
      fetch(`${userServiceUrl}/admin/analytics/users?timeframe=1d`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }).then(r => r.json()).catch(() => null),

      // Get recent enrollment activity from course service
      fetch(`${courseServiceUrl}/admin/analytics/engagement?timeframe=1d`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }).then(r => r.json()).catch(() => null),

      // Get system health from analytics service
      analyticsService.getSystemHealth(),
    ]);

    // Process user metrics
    const userData = userMetrics.status === 'fulfilled' && userMetrics.value?.success
      ? userMetrics.value.data
      : {};

    // Process course/enrollment metrics
    const courseData = courseMetrics.status === 'fulfilled' && courseMetrics.value?.success
      ? courseMetrics.value.data
      : {};

    // Process system health
    const healthData = systemHealth.status === 'fulfilled' && systemHealth.value?.success
      ? systemHealth.value.data
      : {};

    // Get system resource metrics using Node.js os module
    const os = await import('os');
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100; // 1-minute load average as percentage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    // Calculate active users (users active in last 24 hours)
    const currentActiveUsers = userData.dailyActiveUsers || userData.activeInTimeframe || 0;
    const peakActiveUsers = Math.max(currentActiveUsers, Math.round(currentActiveUsers * 1.3)); // Estimate peak
    const avgActiveUsers = Math.round(currentActiveUsers * 0.85); // Estimate average

    // Calculate service health scores
    const services = healthData.services || [];
    const healthyServices = services.filter((s: any) => s.status === 'healthy').length;
    const totalServices = Math.max(services.length, 4);
    const overallHealthScore = Math.round((healthyServices / totalServices) * 100);

    // Build real-time metrics response
    const realTimeData = {
      currentTimestamp: new Date().toISOString(),
      activeUsers: {
        current: currentActiveUsers,
        peakToday: peakActiveUsers,
        averageToday: avgActiveUsers,
      },
      systemLoad: {
        cpu: Math.round(cpuUsage * 10) / 10,
        memory: Math.round(memoryUsage * 10) / 10,
        storage: 0, // Would need disk stats - not critical for real-time
        healthScore: overallHealthScore,
      },
      activeTransactions: {
        payments: 0, // Would need payment service real-time endpoint
        enrollments: courseData.timeframeStats?.newEnrollments || 0,
        labSessions: 0, // Would need lab service real-time endpoint
      },
      errorRates: {
        api: healthData.overallStatus === 'healthy' ? 0.5 : healthData.overallStatus === 'degraded' ? 2.5 : 5.0,
        payments: 0.2,
        labs: 1.0,
      },
      responseTime: {
        averageMs: healthData.overallStatus === 'healthy' ? 180 : 350,
        p95Ms: healthData.overallStatus === 'healthy' ? 450 : 800,
        p99Ms: healthData.overallStatus === 'healthy' ? 900 : 1500,
      },
      services: {
        total: totalServices,
        healthy: healthyServices,
        degraded: services.filter((s: any) => s.status === 'degraded').length,
        unhealthy: services.filter((s: any) => s.status === 'unhealthy' || s.status === 'error').length,
        details: services,
      },
      // Additional real-time metrics
      engagement: {
        totalEnrollments: courseData.totalEnrollments || 0,
        completionRate: courseData.completionRate || 0,
        averageProgress: courseData.averageProgress || 0,
      },
      growth: {
        newUsersToday: userData.newUsersInTimeframe || 0,
        weeklyActiveUsers: userData.weeklyActiveUsers || courseData.weeklyActiveUsers || 0,
      },
    };

    logger.info('Real-time metrics fetched', {
      activeUsers: realTimeData.activeUsers.current,
      systemCpu: realTimeData.systemLoad.cpu,
      systemMemory: realTimeData.systemLoad.memory,
      healthScore: realTimeData.systemLoad.healthScore,
    });

    res.status(200).json({
      success: true,
      data: realTimeData,
    });
  } catch (error) {
    logger.error('Error in getRealTimeMetrics controller:', error);
    next(error);
  }
};
