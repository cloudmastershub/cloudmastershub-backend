import mongoose from 'mongoose';
import {
  Challenge,
  IChallenge,
  ChallengeStatus,
  ChallengeParticipant,
  IChallengeParticipant,
  ParticipantStatus,
  IDayProgress,
  DeliveryMode,
  Funnel,
  FunnelType,
  FunnelStatus,
} from '../models';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Input types for Challenge operations
 */
export interface CreateChallengeInput {
  name: string;
  slug?: string;
  description?: string;
  tagline?: string;
  totalDays: number;
  deliveryMode: DeliveryMode;
  registration?: {
    isOpen?: boolean;
    startDate?: Date;
    endDate?: Date;
    maxParticipants?: number;
    requiresEmail?: boolean;
    requiresName?: boolean;
    customFields?: {
      name: string;
      type: 'text' | 'select' | 'checkbox';
      required: boolean;
      options?: string[];
    }[];
  };
  community?: {
    enabled?: boolean;
    discussionEnabled?: boolean;
    showLeaderboard?: boolean;
    showParticipantCount?: boolean;
  };
  gamification?: {
    enabled?: boolean;
    pointsPerDay?: number;
    bonusPointsEarlyCompletion?: number;
  };
  createdBy: string;
}

export interface UpdateChallengeInput {
  name?: string;
  slug?: string;
  description?: string;
  tagline?: string;
  totalDays?: number;
  deliveryMode?: DeliveryMode;
  registration?: CreateChallengeInput['registration'];
  community?: CreateChallengeInput['community'];
  gamification?: CreateChallengeInput['gamification'];
  emails?: {
    welcomeEmailId?: string;
    reminderEmailIds?: string[];
    completionEmailId?: string;
    inactivityEmailId?: string;
  };
  updatedBy: string;
}

export interface ChallengeDayInput {
  dayNumber: number;
  title: string;
  description?: string;
  landingPageId: string;
  emailTemplateId?: string;
  content?: {
    videoUrl?: string;
    videoTitle?: string;
    videoDuration?: number;
    exercises?: string[];
    resources?: {
      title: string;
      url: string;
      type: 'pdf' | 'link' | 'download' | 'video';
    }[];
    bonusContent?: string;
  };
  unlockAfterHours?: number;
  estimatedDuration?: number;
  completionCriteria?: {
    videoWatchPercent?: number;
    requireExercise?: boolean;
    requireQuiz?: boolean;
  };
}

export interface RegisterParticipantInput {
  email: string;
  firstName?: string;
  lastName?: string;
  customFieldResponses?: Record<string, string | boolean>;
  source?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referralCode?: string;
    landingPageId?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  timezone?: string;
}

export interface ListChallengesOptions {
  page?: number;
  limit?: number;
  status?: ChallengeStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  createdBy?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Challenge Service - Business logic for challenge operations
 */
class ChallengeService {
  /**
   * Create a new challenge (also creates parent funnel)
   */
  async create(input: CreateChallengeInput): Promise<IChallenge> {
    try {
      // First, create a parent funnel for this challenge
      const funnel = new Funnel({
        name: input.name,
        description: input.description,
        type: FunnelType.CHALLENGE,
        status: FunnelStatus.DRAFT,
        settings: {
          deliveryMode: input.deliveryMode,
        },
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      });
      await funnel.save();

      // Create the challenge
      const challenge = new Challenge({
        funnelId: funnel._id,
        name: input.name,
        slug: input.slug,
        description: input.description,
        tagline: input.tagline,
        totalDays: input.totalDays,
        deliveryMode: input.deliveryMode,
        days: [],
        registration: {
          isOpen: input.registration?.isOpen ?? true,
          startDate: input.registration?.startDate,
          endDate: input.registration?.endDate,
          maxParticipants: input.registration?.maxParticipants,
          requiresEmail: input.registration?.requiresEmail ?? true,
          requiresName: input.registration?.requiresName ?? true,
          customFields: input.registration?.customFields || [],
        },
        community: {
          enabled: input.community?.enabled ?? true,
          discussionEnabled: input.community?.discussionEnabled ?? true,
          showLeaderboard: input.community?.showLeaderboard ?? false,
          showParticipantCount: input.community?.showParticipantCount ?? true,
        },
        gamification: {
          enabled: input.gamification?.enabled ?? false,
          pointsPerDay: input.gamification?.pointsPerDay ?? 10,
          bonusPointsEarlyCompletion: input.gamification?.bonusPointsEarlyCompletion ?? 5,
          badges: [],
        },
        metrics: {
          totalRegistrations: 0,
          activeParticipants: 0,
          completionRate: 0,
          dayCompletionRates: [],
          conversionRate: 0,
          totalRevenue: 0,
        },
        status: ChallengeStatus.DRAFT,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      });

      await challenge.save();
      logger.info(`Challenge created: ${challenge.name} (${challenge.id})`);
      return challenge;
    } catch (error: any) {
      logger.error('Error creating challenge:', error);
      if (error.code === 11000) {
        throw ApiError.conflict('A challenge with this slug already exists');
      }
      throw error;
    }
  }

