import mongoose, { Schema, Document } from 'mongoose';

export type LikeTargetType = 'post' | 'comment' | 'thread';
export type ReactionType = 'like' | 'love' | 'celebrate' | 'insightful' | 'curious';

export interface ILike extends Document {
  _id: mongoose.Types.ObjectId;
  targetId: mongoose.Types.ObjectId;
  targetType: LikeTargetType;
  userId: string;
  reactionType: ReactionType;
  createdAt: Date;
}

const LikeSchema = new Schema<ILike>({
  targetId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  targetType: {
    type: String,
    enum: ['post', 'comment', 'thread'],
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  reactionType: {
    type: String,
    enum: ['like', 'love', 'celebrate', 'insightful', 'curious'],
    default: 'like'
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'likes'
});

LikeSchema.index({ targetId: 1, targetType: 1, userId: 1 }, { unique: true });
LikeSchema.index({ userId: 1 });

LikeSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    ret.targetId = ret.targetId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Like = mongoose.model<ILike>('Like', LikeSchema);
