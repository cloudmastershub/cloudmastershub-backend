import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import logger from './logger';

export interface ServiceEndpoints {
  userService: string;
  courseService: string;
  labService: string;
  paymentService: string;
  adminService: string;
}

export interface HttpClientConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  defaultHeaders?: Record<string, string>;
}

export class HttpClient {
  private axios: AxiosInstance;
  private config: HttpClientConfig;
  private endpoints: ServiceEndpoints;

  constructor(endpoints: ServiceEndpoints, config: HttpClientConfig = {}) {
    this.endpoints = endpoints;
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.axios = axios.create({
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CloudMastersHub-Internal',
        ...this.config.defaultHeaders,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.debug('Outgoing request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
          data: config.data ? 'present' : 'none',
        });
        return config;
      },
      (error) => {
        logger.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.axios.interceptors.response.use(
      (response) => {
        logger.debug('Incoming response', {
          status: response.status,
          url: response.config.url,
          data: response.data ? 'present' : 'none',
        });
        return response;
      },
      async (error) => {
        const config = error.config;

        logger.error('Response error', {
          status: error.response?.status,
          url: config?.url,
          message: error.message,
          data: error.response?.data,
        });

        // Retry logic for network errors and 5xx errors
        if (this.shouldRetry(error) && config && !config._retryCount) {
          config._retryCount = 0;
        }

        if (config && config._retryCount < (this.config.retries || 3)) {
          config._retryCount += 1;

          logger.info(`Retrying request (${config._retryCount}/${this.config.retries})`, {
            url: config.url,
            method: config.method,
          });

          await this.delay(this.config.retryDelay || 1000);
          return this.axios(config);
        }

        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors
    if (!error.response) {
      return true;
    }

    // Retry on 5xx server errors
    if (error.response.status >= 500) {
      return true;
    }

    // Retry on specific 4xx errors that might be temporary
    if ([408, 429].includes(error.response.status)) {
      return true;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.get<T>(url, config);
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axios.post<T>(url, data, config);
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axios.put<T>(url, data, config);
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.axios.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axios.delete<T>(url, config);
  }

  // Service-specific methods
  async callUserService<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const url = `${this.endpoints.userService}${endpoint}`;

    switch (method) {
      case 'GET':
        return this.get<T>(url, config);
      case 'POST':
        return this.post<T>(url, data, config);
      case 'PUT':
        return this.put<T>(url, data, config);
      case 'DELETE':
        return this.delete<T>(url, config);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  async callCourseService<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const url = `${this.endpoints.courseService}${endpoint}`;

    switch (method) {
      case 'GET':
        return this.get<T>(url, config);
      case 'POST':
        return this.post<T>(url, data, config);
      case 'PUT':
        return this.put<T>(url, data, config);
      case 'DELETE':
        return this.delete<T>(url, config);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  async callLabService<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const url = `${this.endpoints.labService}${endpoint}`;

    switch (method) {
      case 'GET':
        return this.get<T>(url, config);
      case 'POST':
        return this.post<T>(url, data, config);
      case 'PUT':
        return this.put<T>(url, data, config);
      case 'DELETE':
        return this.delete<T>(url, config);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  async callPaymentService<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const url = `${this.endpoints.paymentService}${endpoint}`;

    switch (method) {
      case 'GET':
        return this.get<T>(url, config);
      case 'POST':
        return this.post<T>(url, data, config);
      case 'PUT':
        return this.put<T>(url, data, config);
      case 'DELETE':
        return this.delete<T>(url, config);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  async callAdminService<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const url = `${this.endpoints.adminService}${endpoint}`;

    switch (method) {
      case 'GET':
        return this.get<T>(url, config);
      case 'POST':
        return this.post<T>(url, data, config);
      case 'PUT':
        return this.put<T>(url, data, config);
      case 'DELETE':
        return this.delete<T>(url, config);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }
}

// Factory function to create configured HTTP client
export const createHttpClient = (config?: Partial<HttpClientConfig>): HttpClient => {
  const endpoints: ServiceEndpoints = {
    userService: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    courseService: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
    labService: process.env.LAB_SERVICE_URL || 'http://lab-service:3003',
    paymentService: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
    adminService: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
  };

  return new HttpClient(endpoints, config);
};

// Singleton instance for shared usage
let httpClientInstance: HttpClient | null = null;

export const getHttpClient = (): HttpClient => {
  if (!httpClientInstance) {
    httpClientInstance = createHttpClient();
  }
  return httpClientInstance;
};

// Service-specific client factories
export const createPaymentServiceClient = () => {
  return {
    async getSubscriptionStatus(userId: string) {
      const client = getHttpClient();
      return client.callPaymentService(`/api/subscriptions/status/${userId}`, 'GET');
    },

    async verifyAccess(userId: string, resourceType: string, resourceId?: string) {
      const client = getHttpClient();
      return client.callPaymentService('/api/access/verify', 'POST', {
        userId,
        resourceType,
        resourceId,
      });
    },

    async checkUsageLimits(userId: string, resourceType: string, action: string = 'check') {
      const client = getHttpClient();
      return client.callPaymentService('/api/usage/check', 'POST', {
        userId,
        resourceType,
        action,
      });
    },
  };
};

export const createUserServiceClient = () => {
  return {
    async getUserProfile(userId: string) {
      const client = getHttpClient();
      return client.callUserService(`/users/${userId}`, 'GET');
    },

    async updateUserSubscription(userId: string, subscriptionData: any) {
      const client = getHttpClient();
      return client.callUserService(`/users/${userId}/subscription`, 'PUT', subscriptionData);
    },
  };
};

export const createCourseServiceClient = () => {
  return {
    async getCourse(courseId: string) {
      const client = getHttpClient();
      return client.callCourseService(`/courses/${courseId}`, 'GET');
    },

    async updateCourseAccess(courseId: string, userId: string, hasAccess: boolean) {
      const client = getHttpClient();
      return client.callCourseService(`/courses/${courseId}/access`, 'PUT', {
        userId,
        hasAccess,
      });
    },
  };
};

export const createLabServiceClient = () => {
  return {
    async getLab(labId: string) {
      const client = getHttpClient();
      return client.callLabService(`/labs/${labId}`, 'GET');
    },

    async updateLabAccess(labId: string, userId: string, hasAccess: boolean) {
      const client = getHttpClient();
      return client.callLabService(`/labs/${labId}/access`, 'PUT', {
        userId,
        hasAccess,
      });
    },
  };
};
