import { Funnel, IFunnel, FunnelStatus, FunnelType, DeliveryMode } from '../models';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

/**
 * Input types for Funnel operations
 */
export interface CreateFunnelInput {
  name: string;
  slug?: string;
  description?: string;
  type: FunnelType;
  settings?: {
    deliveryMode?: DeliveryMode;
    accessDurationDays?: number;
    emailSequenceId?: string;
    trackingPixelId?: string;
    customDomain?: string;
  };
  design?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  tags?: string[];
  createdBy: string;
}

export interface UpdateFunnelInput {
  name?: string;
  slug?: string;
  description?: string;
  type?: FunnelType;
  settings?: {
    deliveryMode?: DeliveryMode;
    accessDurationDays?: number;
    emailSequenceId?: string;
    trackingPixelId?: string;
    customDomain?: string;
  };
  design?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  tags?: string[];
  updatedBy: string;
}

export interface FunnelStepInput {
  id?: string;  // Auto-generated if not provided
  name: string;
  type: string;
  landingPageId?: string;  // Optional - can be linked later
  order?: number;  // Auto-calculated if not provided
  pageContent?: {
    headline?: string;
    subheadline?: string;
    description?: string;
    ctaText?: string;
    ctaUrl?: string;
    imageUrl?: string;
    videoUrl?: string;
    formFields?: any[];
    testimonials?: any[];
    features?: any[];
    productInfo?: any;
  };
  conditions?: {
    afterStepId?: string;
    delayHours?: number;
    requiresCompletion?: boolean;
    showOnDays?: number[];
  };
  settings?: {
    isRequired?: boolean;
    trackCompletion?: boolean;
    emailOnComplete?: string;
    redirectOnComplete?: string;
    showCountdownTimer?: boolean;
    timerDuration?: number;
    timerRedirectUrl?: string;
    showExitPopup?: boolean;
    exitPopupDelay?: number;
    facebookPixelEvent?: string;
    googleAnalyticsEvent?: string;
    customTrackingCode?: string;
  };
}

export interface ListFunnelsOptions {
  page?: number;
  limit?: number;
  status?: FunnelStatus;
  type?: FunnelType;
  search?: string;
  tags?: string[];
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
 * Funnel Service - Business logic for funnel operations
 */
class FunnelService {
  /**
   * Create a new funnel
   */
  async create(input: CreateFunnelInput): Promise<IFunnel> {
    try {
      const funnel = new Funnel({
        name: input.name,
        slug: input.slug,
        description: input.description,
        type: input.type,
        status: FunnelStatus.DRAFT,
        settings: {
          deliveryMode: input.settings?.deliveryMode || DeliveryMode.TIME_BASED,
          accessDurationDays: input.settings?.accessDurationDays,
          emailSequenceId: input.settings?.emailSequenceId,
          trackingPixelId: input.settings?.trackingPixelId,
          customDomain: input.settings?.customDomain,
        },
        design: input.design || {},
        tags: input.tags || [],
        steps: [],
        metrics: {
          totalVisitors: 0,
          uniqueVisitors: 0,
          totalLeads: 0,
          totalConversions: 0,
          totalRevenue: 0,
          conversionRate: 0,
          averageOrderValue: 0,
        },
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      });

      await funnel.save();
      logger.info(`Funnel created: ${funnel.name} (${funnel.id})`);
      return funnel;
    } catch (error: any) {
      logger.error('Error creating funnel:', error);
      if (error.code === 11000) {
        throw ApiError.conflict('A funnel with this slug already exists');
      }
      throw error;
    }
  }

  /**
   * Get funnel by ID
   */
  async getById(id: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    return funnel;
  }

  /**
   * Get funnel by slug
   */
  async getBySlug(slug: string): Promise<IFunnel | null> {
    const funnel = await Funnel.findOne({ slug: slug.toLowerCase() });
    return funnel;
  }

  /**
   * Get published funnel by slug (for public access)
   */
  async getPublishedBySlug(slug: string): Promise<IFunnel | null> {
    const funnel = await Funnel.findOne({
      slug: slug.toLowerCase(),
      status: FunnelStatus.PUBLISHED,
    });

    if (funnel) {
      // Increment visitor count
      funnel.metrics.totalVisitors += 1;
      await funnel.save();
    }

    return funnel;
  }

