import {
  FunnelParticipant,
  IFunnelParticipant,
  FunnelParticipantStatus,
  IStepProgress
} from '../models/FunnelParticipant';
import { Funnel, IFunnel, FunnelStatus, DeliveryMode, FunnelStepType } from '../models';
import { Lead, LeadSource, LeadStatus } from '../models';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

/**
 * Registration input for funnel
 */
export interface RegisterInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields?: Record<string, string | boolean | number>;
  userId?: string;
  source?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referralCode?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  timezone?: string;
  emailConsent?: boolean;
}

/**
 * Public funnel data with access control
 */
export interface PublicFunnelWithAccess {
  funnel: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    type: string;
    design?: any;
    settings?: {
      deliveryMode?: string;
    };
  };
  steps: Array<{
    id: string;
    name: string;
    type: string;
    order: number;
    isAccessible: boolean;
    isCompleted: boolean;
    pageContent?: any;  // Only included if accessible
    settings?: any;     // Step settings (timer, button delay, auto-play, etc.)
    webinarSettings?: any; // Webinar-specific settings
  }>;
  registration: {
    isRegistered: boolean;
    sessionToken?: string;
    currentStepId?: string;
    currentStepOrder?: number;
    completedStepIds?: string[];
  };
}

/**
 * FunnelParticipant Service - handles registration and progress tracking
 */
class FunnelParticipantService {
  /**
   * Register a participant for a funnel
   */
  async register(slug: string, input: RegisterInput): Promise<{
    participant: IFunnelParticipant;
    sessionToken: string;
    nextStepId: string;
  }> {
    // Find the funnel
    const funnel = await Funnel.findOne({
      slug: slug.toLowerCase(),
      status: FunnelStatus.PUBLISHED,
    });

    if (!funnel) {
      throw ApiError.notFound('Funnel not found or not published');
    }

    if (funnel.steps.length === 0) {
      throw ApiError.badRequest('Funnel has no steps configured');
    }

    // Check if already registered
    const existing = await FunnelParticipant.findByFunnelSlugAndEmail(slug, input.email);
    if (existing) {
      // Return existing participant with their progress
      const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);
      const currentStep = sortedSteps.find(s => !existing.completedStepIds.includes(s.id)) || sortedSteps[0];

      // Update last accessed
      existing.lastAccessedAt = new Date();
      await existing.save();

      return {
        participant: existing,
        sessionToken: existing.sessionToken || uuidv4(),
        nextStepId: currentStep.id,
      };
    }

