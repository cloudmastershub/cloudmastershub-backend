import logger from '../utils/logger';
import userService from './userService';
import contentService from './contentService';

interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: any;
}

class AnalyticsServiceClient {
  private paymentServiceUrl: string;

  constructor() {
    this.paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';
  }

  async getRevenueAnalytics(timeframe: string): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.paymentServiceUrl}/admin/analytics/revenue?timeframe=${timeframe}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch revenue analytics:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with payment service' 
      };
    }
  }

  async getSubscriptionAnalytics(timeframe: string): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.paymentServiceUrl}/admin/analytics/subscriptions?timeframe=${timeframe}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch subscription analytics:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with payment service' 
      };
    }
  }

  async getPlatformOverview(timeframe: string): Promise<ServiceResponse> {
    try {
      // Aggregate data from multiple services
      const [userMetrics, contentMetrics, revenueMetrics] = await Promise.all([
        userService.getUserAnalytics(timeframe),
        contentService.getContentAnalytics(timeframe),
        this.getRevenueAnalytics(timeframe)
      ]);

      if (!userMetrics.success || !contentMetrics.success || !revenueMetrics.success) {
        throw new Error('Failed to fetch complete platform overview data');
      }

      const overview = {
        timeframe,
        generatedAt: new Date().toISOString(),
        userMetrics: userMetrics.data,
        contentMetrics: contentMetrics.data,
        revenueMetrics: revenueMetrics.data,
        summary: {
          totalUsers: userMetrics.data?.totalUsers || 0,
          activeUsers: userMetrics.data?.activeUsers || 0,
          totalCourses: contentMetrics.data?.totalCourses || 0,
          totalLearningPaths: contentMetrics.data?.totalLearningPaths || 0,
          totalRevenue: revenueMetrics.data?.totalRevenue || 0,
          averageRating: contentMetrics.data?.averageRating || 0,
        }
      };

      return { success: true, data: overview };
    } catch (error) {
      logger.error('Failed to generate platform overview:', error);
      return { 
        success: false, 
        error: 'Failed to aggregate platform data' 
      };
    }
  }

  async getEngagementMetrics(timeframe: string): Promise<ServiceResponse> {
    try {
      // This would typically aggregate from multiple services
      // For now, we'll create mock data structure that could be populated
      const mockEngagementData = {
        timeframe,
        averageSessionDuration: 45, // minutes
        dailyActiveUsers: 1250,
        weeklyActiveUsers: 3400,
        monthlyActiveUsers: 12500,
        courseCompletionRate: 72.5,
        pathCompletionRate: 68.3,
        userRetentionRate: 84.2,
        bounceRate: 15.8,
        engagementTrend: [
          { date: '2024-12-19', value: 68.2 },
          { date: '2024-12-20', value: 72.1 },
          { date: '2024-12-21', value: 70.8 },
          { date: '2024-12-22', value: 74.5 },
          { date: '2024-12-23', value: 73.2 },
          { date: '2024-12-24', value: 76.1 },
          { date: '2024-12-25', value: 75.8 }
        ],
        topEngagingContent: [
          {
            id: 'course-1',
            title: 'AWS Solutions Architect Fundamentals',
            type: 'course',
            engagementScore: 94.5,
            completionRate: 87.2
          },
          {
            id: 'path-1',
            title: 'Full Stack Cloud Developer',
            type: 'learning_path',
            engagementScore: 91.8,
            completionRate: 83.4
          }
        ]
      };

      return { success: true, data: mockEngagementData };
    } catch (error) {
      logger.error('Failed to fetch engagement metrics:', error);
      return { 
        success: false, 
        error: 'Failed to calculate engagement metrics' 
      };
    }
  }

  async generateReport(
    type: string,
    timeframe: string,
    format: string,
    filters?: any
  ): Promise<ServiceResponse> {
    try {
      logger.info('Generating analytics report', { type, timeframe, format, filters });

      let reportData;

      switch (type) {
        case 'user_activity':
          reportData = await userService.getUserAnalytics(timeframe);
          break;
        case 'revenue':
          reportData = await this.getRevenueAnalytics(timeframe);
          break;
        case 'content_performance':
          reportData = await contentService.getContentAnalytics(timeframe);
          break;
        case 'subscription_analytics':
          reportData = await this.getSubscriptionAnalytics(timeframe);
          break;
        default:
          return { success: false, error: 'Invalid report type' };
      }

      if (!reportData.success) {
        return reportData;
      }

      // In a real implementation, you would format the data according to the requested format
      const report = {
        type,
        timeframe,
        format,
        filters,
        data: reportData.data,
        generatedAt: new Date().toISOString(),
        downloadUrl: `${process.env.ADMIN_SERVICE_URL || 'http://localhost:3005'}/admin/reports/download/${type}-${Date.now()}.${format}`
      };

      return { success: true, data: report };
    } catch (error) {
      logger.error('Failed to generate report:', error);
      return { 
        success: false, 
        error: 'Failed to generate report' 
      };
    }
  }

  async getSystemHealth(): Promise<ServiceResponse> {
    try {
      // Check health of all microservices
      const services = [
        { name: 'user-service', url: process.env.USER_SERVICE_URL || 'http://user-service:3001' },
        { name: 'course-service', url: process.env.COURSE_SERVICE_URL || 'http://course-service:3002' },
        { name: 'lab-service', url: process.env.LAB_SERVICE_URL || 'http://lab-service:3003' },
        { name: 'payment-service', url: this.paymentServiceUrl }
      ];

      const healthChecks = await Promise.allSettled(
        services.map(async (service) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${service.url}/health`, {
              method: 'GET',
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return {
              service: service.name,
              status: response.ok ? 'healthy' : 'unhealthy',
              responseTime: response.ok ? 'fast' : 'slow'
            };
          } catch (error) {
            return {
              service: service.name,
              status: 'unhealthy',
              error: 'Connection failed'
            };
          }
        })
      );

      const healthData = {
        overallStatus: 'healthy',
        services: healthChecks.map(result => 
          result.status === 'fulfilled' ? result.value : {
            service: 'unknown',
            status: 'error',
            error: 'Health check failed'
          }
        ),
        checkedAt: new Date().toISOString()
      };

      // Determine overall status
      const unhealthyServices = healthData.services.filter(s => s.status !== 'healthy');
      if (unhealthyServices.length > 0) {
        healthData.overallStatus = unhealthyServices.length > 2 ? 'critical' : 'degraded';
      }

      return { success: true, data: healthData };
    } catch (error) {
      logger.error('Failed to check system health:', error);
      return { 
        success: false, 
        error: 'Failed to check system health' 
      };
    }
  }
}

export default new AnalyticsServiceClient();