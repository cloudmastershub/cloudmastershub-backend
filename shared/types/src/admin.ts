import { User, UserRole, SubscriptionPlanType } from './user';
import { Course, CourseStatus } from './course';
import { LearningPath } from './learning-path';

// Admin User Interface (extends base User)
export interface AdminUser extends User {
  permissions: AdminPermission[];
  lastLoginAt?: Date;
  loginCount: number;
  isActive: boolean;
}

// Admin Permissions
export enum AdminPermission {
  MANAGE_USERS = 'manage_users',
  MODERATE_CONTENT = 'moderate_content',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_PAYMENTS = 'manage_payments',
  SYSTEM_ADMIN = 'system_admin',
}

// User Management Types
export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  subscription: SubscriptionPlanType;
  status: UserStatus;
  createdAt: Date;
  lastActiveAt: Date;
  totalCourses: number;
  totalSpent: number;
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  PENDING_VERIFICATION = 'pending_verification',
}

export interface UserManagementAction {
  action: 'ban' | 'unban' | 'suspend' | 'promote' | 'demote' | 'verify';
  userId: string;
  reason?: string;
  duration?: number; // For temporary suspensions (days)
}

export interface InstructorApplication {
  id: string;
  userId: string;
  applicant: {
    firstName: string;
    lastName: string;
    email: string;
    bio?: string;
  };
  expertise: string[];
  experience: string;
  portfolio?: string;
  applicationReason: string;
  status: ApplicationStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  UNDER_REVIEW = 'under_review',
}

// Content Moderation Types
export interface ContentModerationItem {
  id: string;
  type: 'course' | 'learning_path';
  title: string;
  description: string;
  instructorId: string;
  instructorName: string;
  status: ContentModerationStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
  flagCount: number;
  flags: ContentFlag[];
}

export enum ContentModerationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
  UNDER_REVIEW = 'under_review',
}

