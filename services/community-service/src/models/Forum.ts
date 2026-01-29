import mongoose, { Schema, Document } from 'mongoose';

export interface IForum extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  moderators: string[];
  threadCount: number;
  postCount: number;
  lastActivity?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ForumSchema = new Schema<IForum>({
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
    maxlength: 500
  },
  icon: {
    type: String
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  moderators: [{
    type: String
  }],
  threadCount: {
    type: Number,
    default: 0
  },
  postCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'forums'
});

ForumSchema.index({ slug: 1 });
ForumSchema.index({ isActive: 1, sortOrder: 1 });

ForumSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Forum = mongoose.model<IForum>('Forum', ForumSchema);
