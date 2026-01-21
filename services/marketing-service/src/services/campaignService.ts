import mongoose, { FilterQuery } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  EmailCampaign,
  IEmailCampaign,
  CampaignStatus,
  CampaignType,
  ISegmentCondition,
} from '../models/EmailCampaign';
import { Lead, ILead, LeadStatus } from '../models/Lead';
import { EmailTemplate } from '../models/EmailTemplate';
import emailService from './emailService';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Campaign creation input
 */
interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  templateId: string;
  subject: string;
  preheader?: string;
  fromName?: string;
  fromEmail: string;
  replyTo?: string;
  audience: {
    type: 'all' | 'segment' | 'list' | 'tag';
    segmentId?: string;
    segmentConditions?: ISegmentCondition[];
    listId?: string;
    tags?: string[];
    excludeTags?: string[];
    excludeUnsubscribed?: boolean;
    excludeBounced?: boolean;
  };
  scheduling?: {
    sendAt?: Date;
    timezone?: string;
    sendInRecipientTimezone?: boolean;
    optimalSendTime?: boolean;
  };
  abTest?: {
    enabled: boolean;
    winnerCriteria?: 'open_rate' | 'click_rate';
    testDuration?: number;
    testPercentage?: number;
    variants?: Array<{
      name: string;
      templateId: string;
      subject?: string;
      weight: number;
    }>;
  };
  templateContext?: Record<string, any>;
  tags?: string[];
  createdBy: string;
}

/**
 * Campaign update input
 */
interface UpdateCampaignInput {
  name?: string;
  description?: string;
  type?: CampaignType;
  templateId?: string;
  subject?: string;
  preheader?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  audience?: {
    type?: 'all' | 'segment' | 'list' | 'tag';
    segmentId?: string;
    segmentConditions?: ISegmentCondition[];
    listId?: string;
    tags?: string[];
    excludeTags?: string[];
    excludeUnsubscribed?: boolean;
    excludeBounced?: boolean;
  };
  scheduling?: {
    sendAt?: Date;
    timezone?: string;
    sendInRecipientTimezone?: boolean;
    optimalSendTime?: boolean;
  };
  abTest?: {
    enabled?: boolean;
    winnerCriteria?: 'open_rate' | 'click_rate';
    testDuration?: number;
    testPercentage?: number;
    variants?: Array<{
      name: string;
      templateId: string;
      subject?: string;
      weight: number;
    }>;
  };
  templateContext?: Record<string, any>;
  tags?: string[];
  updatedBy: string;
}

/**
 * Campaign list options
 */
interface ListCampaignsOptions {
  status?: CampaignStatus;
  type?: CampaignType;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Campaign Service - Handles email campaign management
 */
class CampaignService {
  /**
   * Create a new email campaign
   */
  async createCampaign(input: CreateCampaignInput): Promise<IEmailCampaign> {
    // Validate template exists
    const template = await EmailTemplate.findById(input.templateId);
    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    // Prepare A/B test variants if enabled
    let abTestConfig = undefined;
    if (input.abTest?.enabled && input.abTest.variants && input.abTest.variants.length > 0) {
      abTestConfig = {
        enabled: true,
        winnerCriteria: input.abTest.winnerCriteria || 'open_rate',
        testDuration: input.abTest.testDuration || 4,
        testPercentage: input.abTest.testPercentage || 20,
        variants: input.abTest.variants.map((v) => ({
          id: uuidv4(),
          name: v.name,
          templateId: v.templateId,
          subject: v.subject,
          weight: v.weight,
          metrics: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            unsubscribed: 0,
            openRate: 0,
            clickRate: 0,
          },
        })),
      };
    }

