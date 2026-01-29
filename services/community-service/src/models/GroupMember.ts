import mongoose, { Schema, Document } from 'mongoose';

export type MemberRole = 'member' | 'moderator' | 'admin' | 'owner';
export type MemberStatus = 'active' | 'pending' | 'banned' | 'left';

export interface IGroupMember extends Document {
  _id: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  userId: string;
  userName: string;
  userAvatar?: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: Date;
  invitedBy?: string;
  bannedAt?: Date;
  bannedBy?: string;
  banReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GroupMemberSchema = new Schema<IGroupMember>({
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String
  },
  role: {
    type: String,
    enum: ['member', 'moderator', 'admin', 'owner'],
    default: 'member'
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'banned', 'left'],
    default: 'active'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  invitedBy: {
    type: String
  },
  bannedAt: {
    type: Date
  },
  bannedBy: {
    type: String
  },
  banReason: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true,
  collection: 'group_members'
});

GroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
GroupMemberSchema.index({ groupId: 1, status: 1, role: 1 });
GroupMemberSchema.index({ userId: 1, status: 1 });

GroupMemberSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    ret.groupId = ret.groupId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const GroupMember = mongoose.model<IGroupMember>('GroupMember', GroupMemberSchema);
