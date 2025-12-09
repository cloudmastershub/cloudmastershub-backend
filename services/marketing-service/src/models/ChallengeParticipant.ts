import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Participant Status
 */
export enum ParticipantStatus {
  ACTIVE = 'active',           // Currently going through challenge
  COMPLETED = 'completed',     // Finished all days
  CONVERTED = 'converted',     // Made a purchase
  DROPPED = 'dropped',         // Stopped participating
  PAUSED = 'paused',           // Temporarily paused
}

/**
 * Day Progress
 */
export interface IDayProgress {
  dayNumber: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  unlockedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  videoWatchPercent?: number;
  exercisesCompleted?: string[];
  quizScore?: number;
  timeSpentMinutes?: number;
}

/**
 * Challenge Participant Interface
 */
export interface IChallengeParticipant extends Document {
  _id: mongoose.Types.ObjectId;
  challengeId: mongoose.Types.ObjectId;
  funnelId: mongoose.Types.ObjectId;

  // User identification
  email: string;
  firstName?: string;
  lastName?: string;
  userId?: string;              // If converted to registered user
  leadId?: mongoose.Types.ObjectId; // Reference to leads collection

  // Custom field responses
  customFieldResponses?: Record<string, string | boolean>;

  // Progress tracking
  registeredAt: Date;
  currentDay: number;
  completedDays: number[];
  dayProgress: IDayProgress[];
  lastAccessedAt?: Date;

  // Day unlock schedule (calculated based on delivery mode)
  dayUnlocks: Record<string, Date>;  // { "1": date, "2": date, ... }

  // Engagement metrics
  engagement: {
    totalTimeSpentMinutes: number;
    totalVideosWatched: number;
    totalExercisesCompleted: number;
    loginCount: number;
    lastActiveAt?: Date;
    streakDays: number;           // Consecutive days active
    longestStreak: number;
  };

  // Gamification
  points: number;
  badges: string[];               // Badge criteria codes earned

  // Conversion tracking
  status: ParticipantStatus;
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
    landingPageId?: string;
  };

  // Communication
  emailConsent: boolean;
  emailsReceived: string[];       // Email template IDs sent
  lastEmailSentAt?: Date;
  unsubscribedAt?: Date;

  // Metadata
  ipAddress?: string;
  userAgent?: string;
  timezone?: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Challenge Participant Statics Interface
 */
interface IChallengeParticipantStatics extends Model<IChallengeParticipant> {
  findByChallenge(challengeId: string): Promise<IChallengeParticipant[]>;
  findByEmail(email: string): Promise<IChallengeParticipant[]>;
  findActive(challengeId: string): Promise<IChallengeParticipant[]>;
  getLeaderboard(challengeId: string, limit?: number): Promise<IChallengeParticipant[]>;
  getChallengeStats(challengeId: string): Promise<{
    totalParticipants: number;
    activeParticipants: number;
    completedParticipants: number;
    convertedParticipants: number;
    totalRevenue: number;
    avgCompletedDays: number;
    totalPoints: number;
  }>;
}

/**
 * Day Progress Schema
 */
const DayProgressSchema = new Schema<IDayProgress>({
  dayNumber: { type: Number, required: true },
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
  exercisesCompleted: [{ type: String }],
  quizScore: { type: Number, min: 0, max: 100 },
  timeSpentMinutes: { type: Number, min: 0, default: 0 },
}, { _id: false });

/**
 * Challenge Participant Schema
 */
