import mongoose, { FilterQuery } from 'mongoose';
import { Lead, ILead, LeadStatus, LeadSource, LeadScoreLevel } from '../models/Lead';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Create lead input
 */
interface CreateLeadInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  source?: {
    type: LeadSource;
    funnelId?: string;
    landingPageId?: string;
    challengeId?: string;
    referralCode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
  };
  tags?: string[];
  emailConsent?: boolean;
  customFields?: Record<string, string | number | boolean>;
  ipAddress?: string;
  userAgent?: string;
  timezone?: string;
  country?: string;
  city?: string;
}

/**
 * Update lead input
 */
interface UpdateLeadInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  status?: LeadStatus;
  score?: number;
  tags?: string[];
  emailConsent?: boolean;
  customFields?: Record<string, string | number | boolean>;
  country?: string;
  city?: string;
  timezone?: string;
}

/**
 * List leads options
 */
interface ListLeadsOptions {
  status?: LeadStatus;
  scoreLevel?: LeadScoreLevel;
  source?: LeadSource;
  tags?: string[];
  search?: string;
  emailConsent?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Bulk operation input
 */
interface BulkUpdateInput {
  leadIds: string[];
  updates: {
    status?: LeadStatus;
    addTags?: string[];
    removeTags?: string[];
    score?: number;
  };
}

/**
 * Lead Service - Handles lead management
 */
class LeadService {
  /**
   * Create a new lead
   */
  async createLead(input: CreateLeadInput): Promise<ILead> {
    // Check for existing lead with same email
    const existing = await Lead.findByEmail(input.email);
    if (existing) {
      throw ApiError.badRequest('A lead with this email already exists');
    }

    const lead = new Lead({
      email: input.email.toLowerCase().trim(),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      company: input.company,
      jobTitle: input.jobTitle,
      source: input.source || { type: LeadSource.DIRECT },
      tags: input.tags || [],
      emailConsent: input.emailConsent !== undefined ? input.emailConsent : true,
      emailConsentAt: input.emailConsent !== false ? new Date() : undefined,
      customFields: input.customFields,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      timezone: input.timezone,
      country: input.country,
      city: input.city,
      capturedAt: new Date(),
      status: LeadStatus.NEW,
      score: 0,
      scoreLevel: LeadScoreLevel.COLD,
      statusHistory: [{
        status: LeadStatus.NEW,
        timestamp: new Date(),
        reason: 'Lead created',
      }],
    });

    await lead.save();
    logger.info(`Lead created: ${lead.email} (${lead.id})`);
    return lead;
  }

