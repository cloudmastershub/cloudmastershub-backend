import mongoose, { Schema, Document } from 'mongoose';

export type PostType = 'general' | 'achievement' | 'question' | 'tip' | 'resource';
export type PostVisibility = 'public' | 'followers' | 'private';

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  postType: PostType;
  visibility: PostVisibility;
  images: string[];
  links: { url: string; title?: string; preview?: string }[];
  tags: string[];
  groupId?: mongoose.Types.ObjectId;
  courseId?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>({
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
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  postType: {
    type: String,
    enum: ['general', 'achievement', 'question', 'tip', 'resource'],
    default: 'general'
  },
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },
  images: [{
    type: String
  }],
  links: [{
    url: { type: String, required: true },
    title: { type: String },
    preview: { type: String }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group'
  },
  courseId: {
    type: String
  },
  likeCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'posts'
});

PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 });
PostSchema.index({ groupId: 1, createdAt: -1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ postType: 1 });

PostSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    if (ret.groupId) ret.groupId = ret.groupId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Post = mongoose.model<IPost>('Post', PostSchema);
