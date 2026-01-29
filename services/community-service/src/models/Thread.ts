import mongoose, { Schema, Document } from 'mongoose';

export interface IThread extends Document {
  _id: mongoose.Types.ObjectId;
  forumId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  isPinned: boolean;
  isLocked: boolean;
  isAnnouncement: boolean;
  viewCount: number;
  replyCount: number;
  lastReplyAt?: Date;
  lastReplyBy?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ThreadSchema = new Schema<IThread>({
  forumId: {
    type: Schema.Types.ObjectId,
    ref: 'Forum',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 50000
  },
  authorId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorAvatar: {
    type: String
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isAnnouncement: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  lastReplyAt: {
    type: Date
  },
  lastReplyBy: {
    type: String
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  collection: 'threads'
});

ThreadSchema.index({ forumId: 1, createdAt: -1 });
ThreadSchema.index({ forumId: 1, isPinned: -1, lastReplyAt: -1 });
ThreadSchema.index({ authorId: 1 });
ThreadSchema.index({ slug: 1 });
ThreadSchema.index({ tags: 1 });

ThreadSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    ret.forumId = ret.forumId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Thread = mongoose.model<IThread>('Thread', ThreadSchema);
