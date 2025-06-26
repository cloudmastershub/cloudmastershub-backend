import logger from '../utils/logger';

interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: any;
}

class UserServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
  }

  async getUsers(params: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    subscription?: string;
    search?: string;
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

      const response = await fetch(`${this.baseUrl}/admin/users?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to fetch users from user service:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with user service' 
      };
    }
  }

  async getUserById(userId: string): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to fetch user by ID from user service:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with user service' 
      };
    }
  }

  async updateUserStatus(
    userId: string, 
    action: string, 
    reason?: string, 
    duration?: number
  ): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, reason, duration }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to update user status:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with user service' 
      };
    }
  }

  async promoteUser(userId: string, newRole: string, reason?: string): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/users/${userId}/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newRole, reason }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to promote user:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with user service' 
      };
    }
  }

  async getInstructorApplications(params: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ServiceResponse> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.baseUrl}/admin/instructor-applications?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to fetch instructor applications:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with user service' 
      };
    }
  }

  async reviewInstructorApplication(
    applicationId: string, 
    action: 'approve' | 'reject', 
    notes?: string
  ): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/instructor-applications/${applicationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, notes }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to review instructor application:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with user service' 
      };
    }
  }

  async getUserAnalytics(timeframe: string): Promise<ServiceResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/admin/analytics/users?timeframe=${timeframe}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to fetch user analytics:', error);
      return { 
        success: false, 
        error: 'Failed to communicate with user service' 
      };
    }
  }
}

export default new UserServiceClient();