    const campaign = new EmailCampaign({
      name: input.name,
      description: input.description,
      type: input.type,
      status: CampaignStatus.DRAFT,
      templateId: input.templateId,
      subject: input.subject,
      preheader: input.preheader,
      fromName: input.fromName || 'CloudMasters Hub',
      fromEmail: input.fromEmail,
      replyTo: input.replyTo,
      audience: {
        type: input.audience.type,
        segmentConditions: input.audience.segmentConditions,
        listId: input.audience.listId,
        tags: input.audience.tags,
        excludeTags: input.audience.excludeTags,
        excludeUnsubscribed: input.audience.excludeUnsubscribed ?? true,
        excludeBounced: input.audience.excludeBounced ?? true,
      },
      scheduling: {
        sendAt: input.scheduling?.sendAt,
        timezone: input.scheduling?.timezone || 'America/New_York',
        sendInRecipientTimezone: input.scheduling?.sendInRecipientTimezone || false,
        optimalSendTime: input.scheduling?.optimalSendTime || false,
      },
      abTest: abTestConfig,
      templateContext: input.templateContext,
      tags: input.tags,
      metrics: {
        totalRecipients: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        complained: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        unsubscribeRate: 0,
      },
      progress: {
        processedCount: 0,
        errorCount: 0,
      },
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });

    // Calculate estimated audience size
    const estimatedCount = await this.calculateAudienceSize(campaign);
    campaign.audience.estimatedCount = estimatedCount;

