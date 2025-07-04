import mongoose, { Schema, Document } from 'mongoose';
import { Course, CourseCategory, DifficultyLevel, CourseStatus } from '@cloudmastershub/types';

// Extend the Course interface to include Mongoose Document methods
export interface ICourse extends Omit<Course, 'id'>, Document {
  _id: string;
}

const InstructorSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String, required: true },
  bio: { type: String, required: true },
  expertise: [{ type: String }],
  rating: { type: Number, default: 0, min: 0, max: 5 }
}, { _id: false });

const ResourceSchema = new Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['pdf', 'link', 'code', 'download'] 
  },
  title: { type: String, required: true },
  url: { type: String, required: true },
  size: { type: Number }
}, { _id: false });

const QuestionSchema = new Schema({
  id: { type: String, required: true },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true, min: 0 },
  explanation: { type: String }
}, { _id: false });

const QuizSchema = new Schema({
  id: { type: String, required: true },
  questions: [QuestionSchema],
  passingScore: { type: Number, required: true, min: 0, max: 100 },
  attempts: { type: Number, default: 3, min: 1 }
}, { _id: false });

const LessonSchema = new Schema({
  id: { type: String, required: true },
  sectionId: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  videoUrl: { type: String, required: true },
  duration: { type: Number, required: true, min: 0 },
  order: { type: Number, required: true, min: 0 },
  resources: [ResourceSchema],
  quiz: QuizSchema
}, { _id: false });

const SectionSchema = new Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  order: { type: Number, required: true, min: 0 },
  lessons: [LessonSchema]
}, { _id: false });

const CourseSchema = new Schema<ICourse>({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 200
  },
  description: { 
    type: String, 
    required: true,
    maxlength: 2000
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
  duration: { 
    type: Number, 
    required: true, 
    min: 0
  },
  thumbnail: { 
    type: String, 
    required: true
  },
  preview: { 
    type: String 
  },
  instructor: { 
    type: InstructorSchema, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true, 
    min: 0
  },
  rating: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 5
  },
  enrollmentCount: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  tags: [{ 
    type: String, 
    trim: true
  }],
  requirements: [{ 
    type: String, 
    trim: true
  }],
  objectives: [{ 
    type: String, 
    trim: true
  }],
  curriculum: [SectionSchema],
  status: { 
    type: String, 
    required: true, 
    enum: Object.values(CourseStatus),
    default: CourseStatus.DRAFT
  },
  publishedAt: { 
    type: Date 
  }
}, {
  timestamps: true, // This automatically adds createdAt and updatedAt
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

// Indexes for better query performance
CourseSchema.index({ category: 1, level: 1 });
CourseSchema.index({ 'instructor.id': 1 });
CourseSchema.index({ status: 1 });
CourseSchema.index({ title: 'text', description: 'text' });
CourseSchema.index({ createdAt: -1 });
CourseSchema.index({ rating: -1 });
CourseSchema.index({ enrollmentCount: -1 });

// Instance methods
CourseSchema.methods.publish = function() {
  this.status = CourseStatus.PUBLISHED;
  this.publishedAt = new Date();
  return this.save();
};

CourseSchema.methods.unpublish = function() {
  this.status = CourseStatus.DRAFT;
  this.publishedAt = undefined;
  return this.save();
};

CourseSchema.methods.archive = function() {
  this.status = CourseStatus.ARCHIVED;
  return this.save();
};

CourseSchema.methods.incrementEnrollment = function() {
  this.enrollmentCount = (this.enrollmentCount || 0) + 1;
  return this.save();
};

CourseSchema.methods.updateRating = function(newRating: number) {
  // This is a simplified rating update - in practice you'd calculate from all reviews
  this.rating = newRating;
  return this.save();
};

// Static methods
CourseSchema.statics.findPublished = function() {
  return this.find({ status: CourseStatus.PUBLISHED });
};

CourseSchema.statics.findByInstructor = function(instructorId: string) {
  return this.find({ 'instructor.id': instructorId });
};

CourseSchema.statics.findByCategory = function(category: CourseCategory) {
  return this.find({ category });
};

CourseSchema.statics.searchCourses = function(searchTerm: string) {
  return this.find({
    $text: { $search: searchTerm },
    status: CourseStatus.PUBLISHED
  });
};

// Pre-save middleware
CourseSchema.pre('save', function(next) {
  // Auto-publish if status changes to published and no publishedAt date
  if (this.status === CourseStatus.PUBLISHED && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Clear publishedAt if status is not published
  if (this.status !== CourseStatus.PUBLISHED) {
    this.publishedAt = undefined;
  }
  
  next();
});

const CourseModel = mongoose.model<ICourse>('Course', CourseSchema);
export { CourseModel as Course };