import mongoose, { Schema, Document } from 'mongoose';
import { DeliveryMode } from './Funnel';

/**
 * Challenge Day Content
 */
export interface IChallengeDayContent {
  videoUrl?: string;
  videoTitle?: string;
  videoDuration?: number;        // Duration in minutes
  exercises: string[];           // List of exercises/tasks
  resources: {
    title: string;
    url: string;
    type: 'pdf' | 'link' | 'download' | 'video';
  }[];
  bonusContent?: string;         // Additional content for engaged users
}

/**
 * Challenge Day
 */
export interface IChallengeDay {
  dayNumber: number;
  title: string;                 // "Day 1: DevOps Clarity & Career Roadmap"
  description?: string;
  landingPageId: string;         // Reference to LandingPage for this day's content
  emailTemplateId?: string;      // Email to send when day unlocks

  // Content
  content: IChallengeDayContent;

  // Timing
  unlockAfterHours: number;      // Hours after registration (0 for Day 1)
  estimatedDuration: number;     // Minutes to complete

  // Completion tracking
  completionCriteria: {
    videoWatchPercent?: number;  // e.g., 80 = must watch 80% of video
    requireExercise?: boolean;   // Must complete at least one exercise
    requireQuiz?: boolean;       // Must pass quiz (if exists)
  };
}

/**
 * Challenge Pitch Day (Final Sales Push)
 */
export interface IChallengePitchDay {
  dayNumber: number;             // Usually totalDays + 1
  title: string;                 // "Your Next Step"
  landingPageId: string;         // Sales/pitch page
  emailTemplateId?: string;      // Pitch email
  offerDetails: {
    productName: string;
    productId?: string;          // Reference to course/product
    originalPrice: number;
    discountedPrice?: number;
    discountExpiresHours?: number; // Urgency timer
    bonuses?: string[];
  };
}

/**
 * Challenge Status
 */
export enum ChallengeStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  PAUSED = 'paused',
  COMPLETED = 'completed',       // Challenge period ended
  ARCHIVED = 'archived',
}

/**
 * Challenge Interface
 */
export interface IChallenge extends Document {
  _id: mongoose.Types.ObjectId;
  funnelId: mongoose.Types.ObjectId;  // Parent funnel reference
  name: string;                        // "7-Day DevOps Kickstarter"
  slug: string;
  description?: string;
  tagline?: string;                    // Short catchy description

  // Challenge configuration
  totalDays: number;                   // e.g., 7
  deliveryMode: DeliveryMode;

  // Challenge days
  days: IChallengeDay[];

  // Final pitch
  pitchDay?: IChallengePitchDay;

  // Registration settings
  registration: {
    isOpen: boolean;
    startDate?: Date;                  // When registration opens
    endDate?: Date;                    // When registration closes
    maxParticipants?: number;          // Limit seats
    requiresEmail: boolean;
    requiresName: boolean;
    customFields?: {
      name: string;
      type: 'text' | 'select' | 'checkbox';
      required: boolean;
      options?: string[];              // For select type
    }[];
  };

  // Email settings
  emails: {
    welcomeEmailId?: string;           // Sent immediately on registration
    reminderEmailIds?: string[];       // Daily reminder emails
    completionEmailId?: string;        // Sent when challenge completed
    inactivityEmailId?: string;        // Sent if user goes inactive
  };

  // Community settings
  community: {
    enabled: boolean;
    discussionEnabled: boolean;
    showLeaderboard: boolean;
    showParticipantCount: boolean;
  };

  // Gamification
  gamification: {
    enabled: boolean;
    pointsPerDay: number;
    bonusPointsEarlyCompletion: number;
    badges?: {
      name: string;
      description: string;
      iconUrl: string;
      criteria: string;               // e.g., "complete_day_1", "complete_all"
    }[];
  };

  // Metrics
  metrics: {
    totalRegistrations: number;
    activeParticipants: number;
    completionRate: number;
    dayCompletionRates: number[];     // Completion rate per day
    conversionRate: number;
    totalRevenue: number;
  };

  status: ChallengeStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Challenge Day Content Schema
 */
const ChallengeDayContentSchema = new Schema<IChallengeDayContent>({
  videoUrl: { type: String },
  videoTitle: { type: String },
  videoDuration: { type: Number, min: 0 },
  exercises: [{ type: String }],
  resources: [{
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['pdf', 'link', 'download', 'video'], required: true },
  }],
  bonusContent: { type: String },
}, { _id: false });

/**
 * Challenge Day Schema
 */
const ChallengeDaySchema = new Schema<IChallengeDay>({
  dayNumber: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  landingPageId: { type: String, required: true },
  emailTemplateId: { type: String },
  content: {
    type: ChallengeDayContentSchema,
    default: () => ({ exercises: [], resources: [] }),
  },
  unlockAfterHours: { type: Number, required: true, min: 0, default: 0 },
  estimatedDuration: { type: Number, min: 0, default: 30 },
  completionCriteria: {
    videoWatchPercent: { type: Number, min: 0, max: 100 },
    requireExercise: { type: Boolean, default: false },
    requireQuiz: { type: Boolean, default: false },
  },
}, { _id: false });

/**
 * Challenge Pitch Day Schema
 */
