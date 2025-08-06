import mongoose, { Schema, Document } from 'mongoose';
import { CourseProgress } from '@cloudmastershub/types';

export interface ICourseProgress extends Omit<CourseProgress, 'userId' | 'courseId'>, Document {
  userId: string;
  courseId: string; // Changed to string to support slug-based IDs
}

const CertificateSchema = new Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  courseId: { type: String, required: true },
  issuedAt: { type: Date, required: true },
  certificateUrl: { type: String, required: true },
  verificationCode: { type: String, required: true, unique: true }
}, { _id: false });

const CourseProgressSchema = new Schema<ICourseProgress>({
  userId: { 
    type: String, 
    required: true 
  },
  courseId: { 
    type: String, // Changed to String to support slug-based course IDs
    required: true,
    index: true
  },
  enrolledAt: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  progress: { 
    type: Number, 
    required: true, 
    default: 0, 
    min: 0, 
    max: 100 
  },
  lastAccessedAt: { 
    type: Date, 
    required: true, 
    default: Date.now 
  },
  completedLessons: [{ 
    type: String 
  }],
  currentLesson: { 
    type: String 
  },
  watchedTime: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  completedAt: { 
    type: Date 
  },
  certificate: CertificateSchema
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      ret.courseId = ret.courseId.toString();
      return ret;
    }
  }
});

// Compound indexes for efficient queries
CourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
CourseProgressSchema.index({ userId: 1 });
CourseProgressSchema.index({ courseId: 1 });
CourseProgressSchema.index({ completedAt: 1 });
CourseProgressSchema.index({ lastAccessedAt: -1 });

// Instance methods
CourseProgressSchema.methods.markLessonComplete = function(lessonId: string) {
  if (!this.completedLessons.includes(lessonId)) {
    this.completedLessons.push(lessonId);
    this.lastAccessedAt = new Date();
  }
  return this.save();
};

CourseProgressSchema.methods.updateProgress = function(progressPercentage: number) {
  this.progress = Math.min(100, Math.max(0, progressPercentage));
  this.lastAccessedAt = new Date();
  
  // Auto-complete course if 100% progress
  if (this.progress === 100 && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  return this.save();
};

CourseProgressSchema.methods.updateWatchedTime = function(additionalSeconds: number) {
  this.watchedTime += additionalSeconds;
  this.lastAccessedAt = new Date();
  return this.save();
};

CourseProgressSchema.methods.setCurrentLesson = function(lessonId: string) {
  this.currentLesson = lessonId;
  this.lastAccessedAt = new Date();
  return this.save();
};

CourseProgressSchema.methods.isCompleted = function() {
  return this.progress === 100 && this.completedAt;
};

// Static methods
CourseProgressSchema.statics.findByUser = function(userId: string) {
  return this.find({ userId }).populate('courseId');
};

CourseProgressSchema.statics.findByCourse = function(courseId: string) {
  return this.find({ courseId }).sort({ progress: -1 });
};

CourseProgressSchema.statics.findCompleted = function(userId?: string) {
  const query: any = { completedAt: { $exists: true } };
  if (userId) {
    query.userId = userId;
  }
  return this.find(query).populate('courseId');
};

CourseProgressSchema.statics.getEnrollmentStats = function(courseId: string) {
  return this.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
    {
      $group: {
        _id: null,
        totalEnrolled: { $sum: 1 },
        totalCompleted: {
          $sum: {
            $cond: [{ $gte: ['$progress', 100] }, 1, 0]
          }
        },
        averageProgress: { $avg: '$progress' },
        totalWatchTime: { $sum: '$watchedTime' }
      }
    }
  ]);
};

// Pre-save middleware
CourseProgressSchema.pre('save', function(next) {
  // Update lastAccessedAt on any change
  if (this.isModified() && !this.isModified('lastAccessedAt')) {
    this.lastAccessedAt = new Date();
  }
  
  next();
});

const CourseProgressModel = mongoose.model<ICourseProgress>('CourseProgress', CourseProgressSchema);
export { CourseProgressModel as CourseProgress };