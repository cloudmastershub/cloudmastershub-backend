import mongoose, { Schema, Document } from 'mongoose';

export type ConnectionStatus = 'following' | 'blocked';

export interface IConnection extends Document {
  _id: mongoose.Types.ObjectId;
  followerId: string;
  followerName: string;
  followerAvatar?: string;
  followingId: string;
  followingName: string;
  followingAvatar?: string;
  status: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<IConnection>({
  followerId: {
    type: String,
    required: true
  },
  followerName: {
    type: String,
    required: true
  },
  followerAvatar: {
    type: String
  },
  followingId: {
    type: String,
    required: true
  },
  followingName: {
    type: String,
    required: true
  },
  followingAvatar: {
    type: String
  },
  status: {
    type: String,
    enum: ['following', 'blocked'],
    default: 'following'
  }
}, {
  timestamps: true,
  collection: 'connections'
});

ConnectionSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
ConnectionSchema.index({ followerId: 1, status: 1 });
ConnectionSchema.index({ followingId: 1, status: 1 });

ConnectionSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Connection = mongoose.model<IConnection>('Connection', ConnectionSchema);
