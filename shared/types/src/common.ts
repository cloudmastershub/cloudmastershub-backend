export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: Pagination;
  meta?: Record<string, any>;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: any;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface EventPayload {
  eventType: string;
  timestamp: Date;
  userId?: string;
  data: any;
  metadata?: Record<string, any>;
}