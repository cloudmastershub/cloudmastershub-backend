import { CourseCategory, DifficultyLevel, CourseStatus, Instructor, Certificate } from './course';

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  category: CourseCategory;
  level: DifficultyLevel;
  thumbnail: string;
  instructorId: string;
  instructor?: Instructor; // Populated when needed

  // Pricing and business
  price: number;
  originalPrice?: number; // For showing discounts
  currency: string;
  isFree: boolean;

  // Content structure
  pathway: PathwayStep[];
  totalSteps: number;
  totalCourses: number;
  totalLabs: number;
  estimatedDurationHours: number;

  // Learning outcomes
  objectives: string[];
  skills: string[];
  prerequisites: string[];
  outcomes: string[];

  // Engagement and quality
  rating: number;
  reviewCount: number;
  enrollmentCount: number;
  completionRate: number;
  tags: string[];

  // Publishing and status
  status: CourseStatus;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // SEO and metadata
  slug: string;
  metaDescription?: string;
  keywords?: string[];

  // Features
  includesCertificate: boolean;
  hasHandsOnLabs: boolean;
  supportLevel: 'basic' | 'standard' | 'premium';
}

export interface PathwayStep {
  id: string;
  pathId: string;
  order: number;
  type: PathwayStepType;
  title: string;
  description?: string;

  // Content references
  courseId?: string;
  labId?: string;

  // Step configuration
  isRequired: boolean;
  isLocked: boolean; // If depends on previous steps
  estimatedTimeMinutes: number;

  // Dependencies and flow
  prerequisites: string[]; // Step IDs that must be completed first
  unlocks: string[]; // Step IDs that this step unlocks

  // Content metadata
  difficulty?: DifficultyLevel;
  skills?: string[];

  // Tracking
  createdAt: Date;
  updatedAt: Date;
}

export type PathwayStepType =
  | 'course' // Reference to a course
  | 'lab' // Reference to a lab
  | 'milestone' // Progress checkpoint
  | 'assessment' // Quiz or test
  | 'project' // Hands-on project
  | 'reading' // External reading material
  | 'video' // Standalone video content
  | 'discussion'; // Community discussion

export interface LearningPathProgress {
  id: string;
  userId: string;
  pathId: string;

  // Enrollment details
  enrolledAt: Date;
  enrollmentType: 'free' | 'purchased' | 'subscription';

  // Progress tracking
  progress: number; // 0-100 percentage
  currentStepId?: string;
  completedSteps: string[];
  skippedSteps: string[]; // For optional steps

  // Time tracking
  totalTimeSpentMinutes: number;
  lastAccessedAt: Date;
  estimatedCompletionDate?: Date;

  // Completion
  isCompleted: boolean;
  completedAt?: Date;
  finalScore?: number;
  certificate?: Certificate;

  // Learning analytics
  strengths: string[]; // Skills user excels at
  weaknesses: string[]; // Skills needing improvement
  recommendedNextPaths: string[]; // Path IDs

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface PathwayMilestone {
  id: string;
  pathId: string;
  title: string;
  description: string;
  order: number;
  requiredSteps: string[]; // Step IDs needed to unlock
  rewards: MilestoneReward[];
  completedBy: string[]; // User IDs who completed this milestone
  createdAt: Date;
}

export interface MilestoneReward {
  type: 'badge' | 'certificate' | 'points' | 'unlock';
  title: string;
  description: string;
  iconUrl?: string;
  value?: number; // For points
  unlocksContent?: string[]; // Content IDs unlocked
}

export interface LearningPathReview {
  id: string;
  pathId: string;
  userId: string;
  rating: number; // 1-5 stars
  title?: string;
  content: string;
  helpful: number; // Helpful votes
  verified: boolean; // Verified purchase/completion
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningPathEnrollment {
  id: string;
  pathId: string;
  userId: string;
  enrollmentType: 'free' | 'purchased' | 'subscription';
  paymentId?: string; // Reference to payment record
  enrolledAt: Date;
  expiresAt?: Date; // For time-limited access
  isActive: boolean;
  createdAt: Date;
}

// Request/Response types for APIs
export interface CreateLearningPathRequest {
  title: string;
  description: string;
  shortDescription?: string;
  category: CourseCategory;
  level: DifficultyLevel;
  thumbnail?: string; // Optional for admin-created paths
  price: number;
  currency?: string; // Optional, defaults to USD
  objectives?: string[]; // Optional, can be empty initially
  skills?: string[]; // Optional, can be empty initially
  prerequisites?: string[]; // Optional, can be empty initially
  outcomes?: string[]; // Optional, can be empty initially
  tags?: string[]; // Optional, can be empty initially
  includesCertificate?: boolean; // Optional, defaults to false
  supportLevel?: 'basic' | 'standard' | 'premium'; // Optional, defaults to basic
}

export interface UpdateLearningPathRequest extends Partial<CreateLearningPathRequest> {
  status?: CourseStatus;
  isPublished?: boolean;
}

export interface AddPathwayStepRequest {
  type: PathwayStepType;
  title: string;
  description?: string;
  courseId?: string;
  labId?: string;
  isRequired: boolean;
  estimatedTimeMinutes: number;
  prerequisites?: string[];
  difficulty?: DifficultyLevel;
  skills?: string[];
}

export interface LearningPathListResponse {
  paths: LearningPath[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LearningPathDetailsResponse extends Omit<LearningPath, 'prerequisites'> {
  pathway: (PathwayStep & {
    course?: {
      id: string;
      title: string;
      description: string;
      thumbnail: string;
      duration: number;
    };
    lab?: {
      id: string;
      title: string;
      description: string;
      provider: string;
      estimatedTime: number;
    };
  })[];
  prerequisites: LearningPath[]; // Related paths (expanded from string[] to full objects)
  recommendations?: LearningPath[]; // Suggested next paths
  reviews: LearningPathReview[];
  instructor: Instructor;
}

export interface PathwayProgressResponse {
  pathProgress: LearningPathProgress;
  stepProgress: Array<{
    stepId: string;
    isCompleted: boolean;
    isLocked: boolean;
    timeSpent: number;
    lastAccessed?: Date;
    score?: number;
  }>;
  nextRecommendations: LearningPath[];
  achievements: MilestoneReward[];
}

// Query parameters for learning path APIs
export interface LearningPathQueryParams {
  category?: CourseCategory;
  level?: DifficultyLevel;
  instructorId?: string;
  minPrice?: number;
  maxPrice?: number;
  isFree?: boolean;
  minRating?: number;
  tags?: string;
  search?: string;
  sortBy?: 'newest' | 'popular' | 'rating' | 'price' | 'duration';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Analytics and reporting types
export interface LearningPathAnalytics {
  pathId: string;
  enrollments: number;
  completions: number;
  completionRate: number;
  averageRating: number;
  totalRevenue: number;
  popularSteps: Array<{
    stepId: string;
    title: string;
    engagementScore: number;
  }>;
  dropOffPoints: Array<{
    stepId: string;
    title: string;
    dropOffRate: number;
  }>;
  userFeedback: {
    positive: string[];
    negative: string[];
    suggestions: string[];
  };
  timeToComplete: {
    average: number;
    median: number;
    fastest: number;
    slowest: number;
  };
}
