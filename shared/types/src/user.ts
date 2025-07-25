export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  bio?: string;
  avatar?: string;
  subscription: SubscriptionPlanType;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionPlanType {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum UserRole {
  STUDENT = 'student',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin',
}

export interface UserProgress {
  userId: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  totalWatchTime: number; // seconds
  currentStreak: number; // days
  lastActiveAt: Date;
}

export interface Subscription {
  userId: string;
  plan: SubscriptionPlanType;
  status: 'active' | 'canceled' | 'past_due';
  startDate: Date;
  endDate?: Date;
  nextBillingDate?: Date;
  paymentMethod?: string;
}
