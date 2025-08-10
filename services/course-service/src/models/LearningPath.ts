import mongoose, { Schema, Document } from 'mongoose';
import { LearningPath, PathwayStep, PathwayStepType, LearningPathProgress, CourseCategory, DifficultyLevel, CourseStatus } from '@cloudmastershub/types';

export interface ILearningPath extends Omit<LearningPath, 'id'>, Document {
  _id: string;
}

export interface ILearningPathProgress extends Omit<LearningPathProgress, 'id' | 'pathId'>, Document {
  pathId: mongoose.Types.ObjectId;
}

const PathwayStepSchema = new Schema({
  id: { type: String, required: true },
  pathId: { type: String, required: true },
  order: { type: Number, required: true, min: 0 },
  type: { 
    type: String, 
    required: true, 
    enum: ['course', 'lab', 'milestone', 'assessment', 'project', 'reading', 'video', 'discussion']
  },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  
  // Content references
  courseId: { type: String },
  labId: { type: String },
  
  // Step configuration
  isRequired: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false },
  estimatedTimeMinutes: { type: Number, required: true, min: 0 },
  
  // Dependencies and flow
  prerequisites: [{ type: String }], // Step IDs
  unlocks: [{ type: String }], // Step IDs
  
  // Content metadata
  difficulty: { type: String, enum: Object.values(DifficultyLevel) },
  skills: [{ type: String, trim: true }]
}, { 
  _id: false,
  timestamps: true 
});

const LearningPathSchema = new Schema<ILearningPath>({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 5000
  },
  shortDescription: { 
    type: String,
    maxlength: 300
  },
  category: { 
    type: String, 
    required: true, 
    enum: Object.values(CourseCategory)
  },
  level: { 
    type: String, 
    required: true, 
    enum: Object.values(DifficultyLevel)
  },
  thumbnail: { 
    type: String, 
    default: ''
  },
  instructorId: { 
    type: String, 
    required: true 
  },
  
  // Pricing
  price: { 
    type: Number, 
    required: true, 
    min: 0
  },
  originalPrice: { 
    type: Number, 
    min: 0
  },
  currency: { 
    type: String, 
    default: 'USD',
    uppercase: true
  },
  isFree: { 
    type: Boolean, 
    default: false
  },
  
  // Content structure
  pathway: [PathwayStepSchema],
  totalSteps: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  totalCourses: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  totalLabs: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  estimatedDurationHours: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  
  // Learning outcomes
  objectives: [{ type: String, trim: true }],
  skills: [{ type: String, trim: true }],
  prerequisites: [{ type: String, trim: true }],
  outcomes: [{ type: String, trim: true }],
  
  // Engagement
  rating: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 5
  },
  reviewCount: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  enrollmentCount: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  completionRate: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 100
  },
  tags: [{ type: String, trim: true }],
  
  // Publishing
  status: { 
    type: String, 
    required: true, 
    enum: Object.values(CourseStatus),
    default: CourseStatus.DRAFT
  },
  isPublished: { 
    type: Boolean, 
    default: false
  },
  publishedAt: { 
    type: Date 
  },
  
  // SEO
  slug: { 
    type: String, 
    unique: true,
    sparse: true
  },
  metaDescription: { 
    type: String,
    maxlength: 160
  },
  keywords: [{ type: String, trim: true }],
  
  // Features
  includesCertificate: { 
    type: Boolean, 
    default: false
  },
  hasHandsOnLabs: { 
    type: Boolean, 
    default: false
  },
  supportLevel: { 
    type: String, 
    enum: ['basic', 'standard', 'premium'],
    default: 'basic'
  }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { 
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
LearningPathSchema.index({ category: 1, level: 1 });
LearningPathSchema.index({ instructorId: 1 });
LearningPathSchema.index({ status: 1, isPublished: 1 });
LearningPathSchema.index({ rating: -1 });
LearningPathSchema.index({ enrollmentCount: -1 });
LearningPathSchema.index({ createdAt: -1 });
LearningPathSchema.index({ title: 'text', description: 'text' });
LearningPathSchema.index({ slug: 1 }, { unique: true, sparse: true });

// Pre-save middleware to generate slug
LearningPathSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Update calculated fields
  this.totalSteps = this.pathway.length;
  this.totalCourses = this.pathway.filter(step => step.type === 'course').length;
  this.totalLabs = this.pathway.filter(step => step.type === 'lab').length;
  this.estimatedDurationHours = Math.ceil(
    this.pathway.reduce((total, step) => total + step.estimatedTimeMinutes, 0) / 60
  );
  
  // Auto-set isFree based on price
  if (this.price === 0) {
    this.isFree = true;
  }
  
  // Handle publishing
  if (this.status === CourseStatus.PUBLISHED && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  if (this.status !== CourseStatus.PUBLISHED || !this.isPublished) {
    this.publishedAt = undefined;
  }
  
  next();
});