  /**
   * Get challenge by ID
   */
  async getById(id: string): Promise<IChallenge | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }
    return Challenge.findById(id);
  }

  /**
   * Get challenge by slug
   */
  async getBySlug(slug: string): Promise<IChallenge | null> {
    return Challenge.findOne({ slug: slug.toLowerCase() });
  }

  /**
   * Get published challenge by slug (for public access)
   */
  async getPublishedBySlug(slug: string): Promise<IChallenge | null> {
    return Challenge.findOne({
      slug: slug.toLowerCase(),
      status: ChallengeStatus.PUBLISHED,
    });
  }

  /**
   * List challenges with pagination
   */
  async list(options: ListChallengesOptions = {}): Promise<PaginatedResult<IChallenge>> {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      createdBy,
    } = options;

    const query: any = {};

    if (status) query.status = status;
    if (createdBy) query.createdBy = createdBy;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tagline: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [challenges, total] = await Promise.all([
      Challenge.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Challenge.countDocuments(query),
    ]);

    return {
      data: challenges as IChallenge[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update challenge
   */
  async update(id: string, input: UpdateChallengeInput): Promise<IChallenge | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) return null;

    // Update fields
    if (input.name !== undefined) challenge.name = input.name;
    if (input.slug !== undefined) challenge.slug = input.slug;
    if (input.description !== undefined) challenge.description = input.description;
    if (input.tagline !== undefined) challenge.tagline = input.tagline;
    if (input.totalDays !== undefined) challenge.totalDays = input.totalDays;
    if (input.deliveryMode !== undefined) challenge.deliveryMode = input.deliveryMode;

    if (input.registration) {
      challenge.registration = { ...challenge.registration, ...input.registration };
    }
    if (input.community) {
      challenge.community = { ...challenge.community, ...input.community };
    }
    if (input.gamification) {
      challenge.gamification = { ...challenge.gamification, ...input.gamification };
    }
    if (input.emails) {
      challenge.emails = { ...challenge.emails, ...input.emails };
    }

    challenge.updatedBy = input.updatedBy;
    await challenge.save();

    logger.info(`Challenge updated: ${challenge.name} (${challenge.id})`);
    return challenge;
  }

  /**
   * Delete challenge
   */
  async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) return false;

    // Delete associated participants
    await ChallengeParticipant.deleteMany({ challengeId: id });

    // Delete the challenge
    await Challenge.findByIdAndDelete(id);

    // Optionally delete the parent funnel
    if (challenge.funnelId) {
      await Funnel.findByIdAndDelete(challenge.funnelId);
    }

    logger.info(`Challenge deleted: ${challenge.name} (${id})`);
    return true;
  }

  /**
   * Publish challenge
   */
  async publish(id: string, updatedBy: string): Promise<IChallenge | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) return null;

    // Validate challenge has days configured
    if (challenge.days.length === 0) {
      throw ApiError.badRequest('Cannot publish challenge without any days configured');
    }

    // Validate all days have landing pages
    for (const day of challenge.days) {
      if (!day.landingPageId) {
        throw ApiError.badRequest(`Day ${day.dayNumber} is missing a landing page`);
      }
    }

    challenge.status = ChallengeStatus.PUBLISHED;
    challenge.updatedBy = updatedBy;
    await challenge.save();

    // Also publish the parent funnel
    if (challenge.funnelId) {
      await Funnel.findByIdAndUpdate(challenge.funnelId, {
        status: FunnelStatus.PUBLISHED,
        publishedAt: new Date(),
      });
    }

    logger.info(`Challenge published: ${challenge.name} (${challenge.id})`);
    return challenge;
  }

  /**
   * Pause challenge
   */
  async pause(id: string, updatedBy: string): Promise<IChallenge | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) return null;

    challenge.status = ChallengeStatus.PAUSED;
    challenge.updatedBy = updatedBy;
    await challenge.save();

    logger.info(`Challenge paused: ${challenge.name} (${challenge.id})`);
    return challenge;
  }

  /**
   * Add or update a challenge day
   */
  async upsertDay(id: string, dayInput: ChallengeDayInput, updatedBy: string): Promise<IChallenge | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) return null;

    // Validate day number
    if (dayInput.dayNumber < 1 || dayInput.dayNumber > challenge.totalDays) {
      throw ApiError.badRequest(`Day number must be between 1 and ${challenge.totalDays}`);
    }

    // Calculate unlock hours based on delivery mode if not specified
    let unlockAfterHours = dayInput.unlockAfterHours;
    if (unlockAfterHours === undefined) {
      if (challenge.deliveryMode === DeliveryMode.TIME_BASED) {
        unlockAfterHours = (dayInput.dayNumber - 1) * 24; // Day 1 = 0h, Day 2 = 24h, etc.
      } else {
        unlockAfterHours = 0;
      }
    }

    const dayData = {
      dayNumber: dayInput.dayNumber,
      title: dayInput.title,
      description: dayInput.description,
      landingPageId: dayInput.landingPageId,
      emailTemplateId: dayInput.emailTemplateId,
      content: {
        videoUrl: dayInput.content?.videoUrl,
        videoTitle: dayInput.content?.videoTitle,
        videoDuration: dayInput.content?.videoDuration,
        exercises: dayInput.content?.exercises || [],
        resources: dayInput.content?.resources || [],
        bonusContent: dayInput.content?.bonusContent,
      },
      unlockAfterHours,
      estimatedDuration: dayInput.estimatedDuration || 30,
      completionCriteria: dayInput.completionCriteria || {},
    };

    // Find existing day or add new
    const existingDayIndex = challenge.days.findIndex(d => d.dayNumber === dayInput.dayNumber);
    if (existingDayIndex >= 0) {
      challenge.days[existingDayIndex] = dayData as any;
    } else {
      challenge.days.push(dayData as any);
      // Sort days by day number
      challenge.days.sort((a, b) => a.dayNumber - b.dayNumber);
    }

    challenge.updatedBy = updatedBy;
    await challenge.save();

    logger.info(`Challenge day ${dayInput.dayNumber} upserted: ${challenge.name} (${challenge.id})`);
    return challenge;
  }

  /**
   * Remove a challenge day
   */
  async removeDay(id: string, dayNumber: number, updatedBy: string): Promise<IChallenge | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) return null;

    const dayIndex = challenge.days.findIndex(d => d.dayNumber === dayNumber);
    if (dayIndex === -1) {
      throw ApiError.notFound(`Day ${dayNumber} not found`);
    }

    challenge.days.splice(dayIndex, 1);
    challenge.updatedBy = updatedBy;
    await challenge.save();

    logger.info(`Challenge day ${dayNumber} removed: ${challenge.name} (${challenge.id})`);
    return challenge;
  }

  /**
   * Set pitch day (final sales page)
   */
  async setPitchDay(
    id: string,
    pitchDay: {
      title: string;
      landingPageId: string;
      emailTemplateId?: string;
      offerDetails: {
        productName: string;
        productId?: string;
        originalPrice: number;
        discountedPrice?: number;
        discountExpiresHours?: number;
        bonuses?: string[];
      };
    },
    updatedBy: string
  ): Promise<IChallenge | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(id);
    if (!challenge) return null;

    challenge.pitchDay = {
      dayNumber: challenge.totalDays + 1,
      title: pitchDay.title,
      landingPageId: pitchDay.landingPageId,
      emailTemplateId: pitchDay.emailTemplateId,
      offerDetails: pitchDay.offerDetails,
    };

    challenge.updatedBy = updatedBy;
    await challenge.save();

    logger.info(`Challenge pitch day set: ${challenge.name} (${challenge.id})`);
    return challenge;
  }

  // ==========================================
  // Participant Management
  // ==========================================

  /**
   * Register a participant for a challenge
   */
  async registerParticipant(
    challengeId: string,
    input: RegisterParticipantInput
  ): Promise<IChallengeParticipant> {
    if (!mongoose.Types.ObjectId.isValid(challengeId)) {
      throw ApiError.badRequest('Invalid challenge ID');
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      throw ApiError.notFound('Challenge not found');
    }

    // Check if registration is open
    if (!challenge.registration.isOpen) {
      throw ApiError.badRequest('Registration is closed for this challenge');
    }

    // Check registration dates
    const now = new Date();
    if (challenge.registration.startDate && now < challenge.registration.startDate) {
      throw ApiError.badRequest('Registration has not started yet');
    }
    if (challenge.registration.endDate && now > challenge.registration.endDate) {
      throw ApiError.badRequest('Registration has ended');
    }

    // Check max participants
    if (challenge.registration.maxParticipants) {
      const currentCount = await ChallengeParticipant.countDocuments({ challengeId });
      if (currentCount >= challenge.registration.maxParticipants) {
        throw ApiError.badRequest('Challenge is full');
      }
    }

    // Check if already registered
    const existing = await ChallengeParticipant.findOne({
      challengeId,
      email: input.email.toLowerCase(),
    });
    if (existing) {
      throw ApiError.conflict('Already registered for this challenge');
    }

    // Calculate day unlock schedule based on delivery mode
    const registeredAt = new Date();
    const dayUnlocks: Record<string, Date> = {};

    for (const day of challenge.days) {
      if (challenge.deliveryMode === DeliveryMode.TIME_BASED) {
        const unlockDate = new Date(registeredAt);
        unlockDate.setHours(unlockDate.getHours() + day.unlockAfterHours);
        dayUnlocks[day.dayNumber.toString()] = unlockDate;
      } else if (challenge.deliveryMode === DeliveryMode.ALL_AT_ONCE) {
        dayUnlocks[day.dayNumber.toString()] = registeredAt;
      }
      // For DRIP_FED, unlocks are calculated dynamically based on completion
    }

    // Initialize day progress
    const dayProgress: IDayProgress[] = challenge.days.map(day => ({
      dayNumber: day.dayNumber,
      status: day.dayNumber === 1 ? 'unlocked' :
              (challenge.deliveryMode === DeliveryMode.ALL_AT_ONCE ? 'unlocked' : 'locked'),
      unlockedAt: day.dayNumber === 1 || challenge.deliveryMode === DeliveryMode.ALL_AT_ONCE
                  ? registeredAt : undefined,
      timeSpentMinutes: 0,
    }));

    // Create participant
    const participant = new ChallengeParticipant({
      challengeId: challenge._id,
      funnelId: challenge.funnelId,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      customFieldResponses: input.customFieldResponses,
      registeredAt,
      currentDay: 1,
      completedDays: [],
      dayProgress,
      dayUnlocks,
      engagement: {
        totalTimeSpentMinutes: 0,
        totalVideosWatched: 0,
        totalExercisesCompleted: 0,
        loginCount: 1,
        lastActiveAt: registeredAt,
        streakDays: 1,
        longestStreak: 1,
      },
      points: challenge.gamification.enabled ? challenge.gamification.pointsPerDay : 0,
      badges: [],
      status: ParticipantStatus.ACTIVE,
      source: input.source || {},
      emailConsent: true,
      emailsReceived: [],
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      timezone: input.timezone,
    });

    await participant.save();

    // Update challenge metrics
    challenge.metrics.totalRegistrations += 1;
    challenge.metrics.activeParticipants += 1;
    await challenge.save();

    logger.info(`Participant registered: ${input.email} for challenge ${challenge.name}`);
    return participant;
  }

  /**
   * Get participant by ID
   */
  async getParticipant(participantId: string): Promise<IChallengeParticipant | null> {
    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      throw ApiError.badRequest('Invalid participant ID');
    }
    return ChallengeParticipant.findById(participantId);
  }

  /**
   * Get participant by email for a challenge
   */
  async getParticipantByEmail(
    challengeId: string,
    email: string
  ): Promise<IChallengeParticipant | null> {
    return ChallengeParticipant.findOne({
      challengeId,
      email: email.toLowerCase(),
    });
  }

  /**
   * Get participant's current progress
   */
  async getParticipantProgress(
    challengeId: string,
    email: string
  ): Promise<{
    participant: IChallengeParticipant;
    challenge: IChallenge;
    currentDayContent: any;
    nextUnlock: { dayNumber: number; unlocksAt: Date } | null;
  } | null> {
    const participant = await this.getParticipantByEmail(challengeId, email);
    if (!participant) return null;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return null;

    // Update unlock statuses for time-based delivery
    if (challenge.deliveryMode === DeliveryMode.TIME_BASED) {
      const now = new Date();
      let updated = false;

      for (const dayProgress of participant.dayProgress) {
        if (dayProgress.status === 'locked') {
          const unlockDate = participant.dayUnlocks[dayProgress.dayNumber.toString()];
          if (unlockDate && now >= new Date(unlockDate)) {
            dayProgress.status = 'unlocked';
            dayProgress.unlockedAt = new Date(unlockDate);
            updated = true;
          }
        }
      }

      if (updated) {
        await participant.save();
      }
    }

    // Get current day content
    const currentDay = challenge.days.find(d => d.dayNumber === participant.currentDay);

    // Find next unlock
    let nextUnlock: { dayNumber: number; unlocksAt: Date } | null = null;
    if (challenge.deliveryMode === DeliveryMode.TIME_BASED) {
      const now = new Date();
      for (const [dayNum, unlockDate] of Object.entries(participant.dayUnlocks)) {
        const unlock = new Date(unlockDate);
        if (unlock > now) {
          if (!nextUnlock || unlock < nextUnlock.unlocksAt) {
            nextUnlock = { dayNumber: parseInt(dayNum), unlocksAt: unlock };
          }
        }
      }
    }

    return {
      participant,
      challenge,
      currentDayContent: currentDay,
      nextUnlock,
    };
  }

  /**
   * Mark a day as complete
   */
  async completeDay(
    challengeId: string,
    email: string,
    dayNumber: number,
    completionData?: {
      videoWatchPercent?: number;
      exercisesCompleted?: string[];
      quizScore?: number;
      timeSpentMinutes?: number;
    }
  ): Promise<IChallengeParticipant | null> {
    const participant = await this.getParticipantByEmail(challengeId, email);
    if (!participant) return null;

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return null;

    // Find day progress
    const dayProgress = participant.dayProgress.find(dp => dp.dayNumber === dayNumber);
    if (!dayProgress) {
      throw ApiError.notFound(`Day ${dayNumber} not found`);
    }

    // Check if day is unlocked
    if (dayProgress.status === 'locked') {
      throw ApiError.badRequest(`Day ${dayNumber} is not yet unlocked`);
    }

    // Check completion criteria
    const day = challenge.days.find(d => d.dayNumber === dayNumber);
    if (day?.completionCriteria) {
      if (day.completionCriteria.videoWatchPercent && completionData?.videoWatchPercent) {
        if (completionData.videoWatchPercent < day.completionCriteria.videoWatchPercent) {
          throw ApiError.badRequest(
            `Must watch at least ${day.completionCriteria.videoWatchPercent}% of the video`
          );
        }
      }
    }

    // Update day progress
    dayProgress.status = 'completed';
    dayProgress.completedAt = new Date();
    if (completionData) {
      dayProgress.videoWatchPercent = completionData.videoWatchPercent;
      dayProgress.exercisesCompleted = completionData.exercisesCompleted;
      dayProgress.quizScore = completionData.quizScore;
      dayProgress.timeSpentMinutes = completionData.timeSpentMinutes;
    }

    // Add to completed days
    if (!participant.completedDays.includes(dayNumber)) {
      participant.completedDays.push(dayNumber);
      participant.completedDays.sort((a, b) => a - b);
    }

    // Update engagement
    participant.engagement.totalTimeSpentMinutes += completionData?.timeSpentMinutes || 0;
    if (completionData?.videoWatchPercent && completionData.videoWatchPercent > 0) {
      participant.engagement.totalVideosWatched += 1;
    }
    if (completionData?.exercisesCompleted) {
      participant.engagement.totalExercisesCompleted += completionData.exercisesCompleted.length;
    }

    // Award points
    if (challenge.gamification.enabled) {
      participant.points += challenge.gamification.pointsPerDay;
    }

    // For drip-fed mode, unlock next day
    if (challenge.deliveryMode === DeliveryMode.DRIP_FED) {
      const nextDayProgress = participant.dayProgress.find(dp => dp.dayNumber === dayNumber + 1);
      if (nextDayProgress && nextDayProgress.status === 'locked') {
        nextDayProgress.status = 'unlocked';
        nextDayProgress.unlockedAt = new Date();
      }
    }

    // Update current day
    if (dayNumber >= participant.currentDay) {
      participant.currentDay = Math.min(dayNumber + 1, challenge.totalDays);
    }

    // Check if challenge is complete
    if (participant.completedDays.length === challenge.totalDays) {
      participant.status = ParticipantStatus.COMPLETED;

      // Award completion badge
      if (challenge.gamification.enabled) {
        participant.badges.push('challenge_complete');
        participant.points += challenge.gamification.bonusPointsEarlyCompletion;
      }
    }

    // Update streak
    participant.engagement.lastActiveAt = new Date();

    await participant.save();

    // Update challenge metrics
    await this.updateChallengeMetrics(challengeId);

    logger.info(`Day ${dayNumber} completed by ${email} for challenge ${challenge.name}`);
    return participant;
  }

  /**
   * Get challenge participants
   */
  async getParticipants(
    challengeId: string,
    options: {
      page?: number;
      limit?: number;
      status?: ParticipantStatus;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<PaginatedResult<IChallengeParticipant>> {
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'registeredAt',
      sortOrder = 'desc',
    } = options;

    const query: any = { challengeId };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [participants, total] = await Promise.all([
      ChallengeParticipant.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChallengeParticipant.countDocuments(query),
    ]);

    return {
      data: participants as IChallengeParticipant[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get challenge leaderboard
   */
  async getLeaderboard(challengeId: string, limit: number = 10): Promise<IChallengeParticipant[]> {
    return ChallengeParticipant.find({ challengeId })
      .sort({ points: -1, completedDays: -1 })
      .limit(limit)
      .select('firstName lastName email points completedDays badges')
      .lean() as Promise<IChallengeParticipant[]>;
  }

  /**
   * Update challenge metrics
   */
  async updateChallengeMetrics(challengeId: string): Promise<void> {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return;

    const stats = await ChallengeParticipant.getChallengeStats(challengeId);

    challenge.metrics.totalRegistrations = stats.totalParticipants;
    challenge.metrics.activeParticipants = stats.activeParticipants;
    challenge.metrics.completionRate = stats.totalParticipants > 0
      ? (stats.completedParticipants / stats.totalParticipants) * 100
      : 0;
    challenge.metrics.conversionRate = stats.totalParticipants > 0
      ? (stats.convertedParticipants / stats.totalParticipants) * 100
      : 0;
    challenge.metrics.totalRevenue = stats.totalRevenue;

    // Calculate day completion rates
    const dayCompletionRates: number[] = [];
    for (let i = 1; i <= challenge.totalDays; i++) {
      const completedCount = await ChallengeParticipant.countDocuments({
        challengeId,
        completedDays: i,
      });
      dayCompletionRates.push(
        stats.totalParticipants > 0 ? (completedCount / stats.totalParticipants) * 100 : 0
      );
    }
    challenge.metrics.dayCompletionRates = dayCompletionRates;

    await challenge.save();
  }

  /**
   * Get challenge statistics
   */
  async getStats(challengeId: string): Promise<{
    metrics: IChallenge['metrics'];
    participantStats: any;
    dayStats: { dayNumber: number; completions: number; completionRate: number }[];
  } | null> {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) return null;

    const participantStats = await ChallengeParticipant.getChallengeStats(challengeId);

    const dayStats = [];
    const totalParticipants = participantStats.totalParticipants || 1;

    for (let i = 1; i <= challenge.totalDays; i++) {
      const completions = await ChallengeParticipant.countDocuments({
        challengeId,
        completedDays: i,
      });
      dayStats.push({
        dayNumber: i,
        completions,
        completionRate: (completions / totalParticipants) * 100,
      });
    }

    return {
      metrics: challenge.metrics,
      participantStats,
      dayStats,
    };
  }
}

export const challengeService = new ChallengeService();
export default challengeService;
