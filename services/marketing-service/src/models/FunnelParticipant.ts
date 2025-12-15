import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Funnel Participant Status
 */
export enum FunnelParticipantStatus {
  REGISTERED = 'registered',     // Has registered (completed first step)
  IN_PROGRESS = 'in_progress',   // Going through funnel
  COMPLETED = 'completed',       // Finished all steps
  CONVERTED = 'converted',       // Made a purchase
  DROPPED = 'dropped',           // Abandoned funnel
}

/**
 * Step Progress - tracks progress through each funnel step
 */
export interface IStepProgress {
  stepId: string;
  stepOrder: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  unlockedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  videoWatchPercent?: number;    // For webinar steps
  formSubmitted?: boolean;       // For optin/application steps
  timeSpentSeconds?: number;
}

/**
 * Funnel Participant Interface
 */
export interface IFunnelParticipant extends Document {
  _id: mongoose.Types.ObjectId;
  funnelId: mongoose.Types.ObjectId;
  funnelSlug: string;            // For quick lookup by slug

  // User identification (email-based for anonymous, userId for logged-in)
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  userId?: string;               // If logged-in user
  leadId?: mongoose.Types.ObjectId;

  // Custom field responses (from optin forms)
  customFields?: Record<string, string | boolean | number>;

  // Progress tracking
  registeredAt: Date;
  currentStepId: string;
  currentStepOrder: number;
  completedStepIds: string[];
  stepProgress: IStepProgress[];
  lastAccessedAt?: Date;

  // Step unlock schedule (for time-based/drip-fed delivery)
  stepUnlocks: Record<string, Date>;  // { "stepId": unlockDate }

  // Session tracking (for anonymous users)
  sessionToken?: string;         // Unique token for tracking without login

  // Conversion tracking
  status: FunnelParticipantStatus;
  completedAt?: Date;
  convertedAt?: Date;
  purchaseId?: string;
  purchaseAmount?: number;

  // Source tracking
  source: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referralCode?: string;
  };

  // Communication
  emailConsent: boolean;
  emailsReceived: string[];
  lastEmailSentAt?: Date;

  // Metadata
  ipAddress?: string;
  userAgent?: string;
  timezone?: string;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  isStepAccessible(stepId: string): boolean;
  completeStep(stepId: string): void;
  unlockStep(stepId: string): void;
  canAccessStep(stepId: string, stepOrder: number): boolean;
}

/**
 * Funnel Participant Statics Interface
 */
interface IFunnelParticipantStatics extends Model<IFunnelParticipant> {
  findByFunnel(funnelId: string): Promise<IFunnelParticipant[]>;
  findByEmail(email: string): Promise<IFunnelParticipant[]>;
  findBySessionToken(token: string): Promise<IFunnelParticipant | null>;
  findByFunnelAndEmail(funnelId: string, email: string): Promise<IFunnelParticipant | null>;
  findByFunnelSlugAndEmail(slug: string, email: string): Promise<IFunnelParticipant | null>;
  findByFunnelSlugAndSession(slug: string, sessionToken: string): Promise<IFunnelParticipant | null>;
}

/**
 * Step Progress Schema
 */
const StepProgressSchema = new Schema<IStepProgress>({
  stepId: { type: String, required: true },
  stepOrder: { type: Number, required: true },
  status: {
    type: String,
    required: true,
    enum: ['locked', 'unlocked', 'in_progress', 'completed'],
    default: 'locked',
  },
  unlockedAt: { type: Date },
  startedAt: { type: Date },
  completedAt: { type: Date },
  videoWatchPercent: { type: Number, min: 0, max: 100 },
  formSubmitted: { type: Boolean },
  timeSpentSeconds: { type: Number, min: 0, default: 0 },
}, { _id: false });

/**
 * Funnel Participant Schema
 */
