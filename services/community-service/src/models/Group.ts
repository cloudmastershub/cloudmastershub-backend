import mongoose, { Schema, Document } from 'mongoose';

export type GroupPrivacy = 'public' | 'private' | 'hidden';
export type GroupCategory = 'study' | 'project' | 'certification' | 'networking' | 'mentorship' | 'other';

export interface IGroup extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  category: GroupCategory;
  privacy: GroupPrivacy;
  coverImage?: string;
  icon?: string;
  ownerId: string;
  ownerName: string;
  admins: string[];
  memberCount: number;
  postCount: number;
  maxMembers: number;
  tags: string[];
  rules: string[];
  courseId?: string;
  isActive: boolean;
  lastActivity?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['study', 'project', 'certification', 'networking', 'mentorship', 'other'],
    default: 'study'
  },
  privacy: {
    type: String,
    enum: ['public', 'private', 'hidden'],
    default: 'public'
  },
  coverImage: {
    type: String
  },
  icon: {
    type: String
  },
  ownerId: {
    type: String,
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  admins: [{
    type: String
  }],
  memberCount: {
    type: Number,
    default: 1
  },
  postCount: {
    type: Number,
    default: 0
  },
  maxMembers: {
    type: Number,
    default: 500
  },
  tags: [{
    type: String,
    trim: true
  }],
  rules: [{
    type: String,
    maxlength: 500
  }],
  courseId: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'groups'
});

GroupSchema.index({ slug: 1 });
GroupSchema.index({ privacy: 1, isActive: 1, memberCount: -1 });
GroupSchema.index({ category: 1 });
GroupSchema.index({ ownerId: 1 });
GroupSchema.index({ tags: 1 });
GroupSchema.index({ courseId: 1 });

GroupSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Group = mongoose.model<IGroup>('Group', GroupSchema);