    // Sort steps by order
    const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);
    const firstStep = sortedSteps[0];

    // Generate session token for tracking
    const sessionToken = uuidv4();

    // Calculate step unlocks based on delivery mode
    const stepUnlocks = this.calculateStepUnlocks(funnel, new Date());

    // Initialize step progress for all steps
    const stepProgress: IStepProgress[] = sortedSteps.map((step, index) => ({
      stepId: step.id,
      stepOrder: step.order,
      status: index === 0 ? 'completed' : (index === 1 ? 'unlocked' : 'locked'),
      unlockedAt: index <= 1 ? new Date() : undefined,
      completedAt: index === 0 ? new Date() : undefined,  // First step (optin) is completed by registering
      formSubmitted: index === 0 ? true : undefined,
    }));

    // Determine the next step (step after registration/optin)
    const nextStep = sortedSteps.length > 1 ? sortedSteps[1] : sortedSteps[0];

    // Create participant
    const participant = new FunnelParticipant({
      funnelId: funnel._id,
      funnelSlug: funnel.slug,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      userId: input.userId,
      customFields: input.customFields,
      registeredAt: new Date(),
      currentStepId: nextStep.id,
      currentStepOrder: nextStep.order,
      completedStepIds: [firstStep.id],  // First step (registration) is completed
      stepProgress,
      lastAccessedAt: new Date(),
      stepUnlocks,
      sessionToken,
      status: FunnelParticipantStatus.REGISTERED,
      source: input.source || {},
      emailConsent: input.emailConsent ?? true,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      timezone: input.timezone,
    });

    await participant.save();

    // Create or update lead
    await this.createOrUpdateLead(funnel, participant, input);

    // Update funnel metrics
    funnel.metrics.totalLeads += 1;
    await funnel.save();

    logger.info(`Participant registered for funnel: ${funnel.name} - Email: ${input.email}`);

    return {
      participant,
      sessionToken,
      nextStepId: nextStep.id,
    };
  }

  /**
   * Get participant by session token or email
   */
  async getParticipant(slug: string, identifier: { sessionToken?: string; email?: string }): Promise<IFunnelParticipant | null> {
    if (identifier.sessionToken) {
      return FunnelParticipant.findByFunnelSlugAndSession(slug, identifier.sessionToken);
    }
    if (identifier.email) {
      return FunnelParticipant.findByFunnelSlugAndEmail(slug, identifier.email);
    }
    return null;
  }

  /**
   * Get public funnel with access control information
   */
  async getPublicFunnelWithAccess(
    slug: string,
    identifier?: { sessionToken?: string; email?: string }
  ): Promise<PublicFunnelWithAccess> {
    // Find the funnel
    const funnel = await Funnel.findOne({
      slug: slug.toLowerCase(),
      status: FunnelStatus.PUBLISHED,
    });

    if (!funnel) {
      throw ApiError.notFound('Funnel not found or not published');
    }

    // Get participant if identifier provided
    let participant: IFunnelParticipant | null = null;
    if (identifier?.sessionToken || identifier?.email) {
      participant = await this.getParticipant(slug, identifier);
    }

    // Sort steps by order
    const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);

    // Build steps with access information
    const stepsWithAccess = sortedSteps.map((step, index) => {
      // Determine accessibility
      let isAccessible = false;
      let isCompleted = false;

      if (participant === null) {
        // Not registered - only first step (optin) is accessible
        isAccessible = index === 0;
      } else {
        // Registered - check participant progress
        isCompleted = participant.completedStepIds.includes(step.id);
        isAccessible = participant.canAccessStep(step.id, step.order);
      }

      return {
        id: step.id,
        name: step.name,
        type: step.type,
        order: step.order,
        isAccessible,
        isCompleted,
        // Only include pageContent if step is accessible
        pageContent: isAccessible ? step.pageContent : undefined,
        // Include settings for step behavior (timer, button delay, auto-play, etc.)
        settings: isAccessible ? step.settings : undefined,
        // Include webinar settings if applicable
        webinarSettings: isAccessible ? step.webinarSettings : undefined,
      };
    });

    // Update visitor count and last accessed
    funnel.metrics.totalVisitors += 1;
    await funnel.save();

    if (participant) {
      participant.lastAccessedAt = new Date();
      await participant.save();
    }

    return {
      funnel: {
        id: funnel._id.toString(),
        name: funnel.name,
        slug: funnel.slug,
        description: funnel.description,
        type: funnel.type,
        design: funnel.design,
        settings: {
          deliveryMode: funnel.settings.deliveryMode,
        },
      },
      steps: stepsWithAccess,
      registration: {
        isRegistered: !!participant,
        sessionToken: participant?.sessionToken,
        currentStepId: participant?.currentStepId,
        currentStepOrder: participant?.currentStepOrder,
        completedStepIds: participant?.completedStepIds,
      },
    };
  }

  /**
   * Complete a step
   */
  async completeStep(
    slug: string,
    stepId: string,
    identifier: { sessionToken?: string; email?: string },
    data?: { videoWatchPercent?: number; timeSpentSeconds?: number }
  ): Promise<{
    success: boolean;
    nextStepId?: string;
    isCompleted: boolean;
  }> {
    const participant = await this.getParticipant(slug, identifier);
    if (!participant) {
      throw ApiError.unauthorized('Not registered for this funnel');
    }

    // Find funnel to get steps
    const funnel = await Funnel.findOne({ slug: slug.toLowerCase() });
    if (!funnel) {
      throw ApiError.notFound('Funnel not found');
    }

    // Find the step
    const step = funnel.steps.find(s => s.id === stepId);
    if (!step) {
      throw ApiError.notFound('Step not found');
    }

    // Check if step is accessible
    if (!participant.canAccessStep(stepId, step.order)) {
      throw ApiError.forbidden('Step is not accessible');
    }

    // Mark step as completed
    participant.completeStep(stepId);

    // Update step progress with additional data
    const progress = participant.stepProgress.find(p => p.stepId === stepId);
    if (progress && data) {
      if (data.videoWatchPercent !== undefined) {
        progress.videoWatchPercent = data.videoWatchPercent;
      }
      if (data.timeSpentSeconds !== undefined) {
        progress.timeSpentSeconds = data.timeSpentSeconds;
      }
    }

    // Find next step
    const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);
    const currentIndex = sortedSteps.findIndex(s => s.id === stepId);
    const nextStep = currentIndex < sortedSteps.length - 1 ? sortedSteps[currentIndex + 1] : null;

    if (nextStep) {
      // Update current step
      participant.currentStepId = nextStep.id;
      participant.currentStepOrder = nextStep.order;

      // Unlock next step
      const nextProgress = participant.stepProgress.find(p => p.stepId === nextStep.id);
      if (nextProgress && nextProgress.status === 'locked') {
        nextProgress.status = 'unlocked';
        nextProgress.unlockedAt = new Date();
      }
    } else {
      // All steps completed
      participant.status = FunnelParticipantStatus.COMPLETED;
      participant.completedAt = new Date();
    }

    participant.lastAccessedAt = new Date();
    await participant.save();

    // Update funnel metrics if completed
    if (participant.status === FunnelParticipantStatus.COMPLETED) {
      funnel.metrics.totalConversions += 1;
      funnel.metrics.conversionRate = funnel.metrics.totalLeads > 0
        ? (funnel.metrics.totalConversions / funnel.metrics.totalLeads) * 100
        : 0;
      await funnel.save();
    }

    logger.info(`Step completed: ${funnel.name} - Step: ${step.name} - Email: ${participant.email}`);

    return {
      success: true,
      nextStepId: nextStep?.id,
      isCompleted: participant.status === FunnelParticipantStatus.COMPLETED,
    };
  }

  /**
   * Get step content (with access check)
   */
  async getStepContent(
    slug: string,
    stepId: string,
    identifier?: { sessionToken?: string; email?: string }
  ): Promise<{
    step: any;
    isAccessible: boolean;
  }> {
    const funnel = await Funnel.findOne({
      slug: slug.toLowerCase(),
      status: FunnelStatus.PUBLISHED,
    });

    if (!funnel) {
      throw ApiError.notFound('Funnel not found');
    }

    const step = funnel.steps.find(s => s.id === stepId);
    if (!step) {
      throw ApiError.notFound('Step not found');
    }

    // Get participant
    let participant: IFunnelParticipant | null = null;
    if (identifier?.sessionToken || identifier?.email) {
      participant = await this.getParticipant(slug, identifier);
    }

    // Determine if accessible
    const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);
    const stepIndex = sortedSteps.findIndex(s => s.id === stepId);

    let isAccessible = false;
    if (!participant) {
      // Not registered - only first step is accessible
      isAccessible = stepIndex === 0;
    } else {
      isAccessible = participant.canAccessStep(stepId, step.order);
    }

    return {
      step: {
        id: step.id,
        name: step.name,
        type: step.type,
        order: step.order,
        pageContent: isAccessible ? step.pageContent : undefined,
        settings: step.settings,
      },
      isAccessible,
    };
  }

  /**
   * Calculate step unlocks based on delivery mode
   */
  private calculateStepUnlocks(funnel: IFunnel, registrationDate: Date): Record<string, Date> {
    const unlocks: Record<string, Date> = {};
    const sortedSteps = [...funnel.steps].sort((a, b) => a.order - b.order);

    const deliveryMode = funnel.settings.deliveryMode || DeliveryMode.ALL_AT_ONCE;

    sortedSteps.forEach((step, index) => {
      if (index === 0) {
        // First step is always immediately accessible
        unlocks[step.id] = registrationDate;
      } else if (deliveryMode === DeliveryMode.ALL_AT_ONCE) {
        // All steps accessible immediately after registration
        unlocks[step.id] = registrationDate;
      } else if (deliveryMode === DeliveryMode.TIME_BASED) {
        // Time-based unlock (use step's delayHours or default to 24h per step)
        const delayHours = step.conditions?.delayHours || (index * 24);
        const unlockDate = new Date(registrationDate);
        unlockDate.setHours(unlockDate.getHours() + delayHours);
        unlocks[step.id] = unlockDate;
      } else if (deliveryMode === DeliveryMode.DRIP_FED) {
        // Drip-fed: requires previous step completion
        // Don't set unlock date - will be unlocked when previous completes
      }
    });

    return unlocks;
  }

  /**
   * Create or update lead from registration
   */
  private async createOrUpdateLead(
    funnel: IFunnel,
    participant: IFunnelParticipant,
    input: RegisterInput
  ): Promise<void> {
    try {
      let lead = await Lead.findOne({ email: participant.email });

      if (lead) {
        // Update existing lead
        lead.firstName = input.firstName || lead.firstName;
        lead.lastName = input.lastName || lead.lastName;
        lead.phone = input.phone || lead.phone;
        lead.lastActivityAt = new Date();
        // Add activity to history if the property exists
        if ((lead as any).activityHistory) {
          (lead as any).activityHistory.push({
            type: 'funnel_registration',
            timestamp: new Date(),
            metadata: {
              funnelId: funnel._id.toString(),
              funnelName: funnel.name,
            },
          });
        }

        await lead.save();
        participant.leadId = lead._id;
        await participant.save();
      } else {
        // Create new lead
        lead = new Lead({
          email: participant.email,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          source: {
            type: LeadSource.FUNNEL,
            funnelId: funnel._id.toString(),
            funnelName: funnel.name,
            utmSource: input.source?.utmSource,
            utmMedium: input.source?.utmMedium,
            utmCampaign: input.source?.utmCampaign,
            utmContent: input.source?.utmContent,
            utmTerm: input.source?.utmTerm,
            referralCode: input.source?.referralCode,
          },
          status: LeadStatus.NEW,
          emailConsent: input.emailConsent ?? true,
          activityHistory: [{
            type: 'created',
            timestamp: new Date(),
            metadata: {
              source: 'funnel_registration',
              funnelId: funnel._id.toString(),
            },
          }] as any,
        });

        await lead.save();
        participant.leadId = lead._id;
        await participant.save();
      }
    } catch (error) {
      // Don't fail registration if lead creation fails
      logger.error('Failed to create/update lead:', error);
    }
  }

  /**
   * Get funnel participant stats
   */
  async getFunnelStats(funnelId: string): Promise<{
    totalParticipants: number;
    registeredCount: number;
    inProgressCount: number;
    completedCount: number;
    convertedCount: number;
    droppedCount: number;
  }> {
    const stats = await FunnelParticipant.aggregate([
      { $match: { funnelId: funnelId } },
      {
        $group: {
          _id: null,
          totalParticipants: { $sum: 1 },
          registeredCount: {
            $sum: { $cond: [{ $eq: ['$status', FunnelParticipantStatus.REGISTERED] }, 1, 0] },
          },
          inProgressCount: {
            $sum: { $cond: [{ $eq: ['$status', FunnelParticipantStatus.IN_PROGRESS] }, 1, 0] },
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', FunnelParticipantStatus.COMPLETED] }, 1, 0] },
          },
          convertedCount: {
            $sum: { $cond: [{ $eq: ['$status', FunnelParticipantStatus.CONVERTED] }, 1, 0] },
          },
          droppedCount: {
            $sum: { $cond: [{ $eq: ['$status', FunnelParticipantStatus.DROPPED] }, 1, 0] },
          },
        },
      },
    ]);

    return stats[0] || {
      totalParticipants: 0,
      registeredCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      convertedCount: 0,
      droppedCount: 0,
    };
  }
}

export const funnelParticipantService = new FunnelParticipantService();
export default funnelParticipantService;
