import mongoose, { Schema, Document } from 'mongoose';

export type EventType = 'webinar' | 'workshop' | 'study_session' | 'meetup' | 'ama' | 'hackathon' | 'other';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export interface IEvent extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  eventType: EventType;
  status: EventStatus;
  coverImage?: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  coHosts: { userId: string; name: string; avatar?: string }[];
  groupId?: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  timezone: string;
  location?: string;
  meetingUrl?: string;
  maxAttendees?: number;
  registrationCount: number;
  attendeeCount: number;
  isOnline: boolean;
  isFree: boolean;
  price?: number;
  tags: string[];
  courseId?: string;
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>({
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
  description: {
    type: String,
    required: true,
    maxlength: 10000
  },
  eventType: {
    type: String,
    enum: ['webinar', 'workshop', 'study_session', 'meetup', 'ama', 'hackathon', 'other'],
    default: 'webinar'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  coverImage: {
    type: String
  },
  hostId: {
    type: String,
    required: true
  },
  hostName: {
    type: String,
    required: true
  },
  hostAvatar: {
    type: String
  },
  coHosts: [{
    userId: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String }
  }],
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  location: {
    type: String,
    maxlength: 500
  },
  meetingUrl: {
    type: String
  },
  maxAttendees: {
    type: Number
  },
  registrationCount: {
    type: Number,
    default: 0
  },
  attendeeCount: {
    type: Number,
    default: 0
  },
  isOnline: {
    type: Boolean,
    default: true
  },
  isFree: {
    type: Boolean,
    default: true
  },
  price: {
    type: Number
  },
  tags: [{
    type: String,
    trim: true
  }],
  courseId: {
    type: String
  },
  recordingUrl: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'events'
});

EventSchema.index({ slug: 1 });
EventSchema.index({ status: 1, startTime: 1 });
EventSchema.index({ hostId: 1 });
EventSchema.index({ groupId: 1, status: 1 });
EventSchema.index({ eventType: 1 });
EventSchema.index({ tags: 1 });
EventSchema.index({ startTime: 1, endTime: 1 });

EventSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    if (ret.groupId) ret.groupId = ret.groupId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Event = mongoose.model<IEvent>('Event', EventSchema);
