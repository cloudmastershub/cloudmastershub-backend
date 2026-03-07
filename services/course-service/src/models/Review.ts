import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  userId: string;
  courseId: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  reported: boolean;
  status: 'published' | 'pending' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  courseId: {
    type: String,
    required: true,
    index: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000,
  },
  helpful: {
    type: Number,
    default: 0,
    min: 0,
  },
  reported: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['published', 'pending', 'removed'],
    default: 'published',
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function (_doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// One review per user per course
ReviewSchema.index({ userId: 1, courseId: 1 }, { unique: true });
ReviewSchema.index({ courseId: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ courseId: 1, rating: 1 });

const ReviewModel = mongoose.model<IReview>('Review', ReviewSchema);
export { ReviewModel as Review };
