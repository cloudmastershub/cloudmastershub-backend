import mongoose, { Schema, Document } from 'mongoose';

export interface IBookmark extends Document {
  userId: string;
  courseId: string;
  lessonId: string;
  timestamp: number; // Video position in seconds
  note?: string;
  title?: string; // Optional user-defined title for the bookmark
  createdAt: Date;
  updatedAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  courseId: {
    type: String,
    required: true,
    index: true
  },
  lessonId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Number,
    required: true,
    min: 0
  },
  note: {
    type: String,
    maxlength: 500
  },
  title: {
    type: String,
    maxlength: 100
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for efficient queries
BookmarkSchema.index({ userId: 1, courseId: 1 });
BookmarkSchema.index({ userId: 1, lessonId: 1 });
BookmarkSchema.index({ userId: 1, courseId: 1, lessonId: 1 });

// Static methods
BookmarkSchema.statics.findByUser = function(userId: string) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

BookmarkSchema.statics.findByLesson = function(userId: string, lessonId: string) {
  return this.find({ userId, lessonId }).sort({ timestamp: 1 });
};

BookmarkSchema.statics.findByCourse = function(userId: string, courseId: string) {
  return this.find({ userId, courseId }).sort({ createdAt: -1 });
};

const BookmarkModel = mongoose.model<IBookmark>('Bookmark', BookmarkSchema);
export { BookmarkModel as Bookmark };