export interface ContentFlag {
  id: string;
  contentId: string;
  contentType: 'course' | 'learning_path';
  reporterId: string;
  reason: FlagReason;
  description?: string;
  status: FlagStatus;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export enum FlagReason {
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  COPYRIGHT_VIOLATION = 'copyright_violation',
  SPAM = 'spam',
  MISLEADING_INFORMATION = 'misleading_information',
  POOR_QUALITY = 'poor_quality',
  OTHER = 'other',
}

export enum FlagStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export interface ContentModerationAction {
  action: 'approve' | 'reject' | 'flag' | 'unflag';
  contentId: string;
  contentType: 'course' | 'learning_path';
  reason?: string;
  notes?: string;
}

// Analytics Types
export interface PlatformAnalytics {
  overview: PlatformOverview;
  userMetrics: UserMetrics;
  contentMetrics: ContentMetrics;
  revenueMetrics: RevenueMetrics;
  engagementMetrics: EngagementMetrics;
  timeframe: AnalyticsTimeframe;
  generatedAt: Date;
}

export interface PlatformOverview {
  totalUsers: number;
  activeUsers: number;
  totalInstructors: number;
  totalCourses: number;
  totalLearningPaths: number;
  totalRevenue: number;
  averageRating: number;
}

export interface UserMetrics {
  newUsersThisPeriod: number;
  userGrowthRate: number;
  usersBySubscription: SubscriptionBreakdown;
  usersByRole: RoleBreakdown;
  userRetentionRate: number;
  averageSessionDuration: number;
  userActivityTrend: ChartDataPoint[];
}

export interface ContentMetrics {
  newCoursesThisPeriod: number;
  newPathsThisPeriod: number;
  contentGrowthRate: number;
  averageCourseRating: number;
  mostPopularCourses: PopularContent[];
  contentByCategory: CategoryBreakdown;
  completionRates: CompletionRateData;
}

export interface RevenueMetrics {
  totalRevenue: number;
  revenueThisPeriod: number;
  revenueGrowthRate: number;
  revenueBySubscription: SubscriptionRevenue;
  revenueByContent: ContentRevenue;
  averageRevenuePerUser: number;
  refundRate: number;
  revenueTrend: ChartDataPoint[];
}

export interface EngagementMetrics {
  averageTimeSpent: number;
  courseCompletionRate: number;
  pathCompletionRate: number;
  userEngagementScore: number;
  mostEngagingContent: PopularContent[];
  engagementTrend: ChartDataPoint[];
}

export interface SubscriptionBreakdown {
  free: number;
  premium: number;
  enterprise: number;
}

export interface RoleBreakdown {
  students: number;
  instructors: number;
  admins: number;
}

export interface PopularContent {
  id: string;
  title: string;
  type: 'course' | 'learning_path';
  enrollments: number;
  rating: number;
  revenue?: number;
}

export interface CategoryBreakdown {
  [category: string]: number;
}

export interface CompletionRateData {
  courses: number;
  learningPaths: number;
  byCategory: CategoryBreakdown;
}

export interface SubscriptionRevenue {
  free: number;
  premium: number;
  enterprise: number;
}

export interface ContentRevenue {
  courses: number;
  learningPaths: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}

export enum AnalyticsTimeframe {
  WEEK = '7d',
  MONTH = '30d',
  QUARTER = '90d',
  YEAR = '1y',
}

// System Settings Types
export interface PlatformSettings {
  general: GeneralSettings;
  security: SecuritySettings;
  payment: PaymentSettings;
  content: ContentSettings;
  email: EmailSettings;
  features: FeatureFlags;
}

export interface GeneralSettings {
  siteName: string;
  siteDescription: string;
  supportEmail: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  defaultLanguage: string;
  timezone: string;
}

export interface SecuritySettings {
  passwordMinLength: number;
  passwordRequireSpecialChars: boolean;
  sessionTimeout: number; // minutes
  maxLoginAttempts: number;
  lockoutDuration: number; // minutes
  twoFactorRequired: boolean;
}

export interface PaymentSettings {
  currency: string;
  taxRate: number;
  refundWindow: number; // days
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  trialPeriod: number; // days
}

export interface ContentSettings {
  autoApproveContent: boolean;
  maxCourseSize: number; // MB
  allowedVideoFormats: string[];
  maxVideoDuration: number; // minutes
  requireCoursePreview: boolean;
  contentModerationEnabled: boolean;
}

export interface EmailSettings {
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  welcomeEmailEnabled: boolean;
  courseUpdateNotifications: boolean;
  paymentNotifications: boolean;
}

export interface FeatureFlags {
  [flagName: string]: {
    enabled: boolean;
    description: string;
    lastModified: Date;
    modifiedBy: string;
  };
}

// Admin Action Audit Types
export interface AdminAction {
  id: string;
  adminId: string;
  adminEmail: string;
  action: AdminActionType;
  targetType: AdminTargetType;
  targetId: string;
  details: AdminActionDetails;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export enum AdminActionType {
  USER_BAN = 'user_ban',
  USER_UNBAN = 'user_unban',
  USER_PROMOTE = 'user_promote',
  USER_DEMOTE = 'user_demote',
  CONTENT_APPROVE = 'content_approve',
  CONTENT_REJECT = 'content_reject',
  SETTINGS_UPDATE = 'settings_update',
  FEATURE_TOGGLE = 'feature_toggle',
  INSTRUCTOR_APPROVE = 'instructor_approve',
  INSTRUCTOR_REJECT = 'instructor_reject',
}

export enum AdminTargetType {
  USER = 'user',
  COURSE = 'course',
  LEARNING_PATH = 'learning_path',
  SETTING = 'setting',
  FEATURE_FLAG = 'feature_flag',
  INSTRUCTOR_APPLICATION = 'instructor_application',
}

export interface AdminActionDetails {
  [key: string]: any;
  reason?: string;
  previousValue?: any;
  newValue?: any;
}

// Request/Response Types
export interface UserListRequest {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
  subscription?: SubscriptionPlanType;
  search?: string;
  sortBy?: 'createdAt' | 'lastActiveAt' | 'email' | 'totalSpent';
  sortOrder?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ContentModerationRequest {
  page?: number;
  limit?: number;
  status?: ContentModerationStatus;
  type?: 'course' | 'learning_path';
  sortBy?: 'submittedAt' | 'title' | 'flagCount';
  sortOrder?: 'asc' | 'desc';
}

export interface ContentModerationResponse {
  items: ContentModerationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AnalyticsRequest {
  timeframe: AnalyticsTimeframe;
  startDate?: Date;
  endDate?: Date;
}

export interface ReportsRequest {
  type: ReportType;
  timeframe: AnalyticsTimeframe;
  format: ReportFormat;
  filters?: ReportFilters;
}

export enum ReportType {
  USER_ACTIVITY = 'user_activity',
  REVENUE = 'revenue',
  CONTENT_PERFORMANCE = 'content_performance',
  SUBSCRIPTION_ANALYTICS = 'subscription_analytics',
}

export enum ReportFormat {
  CSV = 'csv',
  PDF = 'pdf',
  EXCEL = 'excel',
}

export interface ReportFilters {
  [key: string]: any;
}