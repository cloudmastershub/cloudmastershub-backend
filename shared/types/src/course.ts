export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: CourseCategory;
  level: DifficultyLevel;
  duration: number; // minutes
  thumbnail: string;
  preview?: string;
  instructor: Instructor;
  price: number;
  rating: number;
  enrollmentCount: number;
  tags: string[];
  requirements: string[];
  objectives: string[];
  curriculum: Section[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  status: CourseStatus;
}

export enum CourseCategory {
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp',
  MULTICLOUD = 'multicloud',
  DEVOPS = 'devops',
  SECURITY = 'security',
  DATA = 'data',
  AI = 'ai',
  GENERAL = 'general',
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export enum CourseStatus {
  DRAFT = 'draft',
  UNDER_REVIEW = 'under_review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export interface Instructor {
  id: string;
  name: string;
  email?: string; // Optional email field for frontend compatibility
  avatar: string;
  bio: string;
  expertise: string[];
  rating: number;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  order: number;
  lessons: Lesson[];
  duration: number; // minutes - calculated from lessons
}

export interface Lesson {
  id: string;
  sectionId: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number; // minutes
  order: number;
  resources: Resource[];
  quiz?: Quiz;
}

export interface Resource {
  id: string;
  type: 'pdf' | 'link' | 'code' | 'download';
  title: string;
  url: string;
  size?: number; // bytes
}

export interface Quiz {
  id: string;
  questions: Question[];
  passingScore: number; // percentage
  attempts: number;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface CourseProgress {
  userId: string;
  courseId: string;
  enrolledAt: Date;
  progress: number; // percentage
  lastAccessedAt: Date;
  completedLessons: string[];
  currentLesson?: string;
  watchedTime: number; // seconds
  completedAt?: Date;
  certificate?: Certificate;
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  issuedAt: Date;
  certificateUrl: string;
  verificationCode: string;
}
