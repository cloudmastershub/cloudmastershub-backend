import mongoose, { Schema, Document } from 'mongoose';

export type RegistrationStatus = 'registered' | 'attended' | 'cancelled' | 'no_show';

export interface IEventRegistration extends Document {
  _id: mongoose.Types.ObjectId;
  eventId: mongoose.Types.ObjectId;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  status: RegistrationStatus;
  registeredAt: Date;
  attendedAt?: Date;
  cancelledAt?: Date;
  reminderSent: boolean;
  feedback?: {
    rating: number;
    comment?: string;
    submittedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const EventRegistrationSchema = new Schema<IEventRegistration>({
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
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
  userEmail: {
    type: String,
    required: true
  },
  userAvatar: {
    type: String
  },
  status: {
    type: String,
    enum: ['registered', 'attended', 'cancelled', 'no_show'],
    default: 'registered'
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  attendedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    submittedAt: { type: Date }
  }
}, {
  timestamps: true,
  collection: 'event_registrations'
});

EventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });
EventRegistrationSchema.index({ eventId: 1, status: 1 });
EventRegistrationSchema.index({ userId: 1, status: 1 });

EventRegistrationSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    ret.eventId = ret.eventId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const EventRegistration = mongoose.model<IEventRegistration>('EventRegistration', EventRegistrationSchema);