const ChallengeParticipantSchema = new Schema<IChallengeParticipant>({
  challengeId: {
    type: Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true,
    index: true,
  },
  funnelId: {
    type: Schema.Types.ObjectId,
    ref: 'Funnel',
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
  customFieldResponses: {
    type: Schema.Types.Mixed,
  },
  registeredAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  currentDay: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  completedDays: {
    type: [Number],
    default: [],
  },
  dayProgress: {
    type: [DayProgressSchema],
    default: [],
  },
  lastAccessedAt: {
    type: Date,
  },
  dayUnlocks: {
    type: Schema.Types.Mixed,
    default: {},
  },
  engagement: {
    totalTimeSpentMinutes: { type: Number, default: 0 },
    totalVideosWatched: { type: Number, default: 0 },
    totalExercisesCompleted: { type: Number, default: 0 },
    loginCount: { type: Number, default: 1 },
    lastActiveAt: { type: Date },
    streakDays: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
  },
  points: {
    type: Number,
    default: 0,
    min: 0,
  },
  badges: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(ParticipantStatus),
    default: ParticipantStatus.ACTIVE,
    index: true,
  },
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
    landingPageId: { type: String },
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
  unsubscribedAt: { type: Date },
  ipAddress: { type: String },
  userAgent: { type: String },
  timezone: { type: String },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.challengeId = ret.challengeId?.toString();
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
      ret.challengeId = ret.challengeId?.toString();
      ret.funnelId = ret.funnelId?.toString();
      ret.leadId = ret.leadId?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Compound indexes
ChallengeParticipantSchema.index({ challengeId: 1, email: 1 }, { unique: true });
ChallengeParticipantSchema.index({ challengeId: 1, status: 1 });
ChallengeParticipantSchema.index({ funnelId: 1, status: 1 });
ChallengeParticipantSchema.index({ registeredAt: -1 });
ChallengeParticipantSchema.index({ lastAccessedAt: -1 });
ChallengeParticipantSchema.index({ points: -1 }); // For leaderboard

// Instance methods
ChallengeParticipantSchema.methods.isDayUnlocked = function(dayNumber: number): boolean {
  const unlockDate = this.dayUnlocks[dayNumber.toString()];
  if (!unlockDate) return dayNumber === 1; // Day 1 is always unlocked
  return new Date() >= new Date(unlockDate);
};

ChallengeParticipantSchema.methods.completeDay = function(dayNumber: number): void {
  if (!this.completedDays.includes(dayNumber)) {
    this.completedDays.push(dayNumber);
    this.completedDays.sort((a: number, b: number) => a - b);
  }

  // Update day progress
  const dayProgress = this.dayProgress.find((dp: IDayProgress) => dp.dayNumber === dayNumber);
  if (dayProgress) {
    dayProgress.status = 'completed';
    dayProgress.completedAt = new Date();
  }

  // Update current day
  if (dayNumber >= this.currentDay) {
    this.currentDay = dayNumber + 1;
  }
};

ChallengeParticipantSchema.methods.addPoints = function(points: number): void {
  this.points = (this.points || 0) + points;
};

ChallengeParticipantSchema.methods.awardBadge = function(badgeCriteria: string): void {
  if (!this.badges.includes(badgeCriteria)) {
    this.badges.push(badgeCriteria);
  }
};

ChallengeParticipantSchema.methods.markConverted = function(purchaseId: string, amount: number): void {
  this.status = ParticipantStatus.CONVERTED;
  this.convertedAt = new Date();
  this.purchaseId = purchaseId;
  this.purchaseAmount = amount;
};

ChallengeParticipantSchema.methods.updateStreak = function(): void {
  const now = new Date();
  const lastActive = this.engagement.lastActiveAt;

  if (!lastActive) {
    this.engagement.streakDays = 1;
  } else {
    const hoursSinceLastActive = (now.getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastActive <= 48) {
      // Within 48 hours, maintain or increment streak
      const daysSinceLastActive = Math.floor(hoursSinceLastActive / 24);
      if (daysSinceLastActive >= 1) {
        this.engagement.streakDays += 1;
      }
    } else {
      // More than 48 hours, reset streak
      this.engagement.streakDays = 1;
    }
  }

  // Update longest streak
  if (this.engagement.streakDays > this.engagement.longestStreak) {
    this.engagement.longestStreak = this.engagement.streakDays;
  }

  this.engagement.lastActiveAt = now;
  this.engagement.loginCount += 1;
};

// Static methods
ChallengeParticipantSchema.statics.findByChallenge = function(challengeId: string) {
  return this.find({ challengeId });
};

ChallengeParticipantSchema.statics.findByEmail = function(email: string) {
  return this.find({ email: email.toLowerCase() });
};

ChallengeParticipantSchema.statics.findActive = function(challengeId: string) {
  return this.find({
    challengeId,
    status: ParticipantStatus.ACTIVE,
  });
};

ChallengeParticipantSchema.statics.getLeaderboard = function(challengeId: string, limit: number = 10) {
  return this.find({ challengeId })
    .sort({ points: -1, completedDays: -1 })
    .limit(limit);
};

ChallengeParticipantSchema.statics.getChallengeStats = async function(challengeId: string) {
  const stats = await this.aggregate([
    { $match: { challengeId: new mongoose.Types.ObjectId(challengeId) } },
    {
      $group: {
        _id: null,
        totalParticipants: { $sum: 1 },
        activeParticipants: {
          $sum: { $cond: [{ $eq: ['$status', ParticipantStatus.ACTIVE] }, 1, 0] },
        },
        completedParticipants: {
          $sum: { $cond: [{ $eq: ['$status', ParticipantStatus.COMPLETED] }, 1, 0] },
        },
        convertedParticipants: {
          $sum: { $cond: [{ $eq: ['$status', ParticipantStatus.CONVERTED] }, 1, 0] },
        },
        totalRevenue: { $sum: { $ifNull: ['$purchaseAmount', 0] } },
        avgCompletedDays: { $avg: { $size: '$completedDays' } },
        totalPoints: { $sum: '$points' },
      },
    },
  ]);

  return stats[0] || {
    totalParticipants: 0,
    activeParticipants: 0,
    completedParticipants: 0,
    convertedParticipants: 0,
    totalRevenue: 0,
    avgCompletedDays: 0,
    totalPoints: 0,
  };
};

const ChallengeParticipantModel = mongoose.model<IChallengeParticipant, IChallengeParticipantStatics>(
  'ChallengeParticipant',
  ChallengeParticipantSchema
);

export { ChallengeParticipantModel as ChallengeParticipant };
export default ChallengeParticipantModel;