const FunnelParticipantSchema = new Schema<IFunnelParticipant>({
  funnelId: {
    type: Schema.Types.ObjectId,
    ref: 'Funnel',
    required: true,
    index: true,
  },
  funnelSlug: {
    type: String,
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  phone: {
    type: String,
    trim: true,
  },
  userId: {
    type: String,
    index: true,
    sparse: true,
  },
  leadId: {
    type: Schema.Types.ObjectId,
    ref: 'Lead',
    index: true,
    sparse: true,
  },
  customFields: {
    type: Schema.Types.Mixed,
  },
  registeredAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  currentStepId: {
    type: String,
    required: true,
  },
  currentStepOrder: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  completedStepIds: {
    type: [String],
    default: [],
  },
  stepProgress: {
    type: [StepProgressSchema],
    default: [],
  },
  lastAccessedAt: {
    type: Date,
  },
  stepUnlocks: {
    type: Schema.Types.Mixed,
    default: {},
  },
  sessionToken: {
    type: String,
    index: true,
    sparse: true,
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(FunnelParticipantStatus),
    default: FunnelParticipantStatus.REGISTERED,
    index: true,
  },
  completedAt: { type: Date },
  convertedAt: { type: Date },
  purchaseId: { type: String },
  purchaseAmount: { type: Number, min: 0 },
  source: {
    utmSource: { type: String },
    utmMedium: { type: String },
    utmCampaign: { type: String },
    utmContent: { type: String },
    utmTerm: { type: String },
    referralCode: { type: String },
  },
  emailConsent: {
    type: Boolean,
    default: true,
  },
  emailsReceived: {
    type: [String],
    default: [],
  },
  lastEmailSentAt: { type: Date },
  ipAddress: { type: String },
  userAgent: { type: String },
  timezone: { type: String },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.funnelId = ret.funnelId?.toString();
      ret.leadId = ret.leadId?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.funnelId = ret.funnelId?.toString();
      ret.leadId = ret.leadId?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Compound indexes
FunnelParticipantSchema.index({ funnelId: 1, email: 1 }, { unique: true });
FunnelParticipantSchema.index({ funnelSlug: 1, email: 1 });
FunnelParticipantSchema.index({ funnelSlug: 1, sessionToken: 1 });
FunnelParticipantSchema.index({ funnelId: 1, status: 1 });
FunnelParticipantSchema.index({ registeredAt: -1 });
FunnelParticipantSchema.index({ lastAccessedAt: -1 });

// Instance methods
FunnelParticipantSchema.methods.isStepAccessible = function(stepId: string): boolean {
  // Check if step is in completed steps or is current step
  if (this.completedStepIds.includes(stepId) || this.currentStepId === stepId) {
    return true;
  }

  // Check step unlock schedule
  const unlockDate = this.stepUnlocks[stepId];
  if (unlockDate && new Date() >= new Date(unlockDate)) {
    return true;
  }

  return false;
};

FunnelParticipantSchema.methods.canAccessStep = function(stepId: string, stepOrder: number): boolean {
  // First step (order 0) always requires registration
  // After registration, check if step is accessible based on progress

  // Check if step has been completed
  if (this.completedStepIds.includes(stepId)) {
    return true;
  }

  // Check if it's the current step or before
  if (stepOrder <= this.currentStepOrder) {
    return true;
  }

  // Check time-based unlock
  const unlockDate = this.stepUnlocks[stepId];
  if (unlockDate && new Date() >= new Date(unlockDate)) {
    return true;
  }

  return false;
};

FunnelParticipantSchema.methods.completeStep = function(stepId: string): void {
  if (!this.completedStepIds.includes(stepId)) {
    this.completedStepIds.push(stepId);
  }

  // Update step progress
  const progress = this.stepProgress.find((sp: IStepProgress) => sp.stepId === stepId);
  if (progress) {
    progress.status = 'completed';
    progress.completedAt = new Date();
  }

  // Update status if needed
  if (this.status === FunnelParticipantStatus.REGISTERED) {
    this.status = FunnelParticipantStatus.IN_PROGRESS;
  }
};

FunnelParticipantSchema.methods.unlockStep = function(stepId: string): void {
  const progress = this.stepProgress.find((sp: IStepProgress) => sp.stepId === stepId);
  if (progress && progress.status === 'locked') {
    progress.status = 'unlocked';
    progress.unlockedAt = new Date();
  }
};

// Static methods
FunnelParticipantSchema.statics.findByFunnel = function(funnelId: string) {
  return this.find({ funnelId });
};

FunnelParticipantSchema.statics.findByEmail = function(email: string) {
  return this.find({ email: email.toLowerCase() });
};

FunnelParticipantSchema.statics.findBySessionToken = function(token: string) {
  return this.findOne({ sessionToken: token });
};

FunnelParticipantSchema.statics.findByFunnelAndEmail = function(funnelId: string, email: string) {
  return this.findOne({ funnelId, email: email.toLowerCase() });
};

FunnelParticipantSchema.statics.findByFunnelSlugAndEmail = function(slug: string, email: string) {
  return this.findOne({ funnelSlug: slug, email: email.toLowerCase() });
};

FunnelParticipantSchema.statics.findByFunnelSlugAndSession = function(slug: string, sessionToken: string) {
  return this.findOne({ funnelSlug: slug, sessionToken });
};

const FunnelParticipantModel = mongoose.model<IFunnelParticipant, IFunnelParticipantStatics>(
  'FunnelParticipant',
  FunnelParticipantSchema
);

export { FunnelParticipantModel as FunnelParticipant };
export default FunnelParticipantModel;