  /**
   * List funnels with pagination and filtering
   */
  async list(options: ListFunnelsOptions = {}): Promise<PaginatedResult<IFunnel>> {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      search,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      createdBy,
    } = options;

    // Build query
    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    if (createdBy) {
      query.createdBy = createdBy;
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [funnels, total] = await Promise.all([
      Funnel.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Funnel.countDocuments(query),
    ]);

    return {
      data: funnels as IFunnel[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update funnel
   */
  async update(id: string, input: UpdateFunnelInput): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    // Update fields
    if (input.name !== undefined) funnel.name = input.name;
    if (input.slug !== undefined) funnel.slug = input.slug;
    if (input.description !== undefined) funnel.description = input.description;
    if (input.type !== undefined) funnel.type = input.type;
    if (input.tags !== undefined) funnel.tags = input.tags;

    // Update settings
    if (input.settings) {
      funnel.settings = {
        ...funnel.settings,
        ...input.settings,
      };
    }

    // Update design
    if (input.design) {
      funnel.design = {
        ...funnel.design,
        ...input.design,
      };
    }

    funnel.updatedBy = input.updatedBy;

    await funnel.save();
    logger.info(`Funnel updated: ${funnel.name} (${funnel.id})`);
    return funnel;
  }

  /**
   * Delete funnel
   */
  async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const result = await Funnel.findByIdAndDelete(id);
    if (result) {
      logger.info(`Funnel deleted: ${result.name} (${id})`);
      return true;
    }
    return false;
  }

  /**
   * Publish funnel
   */
  async publish(id: string, updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    // Validate funnel has at least one step
    if (funnel.steps.length === 0) {
      throw ApiError.badRequest('Cannot publish funnel without any steps');
    }

    funnel.status = FunnelStatus.PUBLISHED;
    funnel.publishedAt = new Date();
    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Funnel published: ${funnel.name} (${funnel.id})`);
    return funnel;
  }

  /**
   * Unpublish (pause) funnel
   */
  async unpublish(id: string, updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    funnel.status = FunnelStatus.PAUSED;
    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Funnel paused: ${funnel.name} (${funnel.id})`);
    return funnel;
  }

  /**
   * Archive funnel
   */
  async archive(id: string, updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    funnel.status = FunnelStatus.ARCHIVED;
    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Funnel archived: ${funnel.name} (${funnel.id})`);
    return funnel;
  }

  /**
   * Duplicate funnel
   */
  async duplicate(id: string, createdBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const original = await Funnel.findById(id);
    if (!original) {
      return null;
    }

    const duplicate = new Funnel({
      name: `${original.name} (Copy)`,
      description: original.description,
      type: original.type,
      status: FunnelStatus.DRAFT,
      steps: original.steps.map(step => ({
        ...step,
        id: new mongoose.Types.ObjectId().toString(),
      })),
      settings: original.settings,
      design: original.design,
      tags: original.tags,
      metrics: {
        totalVisitors: 0,
        uniqueVisitors: 0,
        totalLeads: 0,
        totalConversions: 0,
        totalRevenue: 0,
        conversionRate: 0,
        averageOrderValue: 0,
      },
      createdBy,
      updatedBy: createdBy,
    });

    await duplicate.save();
    logger.info(`Funnel duplicated: ${original.name} -> ${duplicate.name} (${duplicate.id})`);
    return duplicate;
  }

  /**
   * Update funnel steps
   */
  async updateSteps(id: string, steps: FunnelStepInput[], updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    // Validate step order is sequential
    const sortedSteps = [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (let i = 0; i < sortedSteps.length; i++) {
      if (sortedSteps[i].order !== i) {
        throw ApiError.badRequest('Step order must be sequential starting from 0');
      }
    }

    funnel.steps = steps as any;
    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Funnel steps updated: ${funnel.name} (${funnel.id}) - ${steps.length} steps`);
    return funnel;
  }

