import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Mailing List Type - Static (manual) or Dynamic (rule-based via segment)
 */
export enum MailingListType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
}

/**
 * Mailing List Status
 */
export enum MailingListStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/**
 * Mailing List Interface
 */
export interface IMailingList extends Document {
  _id: mongoose.Types.ObjectId;

  // Basic info
  name: string;
  description?: string;
  type: MailingListType;
  status: MailingListStatus;

  // For static lists - manually managed members
  memberIds: string[];  // Lead IDs

  // For dynamic lists - linked to a segment
  segmentId?: string;

  // Stats (cached)
  memberCount: number;
  subscribedCount: number;
  unsubscribedCount: number;
  lastCalculatedAt?: Date;

  // Double opt-in settings
  doubleOptIn: boolean;
  welcomeEmailTemplateId?: string;

  // Metadata
  tags: string[];
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mailing List Model Interface (static methods)
 */
export interface IMailingListModel extends Model<IMailingList> {
  findByName(name: string): Promise<IMailingList | null>;
  getActiveLists(): Promise<IMailingList[]>;
  getListsByMember(leadId: string): Promise<IMailingList[]>;
}

/**
 * Mailing List Schema
 */
const MailingListSchema = new Schema<IMailingList>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(MailingListType),
    default: MailingListType.STATIC,
    index: true,
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(MailingListStatus),
    default: MailingListStatus.ACTIVE,
    index: true,
  },
  memberIds: {
    type: [String],
    default: [],
    index: true,
  },
  segmentId: {
    type: String,
    index: true,
    sparse: true,  // Only index when value exists
  },
  memberCount: {
    type: Number,
    default: 0,
    index: true,
  },
  subscribedCount: {
    type: Number,
    default: 0,
  },
  unsubscribedCount: {
    type: Number,
    default: 0,
  },
  lastCalculatedAt: {
    type: Date,
  },
  doubleOptIn: {
    type: Boolean,
    default: false,
  },
  welcomeEmailTemplateId: {
    type: String,
  },
  tags: {
    type: [String],
    default: [],
    index: true,
  },
  createdBy: {
    type: String,
    required: true,
    index: true,
  },
  updatedBy: {
    type: String,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes
MailingListSchema.index({ createdAt: -1 });
MailingListSchema.index({ name: 'text', description: 'text' });

// Unique name constraint
MailingListSchema.index({ name: 1 }, { unique: true });

// Static methods
MailingListSchema.statics.findByName = function(name: string) {
  return this.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
};

MailingListSchema.statics.getActiveLists = function() {
  return this.find({ status: MailingListStatus.ACTIVE }).sort({ name: 1 });
};

MailingListSchema.statics.getListsByMember = function(leadId: string) {
  return this.find({
    memberIds: leadId,
    status: MailingListStatus.ACTIVE,
  });
};

// Validation
MailingListSchema.pre('save', function(next) {
  // Validate that dynamic lists have segmentId
  if (this.type === MailingListType.DYNAMIC && !this.segmentId) {
    return next(new Error('Dynamic lists must have a segmentId'));
  }

  // Validate that static lists don't have segmentId
  if (this.type === MailingListType.STATIC && this.segmentId) {
    return next(new Error('Static lists should not have a segmentId'));
  }

  next();
});

const MailingListModel = mongoose.model<IMailingList, IMailingListModel>('MailingList', MailingListSchema);

export { MailingListModel as MailingList };
export default MailingListModel;
