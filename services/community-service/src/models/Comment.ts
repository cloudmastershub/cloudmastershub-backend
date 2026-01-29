import mongoose, { Schema, Document } from 'mongoose';

export type CommentTargetType = 'post' | 'thread' | 'question' | 'event';

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  targetId: mongoose.Types.ObjectId;
  targetType: CommentTargetType;
  parentId?: mongoose.Types.ObjectId;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  likeCount: number;
  replyCount: number;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>({
  targetId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  targetType: {
    type: String,
    enum: ['post', 'thread', 'question', 'event'],
    required: true
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'Comment'
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
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  likeCount: {
    type: Number,
    default: 0
  },
  replyCount: {
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
  collection: 'comments'
});

CommentSchema.index({ targetId: 1, targetType: 1, createdAt: 1 });
CommentSchema.index({ parentId: 1 });
CommentSchema.index({ authorId: 1 });

CommentSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    ret.targetId = ret.targetId.toString();
    if (ret.parentId) ret.parentId = ret.parentId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
