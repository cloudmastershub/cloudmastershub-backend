import logger from '../utils/logger';

interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: any;
}

class ContentServiceClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = this.authToken;
    }
    return headers;
  }

  async getContentForModeration(params: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ServiceResponse> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.baseUrl}/admin/moderation?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch content for moderation:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async getContentById(
    contentId: string,
    contentType: 'course' | 'learning_path'
  ): Promise<ServiceResponse> {
    try {
      const endpoint = contentType === 'course' ? 'courses' : 'paths';
      const response = await fetch(`${this.baseUrl}/${endpoint}/${contentId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch content by ID:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async moderateContent(
    contentId: string,
    contentType: 'course' | 'learning_path',
    action: 'approve' | 'reject' | 'flag' | 'unflag',
    reason?: string,
    notes?: string
  ): Promise<ServiceResponse> {
    try {
      const endpoint = contentType === 'course' ? 'courses' : 'paths';
      const response = await fetch(`${this.baseUrl}/admin/${endpoint}/${contentId}/moderate`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ action, reason, notes }),
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to moderate content:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async getFlaggedContent(params: {
    page?: number;
    limit?: number;
    type?: string;
  }): Promise<ServiceResponse> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.baseUrl}/admin/flagged?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch flagged content:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async getContentAnalytics(timeframe: string): Promise<ServiceResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/admin/analytics/content?timeframe=${timeframe}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch content analytics:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async getPopularContent(params: {
    type?: string;
    timeframe?: string;
    limit?: number;
  }): Promise<ServiceResponse> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.baseUrl}/admin/popular?${queryParams}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch popular content:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async bulkModerateContent(
    contentItems: Array<{
      contentId: string;
      contentType: 'course' | 'learning_path';
    }>,
    action: 'approve' | 'reject',
    reason?: string
  ): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/bulk-moderate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ contentItems, action, reason }),
      });

      const data = await response.json();
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to bulk moderate content:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }
}

export default new ContentServiceClient();