  /**
   * Add a step to funnel
   */
  async addStep(id: string, step: FunnelStepInput, updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    // Set order to end of list if not specified
    if (step.order === undefined || step.order === null) {
      step.order = funnel.steps.length;
    }

    // Insert step at correct position and reorder
    funnel.steps.splice(step.order, 0, step as any);

    // Reindex orders
    funnel.steps.forEach((s, index) => {
      s.order = index;
    });

    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Step added to funnel: ${funnel.name} (${funnel.id}) - Step: ${step.name}`);
    return funnel;
  }

  /**
   * Remove a step from funnel
   */
  async removeStep(id: string, stepId: string, updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    const stepIndex = funnel.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw ApiError.notFound('Step not found in funnel');
    }

    funnel.steps.splice(stepIndex, 1);

    // Reindex orders
    funnel.steps.forEach((s, index) => {
      s.order = index;
    });

    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Step removed from funnel: ${funnel.name} (${funnel.id}) - Step ID: ${stepId}`);
    return funnel;
  }

  /**
   * Update a single step in funnel
   */
  async updateStep(id: string, stepId: string, stepData: Partial<FunnelStepInput>, updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    const stepIndex = funnel.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw ApiError.notFound('Step not found in funnel');
    }

    // Update step properties
    const existingStep = funnel.steps[stepIndex];
    if (stepData.name !== undefined) existingStep.name = stepData.name;
    if (stepData.type !== undefined) existingStep.type = stepData.type as any;
    if (stepData.landingPageId !== undefined) existingStep.landingPageId = stepData.landingPageId;
    if (stepData.pageContent !== undefined) {
      existingStep.pageContent = {
        ...existingStep.pageContent,
        ...stepData.pageContent,
      };
    }
    if (stepData.conditions !== undefined) {
      existingStep.conditions = {
        ...existingStep.conditions,
        ...stepData.conditions,
      };
    }
    if (stepData.settings !== undefined) {
      existingStep.settings = {
        ...existingStep.settings,
        ...stepData.settings,
      };
    }

    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Step updated in funnel: ${funnel.name} (${funnel.id}) - Step ID: ${stepId}`);
    return funnel;
  }

  /**
   * Reorder steps
   */
  async reorderSteps(id: string, stepIds: string[], updatedBy: string): Promise<IFunnel | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    // Validate all step IDs exist
    const existingIds = funnel.steps.map(s => s.id);
    for (const stepId of stepIds) {
      if (!existingIds.includes(stepId)) {
        throw ApiError.badRequest(`Step ID not found: ${stepId}`);
      }
    }

    // Reorder steps based on provided order
    const reorderedSteps = stepIds.map((stepId, index) => {
      const step = funnel.steps.find(s => s.id === stepId)!;
      return { ...step, order: index };
    });

    funnel.steps = reorderedSteps as any;
    funnel.updatedBy = updatedBy;

    await funnel.save();
    logger.info(`Funnel steps reordered: ${funnel.name} (${funnel.id})`);
    return funnel;
  }

  /**
   * Get funnel analytics
   */
  async getAnalytics(id: string): Promise<{
    metrics: IFunnel['metrics'];
    stepAnalytics: { stepId: string; views: number; completions: number; conversionRate: number }[];
  } | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid funnel ID');
    }

    const funnel = await Funnel.findById(id);
    if (!funnel) {
      return null;
    }

    // Calculate step analytics (placeholder - will be populated from ConversionEvents)
    const stepAnalytics = funnel.steps.map(step => ({
      stepId: step.id,
      views: 0,
      completions: 0,
      conversionRate: 0,
    }));

    return {
      metrics: funnel.metrics,
      stepAnalytics,
    };
  }

  /**
   * Get funnels by type
   */
  async getByType(type: FunnelType): Promise<IFunnel[]> {
    return Funnel.find({ type }).sort({ createdAt: -1 });
  }

  /**
   * Get published funnels
   */
  async getPublished(): Promise<IFunnel[]> {
    return Funnel.find({ status: FunnelStatus.PUBLISHED }).sort({ createdAt: -1 });
  }

  /**
   * Search funnels
   */
  async search(query: string, limit: number = 10): Promise<IFunnel[]> {
    return Funnel.find({
      $text: { $search: query },
    })
      .limit(limit)
      .sort({ score: { $meta: 'textScore' } });
  }
}

export const funnelService = new FunnelService();
export default funnelService;