    await campaign.save();
    logger.info(`Campaign created: ${campaign.name} (${campaign.id})`);
    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(id: string): Promise<IEmailCampaign | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }
    return EmailCampaign.findById(id);
  }

  /**
   * Update campaign
   */
  async updateCampaign(id: string, input: UpdateCampaignInput): Promise<IEmailCampaign | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      return null;
    }

    // Only allow updates to draft campaigns
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw ApiError.badRequest('Can only update draft campaigns');
    }

    // Build update object
    const updateData: any = { updatedBy: input.updatedBy };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.templateId !== undefined) {
      // Validate template exists
      const template = await EmailTemplate.findById(input.templateId);
      if (!template) {
        throw ApiError.notFound('Email template not found');
      }
      updateData.templateId = input.templateId;
    }
    if (input.subject !== undefined) updateData.subject = input.subject;
    if (input.preheader !== undefined) updateData.preheader = input.preheader;
    if (input.fromName !== undefined) updateData.fromName = input.fromName;
    if (input.fromEmail !== undefined) updateData.fromEmail = input.fromEmail;
    if (input.replyTo !== undefined) updateData.replyTo = input.replyTo;
    if (input.audience !== undefined) {
      updateData.audience = { ...campaign.audience, ...input.audience };
    }
    if (input.scheduling !== undefined) {
      updateData.scheduling = { ...campaign.scheduling, ...input.scheduling };
    }
    if (input.templateContext !== undefined) updateData.templateContext = input.templateContext;
    if (input.tags !== undefined) updateData.tags = input.tags;

    const updated = await EmailCampaign.findByIdAndUpdate(id, updateData, { new: true });

    // Recalculate audience size if audience changed
    if (input.audience && updated) {
      const estimatedCount = await this.calculateAudienceSize(updated);
      updated.audience.estimatedCount = estimatedCount;
      await updated.save();
    }

    if (updated) {
      logger.info(`Campaign updated: ${updated.name} (${updated.id})`);
    }
    return updated;
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      return false;
    }

    // Only allow deletion of draft campaigns
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw ApiError.badRequest('Can only delete draft campaigns');
    }

    await EmailCampaign.findByIdAndDelete(id);
    logger.info(`Campaign deleted: ${campaign.name} (${id})`);
    return true;
  }

  /**
   * List campaigns with filtering and pagination
   */
  async listCampaigns(options: ListCampaignsOptions = {}): Promise<{ data: IEmailCampaign[]; total: number }> {
    const {
      status,
      type,
      search,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const query: FilterQuery<IEmailCampaign> = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (tags && tags.length > 0) query.tags = { $in: tags };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: any = { [sortBy]: sortDirection };

    const [rawData, total] = await Promise.all([
      EmailCampaign.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailCampaign.countDocuments(query),
    ]);

    // Transform _id to id for lean results (since toJSON transform is bypassed by .lean())
    const data = rawData.map((campaign: any) => ({
      ...campaign,
      id: campaign._id.toString(),
    }));

    return { data: data as IEmailCampaign[], total };
  }

  /**
   * Schedule campaign for future sending
   */
  async scheduleCampaign(id: string, sendAt: Date, updatedBy: string): Promise<IEmailCampaign> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw ApiError.badRequest('Can only schedule draft campaigns');
    }

    if (sendAt <= new Date()) {
      throw ApiError.badRequest('Scheduled time must be in the future');
    }

    campaign.status = CampaignStatus.SCHEDULED;
    campaign.scheduling.sendAt = sendAt;
    campaign.updatedBy = updatedBy;
    await campaign.save();

    logger.info(`Campaign scheduled: ${campaign.name} for ${sendAt.toISOString()}`);
    return campaign;
  }

  /**
   * Send campaign immediately
   */
  async sendCampaign(id: string, updatedBy: string): Promise<{ success: boolean; jobId?: string; recipientCount?: number }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
      throw ApiError.badRequest('Campaign cannot be sent in current status');
    }

    // Get recipients
    const recipients = await this.getRecipients(campaign);
    if (recipients.length === 0) {
      throw ApiError.badRequest('No recipients match the campaign audience criteria');
    }

    // Update campaign status
    campaign.status = CampaignStatus.SENDING;
    campaign.progress.startedAt = new Date();
    campaign.metrics.totalRecipients = recipients.length;
    campaign.updatedBy = updatedBy;
    await campaign.save();

    // Send emails in background
    const jobId = uuidv4();
    this.processCampaignSend(campaign, recipients, jobId).catch((error) => {
      logger.error(`Campaign send error: ${error.message}`, { campaignId: id, jobId });
    });

    logger.info(`Campaign send started: ${campaign.name} (${id}) to ${recipients.length} recipients`);
    return { success: true, jobId, recipientCount: recipients.length };
  }

  /**
   * Pause sending campaign
   */
  async pauseCampaign(id: string, updatedBy: string): Promise<IEmailCampaign> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.SENDING) {
      throw ApiError.badRequest('Can only pause campaigns that are currently sending');
    }

    campaign.status = CampaignStatus.PAUSED;
    campaign.updatedBy = updatedBy;
    await campaign.save();

    logger.info(`Campaign paused: ${campaign.name} (${id})`);
    return campaign;
  }

  /**
   * Cancel campaign
   */
  async cancelCampaign(id: string, updatedBy: string): Promise<IEmailCampaign> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found');
    }

    if (campaign.status === CampaignStatus.SENT || campaign.status === CampaignStatus.CANCELLED) {
      throw ApiError.badRequest('Cannot cancel completed or already cancelled campaigns');
    }

    campaign.status = CampaignStatus.CANCELLED;
    campaign.updatedBy = updatedBy;
    await campaign.save();

    logger.info(`Campaign cancelled: ${campaign.name} (${id})`);
    return campaign;
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(id: string): Promise<{
    overview: IEmailCampaign['metrics'];
    progress: IEmailCampaign['progress'];
    variants?: IEmailCampaign['abTest'];
  }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found');
    }

    return {
      overview: campaign.metrics,
      progress: campaign.progress,
      variants: campaign.abTest,
    };
  }

  /**
   * Preview campaign with sample data
   */
  async previewCampaign(id: string, context?: Record<string, any>): Promise<{ subject: string; html: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const campaign = await EmailCampaign.findById(id);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found');
    }

    const template = await EmailTemplate.findById(campaign.templateId);
    if (!template) {
      throw ApiError.notFound('Campaign template not found');
    }

    // Compile template with sample/provided context
    const Handlebars = await import('handlebars');
    const sampleContext = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      currentYear: new Date().getFullYear(),
      unsubscribeLink: '#',
      ...campaign.templateContext,
      ...context,
    };

    const compiledSubject = Handlebars.compile(campaign.subject);
    const compiledHtml = Handlebars.compile(template.htmlContent);

    return {
      subject: compiledSubject(sampleContext),
      html: compiledHtml(sampleContext),
    };
  }

  /**
   * Duplicate campaign
   */
  async duplicateCampaign(id: string, createdBy: string): Promise<IEmailCampaign> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid campaign ID');
    }

    const original = await EmailCampaign.findById(id);
    if (!original) {
      throw ApiError.notFound('Campaign not found');
    }

    const duplicate = new EmailCampaign({
      name: `${original.name} (Copy)`,
      description: original.description,
      type: original.type,
      status: CampaignStatus.DRAFT,
      templateId: original.templateId,
      subject: original.subject,
      preheader: original.preheader,
      fromName: original.fromName,
      fromEmail: original.fromEmail,
      replyTo: original.replyTo,
      audience: original.audience,
      scheduling: {
        ...original.scheduling,
        sendAt: undefined, // Clear scheduled time
      },
      abTest: original.abTest
        ? {
            ...original.abTest,
            variants: original.abTest.variants?.map((v) => ({
              ...v,
              id: uuidv4(),
              metrics: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                bounced: 0,
                unsubscribed: 0,
                openRate: 0,
                clickRate: 0,
              },
            })),
          }
        : undefined,
      templateContext: original.templateContext,
      tags: original.tags,
      metrics: {
        totalRecipients: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        complained: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        unsubscribeRate: 0,
      },
      progress: {
        processedCount: 0,
        errorCount: 0,
      },
      createdBy,
      updatedBy: createdBy,
    });

    await duplicate.save();
    logger.info(`Campaign duplicated: ${duplicate.name} (${duplicate.id}) from ${id}`);
    return duplicate;
  }

  /**
   * Calculate audience size based on campaign criteria
   */
  private async calculateAudienceSize(campaign: IEmailCampaign): Promise<number> {
    const query = this.buildAudienceQuery(campaign);
    return Lead.countDocuments(query);
  }

  /**
   * Get recipients based on campaign audience criteria
   */
  private async getRecipients(campaign: IEmailCampaign): Promise<ILead[]> {
    const query = this.buildAudienceQuery(campaign);
    return Lead.find(query).lean() as Promise<ILead[]>;
  }

  /**
   * Build MongoDB query from audience criteria
   */
  private buildAudienceQuery(campaign: IEmailCampaign): FilterQuery<ILead> {
    const query: FilterQuery<ILead> = {};

    // Base filters - exclude unsubscribed and bounced if specified
    if (campaign.audience.excludeUnsubscribed) {
      query.status = { $ne: LeadStatus.UNSUBSCRIBED };
      query.emailConsent = true;
    }
    if (campaign.audience.excludeBounced) {
      if (query.status) {
        query.status = { $nin: [LeadStatus.UNSUBSCRIBED, LeadStatus.BOUNCED] };
      } else {
        query.status = { $ne: LeadStatus.BOUNCED };
      }
    }

    // Audience type specific filters
    switch (campaign.audience.type) {
      case 'all':
        // No additional filters
        break;

      case 'tag':
        if (campaign.audience.tags && campaign.audience.tags.length > 0) {
          query.tags = { $in: campaign.audience.tags };
        }
        break;

      case 'segment':
        // Apply segment conditions
        if (campaign.audience.segmentConditions && campaign.audience.segmentConditions.length > 0) {
          const conditionQueries = campaign.audience.segmentConditions.map((condition) =>
            this.buildConditionQuery(condition)
          );
          query.$and = conditionQueries;
        }
        break;

      case 'list':
        // List-based targeting (custom field or tag-based)
        if (campaign.audience.listId) {
          query['customFields.listId'] = campaign.audience.listId;
        }
        break;
    }

    // Exclude tags
    if (campaign.audience.excludeTags && campaign.audience.excludeTags.length > 0) {
      query.tags = query.tags
        ? { $and: [query.tags, { $nin: campaign.audience.excludeTags }] }
        : { $nin: campaign.audience.excludeTags };
    }

    return query;
  }

  /**
   * Build query from a single segment condition
   */
  private buildConditionQuery(condition: ISegmentCondition): FilterQuery<ILead> {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'equals':
        return { [field]: value };
      case 'not_equals':
        return { [field]: { $ne: value } };
      case 'contains':
        return { [field]: { $regex: value, $options: 'i' } };
      case 'not_contains':
        return { [field]: { $not: { $regex: value, $options: 'i' } } };
      case 'greater_than':
        return { [field]: { $gt: value } };
      case 'less_than':
        return { [field]: { $lt: value } };
      case 'in':
        return { [field]: { $in: Array.isArray(value) ? value : [value] } };
      case 'not_in':
        return { [field]: { $nin: Array.isArray(value) ? value : [value] } };
      case 'exists':
        return { [field]: { $exists: true, $ne: null } };
      case 'not_exists':
        return { [field]: { $exists: false } };
      case 'before':
        return { [field]: { $lt: new Date(value) } };
      case 'after':
        return { [field]: { $gt: new Date(value) } };
      default:
        return { [field]: value };
    }
  }

  /**
   * Process campaign sending in background
   */
  private async processCampaignSend(
    campaign: IEmailCampaign,
    recipients: ILead[],
    jobId: string
  ): Promise<void> {
    logger.info(`Processing campaign send: ${campaign.name} (${jobId})`);

    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      // Check if campaign was paused or cancelled
      const currentCampaign = await EmailCampaign.findById(campaign._id);
      if (!currentCampaign || currentCampaign.status === CampaignStatus.PAUSED || currentCampaign.status === CampaignStatus.CANCELLED) {
        logger.info(`Campaign send stopped: ${campaign.name} (${jobId}) - Status: ${currentCampaign?.status}`);
        break;
      }

      const batch = recipients.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (lead) => {
          try {
            await emailService.sendTemplatedEmail(campaign.templateId, lead.email, {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              ...campaign.templateContext,
            });
            successCount++;

            // Update lead email engagement
            lead.email_engagement = lead.email_engagement || {
              emailsReceived: 0,
              emailsOpened: 0,
              emailsClicked: 0,
              openRate: 0,
              clickRate: 0,
            };
            lead.email_engagement.emailsReceived++;
            lead.email_engagement.lastEmailReceivedAt = new Date();
            await Lead.findByIdAndUpdate(lead._id, {
              'email_engagement.emailsReceived': lead.email_engagement.emailsReceived,
              'email_engagement.lastEmailReceivedAt': new Date(),
            });
          } catch (error: any) {
            errorCount++;
            logger.error(`Failed to send email to ${lead.email}: ${error.message}`);
          }
        })
      );

      // Update campaign progress
      await EmailCampaign.findByIdAndUpdate(campaign._id, {
        'metrics.sent': successCount,
        'progress.processedCount': i + batch.length,
        'progress.errorCount': errorCount,
        'progress.lastProcessedAt': new Date(),
      });

      // Rate limiting - wait between batches
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Mark campaign as completed
    const finalCampaign = await EmailCampaign.findById(campaign._id);
    if (finalCampaign && finalCampaign.status === CampaignStatus.SENDING) {
      finalCampaign.status = CampaignStatus.SENT;
      finalCampaign.progress.completedAt = new Date();
      finalCampaign.metrics.sent = successCount;
      finalCampaign.progress.errorCount = errorCount;
      finalCampaign.updateRates();
      await finalCampaign.save();
    }

    logger.info(`Campaign send completed: ${campaign.name} (${jobId}) - Sent: ${successCount}, Errors: ${errorCount}`);
  }
}

export const campaignService = new CampaignService();
export default campaignService;