  /**
   * Get lead by ID
   */
  async getLead(id: string): Promise<ILead | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid lead ID');
    }
    return Lead.findById(id);
  }

  /**
   * Get lead by email
   */
  async getLeadByEmail(email: string): Promise<ILead | null> {
    return Lead.findByEmail(email);
  }

  /**
   * Update lead
   */
  async updateLead(id: string, input: UpdateLeadInput): Promise<ILead | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid lead ID');
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      return null;
    }

    // Update basic fields
    if (input.firstName !== undefined) lead.firstName = input.firstName;
    if (input.lastName !== undefined) lead.lastName = input.lastName;
    if (input.phone !== undefined) lead.phone = input.phone;
    if (input.company !== undefined) lead.company = input.company;
    if (input.jobTitle !== undefined) lead.jobTitle = input.jobTitle;
    if (input.country !== undefined) lead.country = input.country;
    if (input.city !== undefined) lead.city = input.city;
    if (input.timezone !== undefined) lead.timezone = input.timezone;
    if (input.customFields !== undefined) lead.customFields = input.customFields;

    // Update email consent
    if (input.emailConsent !== undefined) {
      lead.emailConsent = input.emailConsent;
      if (input.emailConsent) {
        lead.emailConsentAt = new Date();
      }
    }

    // Update status with history tracking
    if (input.status && input.status !== lead.status) {
      lead.updateStatus(input.status, 'Admin update');
    }

    // Update score
    if (input.score !== undefined && input.score !== lead.score) {
      const scoreDiff = input.score - lead.score;
      lead.addScore(scoreDiff, 'Admin manual adjustment');
    }

    // Update tags
    if (input.tags !== undefined) {
      lead.tags = input.tags;
    }

    await lead.save();
    logger.info(`Lead updated: ${lead.email} (${lead.id})`);
    return lead;
  }

  /**
   * Delete lead
   */
  async deleteLead(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid lead ID');
    }

    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) {
      return false;
    }

    logger.info(`Lead deleted: ${lead.email} (${id})`);
    return true;
  }

  /**
   * List leads with filtering and pagination
   */
  async listLeads(options: ListLeadsOptions = {}): Promise<{ data: ILead[]; total: number }> {
    const {
      status,
      scoreLevel,
      source,
      tags,
      search,
      emailConsent,
      page = 1,
      limit = 20,
      sortBy = 'capturedAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo,
    } = options;

    const query: FilterQuery<ILead> = {};

    if (status) query.status = status;
    if (scoreLevel) query.scoreLevel = scoreLevel;
    if (source) query['source.type'] = source;
    if (tags && tags.length > 0) query.tags = { $in: tags };
    if (emailConsent !== undefined) query.emailConsent = emailConsent;

    // Date range filter
    if (dateFrom || dateTo) {
      query.capturedAt = {};
      if (dateFrom) query.capturedAt.$gte = dateFrom;
      if (dateTo) query.capturedAt.$lte = dateTo;
    }

    // Search across multiple fields
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: Record<string, 1 | -1> = { [sortBy]: sortDirection };

    const [rawData, total] = await Promise.all([
      Lead.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query),
    ]);

    // Transform _id to id for lean results (since toJSON transform is bypassed by .lean())
    const data = rawData.map((lead: any) => ({
      ...lead,
      id: lead._id.toString(),
    }));

    return { data: data as ILead[], total };
  }

  /**
   * Search leads with text search
   */
  async searchLeads(
    searchTerm: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ data: ILead[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    // Use regex search across multiple fields
    const searchRegex = { $regex: searchTerm, $options: 'i' };
    const query: FilterQuery<ILead> = {
      $or: [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { company: searchRegex },
      ],
    };

    const [rawData, total] = await Promise.all([
      Lead.find(query)
        .sort({ capturedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query),
    ]);

    // Transform _id to id for lean results (since toJSON transform is bypassed by .lean())
    const data = rawData.map((lead: any) => ({
      ...lead,
      id: lead._id.toString(),
    }));

    return { data: data as ILead[], total };
  }

  /**
   * Get all unique tags used across leads
   */
  async getAllTags(): Promise<string[]> {
    const result = await Lead.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $sort: { _id: 1 } },
    ]);
    return result.map(r => r._id);
  }

  /**
   * Add tag to lead
   */
  async addTag(id: string, tag: string): Promise<ILead | null> {
    const lead = await this.getLead(id);
    if (!lead) {
      return null;
    }

    lead.addTag(tag);
    await lead.save();
    logger.info(`Tag added to lead: ${lead.email} - ${tag}`);
    return lead;
  }

  /**
   * Remove tag from lead
   */
  async removeTag(id: string, tag: string): Promise<ILead | null> {
    const lead = await this.getLead(id);
    if (!lead) {
      return null;
    }

    lead.removeTag(tag);
    await lead.save();
    logger.info(`Tag removed from lead: ${lead.email} - ${tag}`);
    return lead;
  }

  /**
   * Bulk update leads
   */
  async bulkUpdate(input: BulkUpdateInput): Promise<{ updated: number; failed: number }> {
    let updated = 0;
    let failed = 0;

    for (const leadId of input.leadIds) {
      try {
        const lead = await Lead.findById(leadId);
        if (!lead) {
          failed++;
          continue;
        }

        // Update status
        if (input.updates.status) {
          lead.updateStatus(input.updates.status, 'Bulk update');
        }

        // Update score
        if (input.updates.score !== undefined) {
          const scoreDiff = input.updates.score - lead.score;
          lead.addScore(scoreDiff, 'Bulk adjustment');
        }

        // Add tags
        if (input.updates.addTags) {
          for (const tag of input.updates.addTags) {
            lead.addTag(tag);
          }
        }

        // Remove tags
        if (input.updates.removeTags) {
          for (const tag of input.updates.removeTags) {
            lead.removeTag(tag);
          }
        }

        await lead.save();
        updated++;
      } catch (error) {
        logger.error(`Bulk update failed for lead ${leadId}:`, error);
        failed++;
      }
    }

    logger.info(`Bulk update complete: ${updated} updated, ${failed} failed`);
    return { updated, failed };
  }

  /**
   * Bulk delete leads
   */
  async bulkDelete(leadIds: string[]): Promise<{ deleted: number; failed: number }> {
    let deleted = 0;
    let failed = 0;

    for (const leadId of leadIds) {
      try {
        const result = await Lead.findByIdAndDelete(leadId);
        if (result) {
          deleted++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.error(`Bulk delete failed for lead ${leadId}:`, error);
        failed++;
      }
    }

    logger.info(`Bulk delete complete: ${deleted} deleted, ${failed} failed`);
    return { deleted, failed };
  }

  /**
   * Get lead statistics
   */
  async getStats(): Promise<{
    total: number;
    newLeads: number;
    engaged: number;
    qualified: number;
    converted: number;
    unsubscribed: number;
    avgScore: number;
    totalRevenue: number;
    byScoreLevel: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const [basicStats, byScoreLevel, bySource] = await Promise.all([
      Lead.getStats(),
      Lead.aggregate([
        { $group: { _id: '$scoreLevel', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $group: { _id: '$source.type', count: { $sum: 1 } } },
      ]),
    ]);

    const scoreLevelMap: Record<string, number> = {};
    for (const item of byScoreLevel) {
      scoreLevelMap[item._id] = item.count;
    }

    const sourceMap: Record<string, number> = {};
    for (const item of bySource) {
      sourceMap[item._id] = item.count;
    }

    return {
      ...basicStats,
      byScoreLevel: scoreLevelMap,
      bySource: sourceMap,
    };
  }

  /**
   * Import leads from array
   */
  async importLeads(
    leads: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      company?: string;
      tags?: string[];
    }>,
    source: LeadSource = LeadSource.API
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const leadData of leads) {
      try {
        // Check if lead exists
        const existing = await Lead.findByEmail(leadData.email);
        if (existing) {
          skipped++;
          continue;
        }

        // Create new lead
        const lead = new Lead({
          email: leadData.email.toLowerCase().trim(),
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          phone: leadData.phone,
          company: leadData.company,
          tags: leadData.tags || [],
          source: { type: source },
          emailConsent: true,
          capturedAt: new Date(),
          status: LeadStatus.NEW,
          score: 0,
          scoreLevel: LeadScoreLevel.COLD,
        });

        await lead.save();
        imported++;
      } catch (error: any) {
        errors.push(`${leadData.email}: ${error.message}`);
      }
    }

    logger.info(`Lead import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);
    return { imported, skipped, errors };
  }

  /**
   * Export leads to array format
   */
  async exportLeads(options?: {
    status?: LeadStatus;
    tags?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    status: string;
    score: number;
    scoreLevel: string;
    tags: string[];
    emailConsent: boolean;
    capturedAt: Date;
    source: string;
  }>> {
    const query: FilterQuery<ILead> = {};

    if (options?.status) query.status = options.status;
    if (options?.tags && options.tags.length > 0) query.tags = { $in: options.tags };
    if (options?.dateFrom || options?.dateTo) {
      query.capturedAt = {};
      if (options?.dateFrom) query.capturedAt.$gte = options.dateFrom;
      if (options?.dateTo) query.capturedAt.$lte = options.dateTo;
    }

    const leads = await Lead.find(query)
      .select('email firstName lastName phone company jobTitle status score scoreLevel tags emailConsent capturedAt source.type')
      .lean();

    return leads.map(lead => ({
      email: lead.email,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      company: lead.company,
      jobTitle: lead.jobTitle,
      status: lead.status,
      score: lead.score,
      scoreLevel: lead.scoreLevel,
      tags: lead.tags,
      emailConsent: lead.emailConsent,
      capturedAt: lead.capturedAt,
      source: lead.source.type,
    }));
  }

  /**
   * Merge two leads (keeps first, deletes second)
   */
  async mergeLeads(primaryId: string, secondaryId: string): Promise<ILead> {
    const [primary, secondary] = await Promise.all([
      this.getLead(primaryId),
      this.getLead(secondaryId),
    ]);

    if (!primary) {
      throw ApiError.notFound('Primary lead not found');
    }
    if (!secondary) {
      throw ApiError.notFound('Secondary lead not found');
    }

    // Merge tags
    const allTags = new Set([...primary.tags, ...secondary.tags]);
    primary.tags = Array.from(allTags);

    // Merge activities
    primary.activities = [...primary.activities, ...secondary.activities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Keep higher score
    if (secondary.score > primary.score) {
      primary.addScore(secondary.score - primary.score, 'Merged from secondary lead');
    }

    // Merge custom fields (prefer primary values)
    if (secondary.customFields) {
      primary.customFields = { ...secondary.customFields, ...primary.customFields };
    }

    // Fill in missing contact info from secondary
    if (!primary.firstName && secondary.firstName) primary.firstName = secondary.firstName;
    if (!primary.lastName && secondary.lastName) primary.lastName = secondary.lastName;
    if (!primary.phone && secondary.phone) primary.phone = secondary.phone;
    if (!primary.company && secondary.company) primary.company = secondary.company;
    if (!primary.jobTitle && secondary.jobTitle) primary.jobTitle = secondary.jobTitle;

    await primary.save();
    await Lead.findByIdAndDelete(secondaryId);

    logger.info(`Leads merged: ${primary.email} <- ${secondary.email}`);
    return primary;
  }
}

export const leadService = new LeadService();
export default leadService;