// Instance methods
LearningPathSchema.methods.publish = function() {
  this.status = CourseStatus.PUBLISHED;
  this.isPublished = true;
  this.publishedAt = new Date();
  return this.save();
};

LearningPathSchema.methods.unpublish = function() {
  this.status = CourseStatus.DRAFT;
  this.isPublished = false;
  this.publishedAt = undefined;
  return this.save();
};

LearningPathSchema.methods.addStep = function(step: Omit<PathwayStep, 'id' | 'pathId'>) {
  const newStep = {
    ...step,
    id: new mongoose.Types.ObjectId().toString(),
    pathId: this._id.toString(),
    order: step.order || this.pathway.length,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  this.pathway.push(newStep);
  return this.save();
};

LearningPathSchema.methods.removeStep = function(stepId: string) {
  this.pathway = this.pathway.filter((step: any) => step.id !== stepId);
  return this.save();
};

LearningPathSchema.methods.reorderSteps = function(stepOrders: { stepId: string; order: number }[]) {
  stepOrders.forEach(({ stepId, order }) => {
    const step = this.pathway.find((s: any) => s.id === stepId);
    if (step) {
      step.order = order;
    }
  });
  this.pathway.sort((a: any, b: any) => a.order - b.order);
  return this.save();
};

LearningPathSchema.methods.incrementEnrollment = function() {
  this.enrollmentCount += 1;
  return this.save();
};

LearningPathSchema.methods.updateRating = function(newRating: number, newReviewCount: number) {
  this.rating = newRating;
  this.reviewCount = newReviewCount;
  return this.save();
};

// Static methods
LearningPathSchema.statics.findPublished = function() {
  return this.find({ status: CourseStatus.PUBLISHED, isPublished: true });
};

LearningPathSchema.statics.findByInstructor = function(instructorId: string) {
  return this.find({ instructorId });
};

LearningPathSchema.statics.findByCategory = function(category: CourseCategory) {
  return this.find({ category });
};

LearningPathSchema.statics.searchPaths = function(searchTerm: string) {
  return this.find({
    $text: { $search: searchTerm },
    status: CourseStatus.PUBLISHED,
    isPublished: true
  });
};

// Learning Path Progress Schema
const LearningPathProgressSchema = new Schema<ILearningPathProgress>({
  userId: { 
    type: String, 
    required: true 
  },
  pathId: { 
    type: Schema.Types.ObjectId, 
    ref: 'LearningPath', 
    required: true 
  },
  
  // Enrollment
  enrolledAt: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  enrollmentType: { 
    type: String, 
    enum: ['free', 'purchased', 'subscription'],
    required: true
  },
  
  // Progress
  progress: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 100 
  },
  currentStepId: { 
    type: String 
  },
  completedSteps: [{ type: String }],
  skippedSteps: [{ type: String }],
  
  // Time tracking
  totalTimeSpentMinutes: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  lastAccessedAt: { 
    type: Date, 
    default: Date.now 
  },
  estimatedCompletionDate: { 
    type: Date 
  },
  
  // Completion
  isCompleted: { 
    type: Boolean, 
    default: false 
  },
  completedAt: { 
    type: Date 
  },
  finalScore: { 
    type: Number, 
    min: 0, 
    max: 100 
  },
  
  // Analytics
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  recommendedNextPaths: [{ type: String }]
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      ret.pathId = ret.pathId.toString();
      return ret;
    }
  }
});

// Progress indexes
LearningPathProgressSchema.index({ userId: 1, pathId: 1 }, { unique: true });
LearningPathProgressSchema.index({ userId: 1 });
LearningPathProgressSchema.index({ pathId: 1 });
LearningPathProgressSchema.index({ isCompleted: 1 });

// Progress instance methods
LearningPathProgressSchema.methods.markStepComplete = function(stepId: string) {
  if (!this.completedSteps.includes(stepId)) {
    this.completedSteps.push(stepId);
    this.lastAccessedAt = new Date();
  }
  return this.save();
};

LearningPathProgressSchema.methods.setCurrentStep = function(stepId: string) {
  this.currentStepId = stepId;
  this.lastAccessedAt = new Date();
  return this.save();
};

LearningPathProgressSchema.methods.updateProgress = function(progressPercentage: number) {
  this.progress = Math.min(100, Math.max(0, progressPercentage));
  this.lastAccessedAt = new Date();
  
  if (this.progress === 100 && !this.isCompleted) {
    this.isCompleted = true;
    this.completedAt = new Date();
  }
  
  return this.save();
};

const LearningPathModel = mongoose.model<ILearningPath>('LearningPath', LearningPathSchema);
const LearningPathProgressModel = mongoose.model<ILearningPathProgress>('LearningPathProgress', LearningPathProgressSchema);

export { LearningPathModel as LearningPath };
export { LearningPathProgressModel as LearningPathProgress };