const ChallengePitchDaySchema = new Schema<IChallengePitchDay>({
  dayNumber: { type: Number, required: true },
  title: { type: String, required: true },
  landingPageId: { type: String, required: true },
  emailTemplateId: { type: String },
  offerDetails: {
    productName: { type: String, required: true },
    productId: { type: String },
    originalPrice: { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, min: 0 },
    discountExpiresHours: { type: Number, min: 0 },
    bonuses: [{ type: String }],
  },
}, { _id: false });

/**
 * Challenge Schema
 */
const ChallengeSchema = new Schema<IChallenge>({
  funnelId: {
    type: Schema.Types.ObjectId,
    ref: 'Funnel',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
  },
  description: {
    type: String,
    maxlength: 2000,
  },
  tagline: {
    type: String,
    maxlength: 200,
  },
  totalDays: {
    type: Number,
    required: true,
    min: 1,
    max: 30,
  },
  deliveryMode: {
    type: String,
    required: true,
    enum: Object.values(DeliveryMode),
    default: DeliveryMode.TIME_BASED,
  },
  days: {
    type: [ChallengeDaySchema],
    default: [],
    validate: {
      validator: function(days: IChallengeDay[]) {
        // Ensure day numbers are unique and sequential
        const dayNumbers = days.map(d => d.dayNumber).sort((a, b) => a - b);
        return dayNumbers.every((num, idx) => num === idx + 1);
      },
      message: 'Day numbers must be sequential starting from 1',
    },
  },
  pitchDay: {
    type: ChallengePitchDaySchema,
  },
  registration: {
    isOpen: { type: Boolean, default: true },
    startDate: { type: Date },
    endDate: { type: Date },
    maxParticipants: { type: Number, min: 1 },
    requiresEmail: { type: Boolean, default: true },
    requiresName: { type: Boolean, default: true },
    customFields: [{
      name: { type: String, required: true },
      type: { type: String, enum: ['text', 'select', 'checkbox'], required: true },
      required: { type: Boolean, default: false },
      options: [{ type: String }],
    }],
  },
  emails: {
    welcomeEmailId: { type: String },
    reminderEmailIds: [{ type: String }],
    completionEmailId: { type: String },
    inactivityEmailId: { type: String },
  },
  community: {
    enabled: { type: Boolean, default: true },
    discussionEnabled: { type: Boolean, default: true },
    showLeaderboard: { type: Boolean, default: false },
    showParticipantCount: { type: Boolean, default: true },
  },
  gamification: {
    enabled: { type: Boolean, default: false },
    pointsPerDay: { type: Number, default: 10 },
    bonusPointsEarlyCompletion: { type: Number, default: 5 },
    badges: [{
      name: { type: String, required: true },
      description: { type: String },
      iconUrl: { type: String },
      criteria: { type: String, required: true },
    }],
  },
  metrics: {
    totalRegistrations: { type: Number, default: 0 },
    activeParticipants: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    dayCompletionRates: [{ type: Number }],
    conversionRate: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(ChallengeStatus),
    default: ChallengeStatus.DRAFT,
  },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.funnelId = ret.funnelId?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.funnelId = ret.funnelId?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes
ChallengeSchema.index({ status: 1 });
ChallengeSchema.index({ slug: 1 }, { unique: true });
ChallengeSchema.index({ createdBy: 1 });
ChallengeSchema.index({ createdAt: -1 });
ChallengeSchema.index({ 'registration.isOpen': 1, status: 1 });
ChallengeSchema.index({ name: 'text', description: 'text', tagline: 'text' });

// Pre-validation: Generate slug from name
ChallengeSchema.pre('validate', async function(next) {
  try {
    if (!this.slug && this.name) {
      let baseSlug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
        .substring(0, 50);

      if (!baseSlug) {
        baseSlug = `challenge-${Date.now()}`;
      }

      this.slug = baseSlug;
    }
    next();
  } catch (error: any) {
    next(error);
  }
});

// Pre-save: Ensure slug uniqueness
ChallengeSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('slug')) {
      const ChallengeModel = mongoose.model<IChallenge>('Challenge');
      const existing = await ChallengeModel.findOne({
        slug: this.slug,
        _id: { $ne: this._id },
      });

      if (existing) {
        this.slug = `${this.slug}-${Date.now()}`;
      }
    }
    next();
  } catch (error: any) {
    next(error);
  }
});

// Instance methods
ChallengeSchema.methods.isRegistrationOpen = function(): boolean {
  if (!this.registration.isOpen) return false;

  const now = new Date();
  if (this.registration.startDate && now < this.registration.startDate) return false;
  if (this.registration.endDate && now > this.registration.endDate) return false;
  if (this.registration.maxParticipants &&
      this.metrics.totalRegistrations >= this.registration.maxParticipants) return false;

  return true;
};

ChallengeSchema.methods.getDayByNumber = function(dayNumber: number): IChallengeDay | undefined {
  return this.days.find((day: IChallengeDay) => day.dayNumber === dayNumber);
};

// Static methods
ChallengeSchema.statics.findOpenChallenges = function() {
  return this.find({
    status: ChallengeStatus.PUBLISHED,
    'registration.isOpen': true,
  });
};

ChallengeSchema.statics.findBySlug = function(slug: string) {
  return this.findOne({ slug });
};

const ChallengeModel = mongoose.model<IChallenge>('Challenge', ChallengeSchema);

export { ChallengeModel as Challenge };
export default ChallengeModel;
