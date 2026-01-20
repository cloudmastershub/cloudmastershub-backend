import mongoose, { FilterQuery } from 'mongoose';
import { MailingList, IMailingList, MailingListType, MailingListStatus } from '../models/MailingList';
import { Lead, ILead, LeadStatus } from '../models/Lead';
import { Segment } from '../models/Segment';
import segmentService from './segmentService';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Create mailing list input
 */
interface CreateMailingListInput {
  name: string;
  description?: string;
  type: MailingListType;
  segmentId?: string;
  memberIds?: string[];
  doubleOptIn?: boolean;
  welcomeEmailTemplateId?: string;
  tags?: string[];
  createdBy: string;
}

/**
 * Update mailing list input
 */
interface UpdateMailingListInput {
  name?: string;
  description?: string;
  segmentId?: string;
  doubleOptIn?: boolean;
  welcomeEmailTemplateId?: string;
  tags?: string[];
  updatedBy: string;
}

/**
 * List options
 */
interface ListMailingListsOptions {
  type?: MailingListType;
  status?: MailingListStatus;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Mailing List Service - Handles mailing list management
 */
class MailingListService {
  /**
   * Create a new mailing list
   */
  async createMailingList(input: CreateMailingListInput): Promise<IMailingList> {
    // Validate name uniqueness
    const existing = await MailingList.findByName(input.name);
    if (existing) {
      throw ApiError.badRequest('A mailing list with this name already exists');
    }

    // For dynamic lists, validate segment exists
    if (input.type === MailingListType.DYNAMIC) {
      if (!input.segmentId) {
        throw ApiError.badRequest('Dynamic lists require a segmentId');
      }
      const segment = await Segment.findById(input.segmentId);
      if (!segment) {
        throw ApiError.badRequest('Segment not found');
      }
    }

    const mailingList = new MailingList({
      name: input.name,
      description: input.description,
      type: input.type,
      status: MailingListStatus.ACTIVE,
      segmentId: input.type === MailingListType.DYNAMIC ? input.segmentId : undefined,
      memberIds: input.type === MailingListType.STATIC ? (input.memberIds || []) : [],
      doubleOptIn: input.doubleOptIn || false,
      welcomeEmailTemplateId: input.welcomeEmailTemplateId,
      tags: input.tags || [],
      createdBy: input.createdBy,
      memberCount: 0,
      subscribedCount: 0,
      unsubscribedCount: 0,
    });

    // Calculate initial member count
    await this.recalculateStats(mailingList);

    await mailingList.save();
    logger.info(`Mailing list created: ${mailingList.name} (${mailingList.id})`);
    return mailingList;
  }

  /**
   * Get mailing list by ID
   */
  async getMailingList(id: string): Promise<IMailingList | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid mailing list ID');
    }
    return MailingList.findById(id);
  }

  /**
   * Update mailing list
   */
  async updateMailingList(id: string, input: UpdateMailingListInput): Promise<IMailingList | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid mailing list ID');
    }

    const mailingList = await MailingList.findById(id);
    if (!mailingList) {
      return null;
    }

    // Check name uniqueness if name is being changed
    if (input.name && input.name !== mailingList.name) {
      const existing = await MailingList.findByName(input.name);
      if (existing) {
        throw ApiError.badRequest('A mailing list with this name already exists');
      }
      mailingList.name = input.name;
    }

    if (input.description !== undefined) mailingList.description = input.description;
    if (input.doubleOptIn !== undefined) mailingList.doubleOptIn = input.doubleOptIn;
    if (input.welcomeEmailTemplateId !== undefined) mailingList.welcomeEmailTemplateId = input.welcomeEmailTemplateId;
    if (input.tags !== undefined) mailingList.tags = input.tags;

    // Update segment for dynamic lists
    if (mailingList.type === MailingListType.DYNAMIC && input.segmentId) {
      const segment = await Segment.findById(input.segmentId);
      if (!segment) {
        throw ApiError.badRequest('Segment not found');
      }
      mailingList.segmentId = input.segmentId;
    }

    mailingList.updatedBy = input.updatedBy;

    // Recalculate stats
    await this.recalculateStats(mailingList);

    await mailingList.save();
    logger.info(`Mailing list updated: ${mailingList.name} (${mailingList.id})`);
    return mailingList;
  }

  /**
   * Delete mailing list
   */
  async deleteMailingList(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid mailing list ID');
    }

    const mailingList = await MailingList.findByIdAndDelete(id);
    if (!mailingList) {
      return false;
    }

    logger.info(`Mailing list deleted: ${mailingList.name} (${id})`);
    return true;
  }

  /**
   * Archive mailing list
   */
  async archiveMailingList(id: string, updatedBy: string): Promise<IMailingList | null> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      return null;
    }

    mailingList.status = MailingListStatus.ARCHIVED;
    mailingList.updatedBy = updatedBy;
    await mailingList.save();

    logger.info(`Mailing list archived: ${mailingList.name} (${id})`);
    return mailingList;
  }

  /**
   * Restore archived mailing list
   */
  async restoreMailingList(id: string, updatedBy: string): Promise<IMailingList | null> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      return null;
    }

    mailingList.status = MailingListStatus.ACTIVE;
    mailingList.updatedBy = updatedBy;
    await mailingList.save();

    logger.info(`Mailing list restored: ${mailingList.name} (${id})`);
    return mailingList;
  }

  /**
   * List mailing lists with filtering and pagination
   */
  async listMailingLists(options: ListMailingListsOptions = {}): Promise<{ data: IMailingList[]; total: number }> {
    const {
      type,
      status,
      search,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const query: FilterQuery<IMailingList> = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (tags && tags.length > 0) query.tags = { $in: tags };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: Record<string, 1 | -1> = { [sortBy]: sortDirection };

    const [data, total] = await Promise.all([
      MailingList.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MailingList.countDocuments(query),
    ]);

    return { data: data as IMailingList[], total };
  }

  /**
   * Add member(s) to a static mailing list
   */
  async addMembers(id: string, leadIds: string[], updatedBy: string): Promise<IMailingList> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      throw ApiError.notFound('Mailing list not found');
    }

    if (mailingList.type !== MailingListType.STATIC) {
      throw ApiError.badRequest('Cannot manually add members to a dynamic list');
    }

    // Validate leads exist
    const validLeadIds = await Lead.find({ _id: { $in: leadIds } }).distinct('_id');
    const validLeadIdStrings = validLeadIds.map(id => id.toString());

    // Add only new members (avoid duplicates)
    const existingMemberSet = new Set(mailingList.memberIds);
    const newMembers = validLeadIdStrings.filter(id => !existingMemberSet.has(id));

    if (newMembers.length > 0) {
      mailingList.memberIds.push(...newMembers);
      mailingList.updatedBy = updatedBy;
      await this.recalculateStats(mailingList);
      await mailingList.save();
      logger.info(`Added ${newMembers.length} members to mailing list: ${mailingList.name}`);
    }

    return mailingList;
  }

  /**
   * Remove member(s) from a static mailing list
   */
  async removeMembers(id: string, leadIds: string[], updatedBy: string): Promise<IMailingList> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      throw ApiError.notFound('Mailing list not found');
    }

    if (mailingList.type !== MailingListType.STATIC) {
      throw ApiError.badRequest('Cannot manually remove members from a dynamic list');
    }

    const removeSet = new Set(leadIds);
    const originalCount = mailingList.memberIds.length;
    mailingList.memberIds = mailingList.memberIds.filter(id => !removeSet.has(id));
    const removedCount = originalCount - mailingList.memberIds.length;

    if (removedCount > 0) {
      mailingList.updatedBy = updatedBy;
      await this.recalculateStats(mailingList);
      await mailingList.save();
      logger.info(`Removed ${removedCount} members from mailing list: ${mailingList.name}`);
    }

    return mailingList;
  }

  /**
   * Get members of a mailing list
   */
  async getMembers(
    id: string,
    options?: { page?: number; limit?: number; status?: LeadStatus }
  ): Promise<{ data: ILead[]; total: number }> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      throw ApiError.notFound('Mailing list not found');
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;

    if (mailingList.type === MailingListType.DYNAMIC) {
      // For dynamic lists, get leads from the segment
      if (!mailingList.segmentId) {
        return { data: [], total: 0 };
      }
      return segmentService.getSegmentLeads(mailingList.segmentId, { page, limit });
    }

    // For static lists, get from memberIds
    if (mailingList.memberIds.length === 0) {
      return { data: [], total: 0 };
    }

    const query: FilterQuery<ILead> = { _id: { $in: mailingList.memberIds } };
    if (options?.status) {
      query.status = options.status;
    }

    const [data, total] = await Promise.all([
      Lead.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query),
    ]);

    return { data: data as ILead[], total };
  }

  /**
   * Get subscribed members only (for sending emails)
   */
  async getSubscribedMembers(id: string): Promise<ILead[]> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      throw ApiError.notFound('Mailing list not found');
    }

    const query: FilterQuery<ILead> = {
      emailConsent: true,
      status: { $nin: [LeadStatus.UNSUBSCRIBED, LeadStatus.BOUNCED] },
    };

    if (mailingList.type === MailingListType.DYNAMIC && mailingList.segmentId) {
      // Get segment and build query
      const segment = await Segment.findById(mailingList.segmentId);
      if (!segment || !segment.rootGroup) {
        return [];
      }
      const segmentQuery = segmentService.buildMongoQuery(segment.rootGroup);
      return Lead.find({ ...segmentQuery, ...query }).lean() as Promise<ILead[]>;
    }

    // For static lists
    if (mailingList.memberIds.length === 0) {
      return [];
    }

    return Lead.find({
      _id: { $in: mailingList.memberIds },
      ...query,
    }).lean() as Promise<ILead[]>;
  }

  /**
   * Duplicate a mailing list
   */
  async duplicateMailingList(id: string, newName: string, createdBy: string): Promise<IMailingList> {
    const original = await this.getMailingList(id);
    if (!original) {
      throw ApiError.notFound('Mailing list not found');
    }

    // Check name uniqueness
    const existing = await MailingList.findByName(newName);
    if (existing) {
      throw ApiError.badRequest('A mailing list with this name already exists');
    }

    const duplicate = new MailingList({
      name: newName,
      description: original.description,
      type: original.type,
      status: MailingListStatus.ACTIVE,
      segmentId: original.segmentId,
      memberIds: [...original.memberIds],  // Copy array
      doubleOptIn: original.doubleOptIn,
      welcomeEmailTemplateId: original.welcomeEmailTemplateId,
      tags: [...original.tags],
      createdBy,
      memberCount: original.memberCount,
      subscribedCount: original.subscribedCount,
      unsubscribedCount: original.unsubscribedCount,
    });

    await duplicate.save();
    logger.info(`Mailing list duplicated: ${original.name} -> ${newName}`);
    return duplicate;
  }

  /**
   * Recalculate stats for a mailing list
   */
  async recalculateStats(mailingList: IMailingList): Promise<void> {
    if (mailingList.type === MailingListType.DYNAMIC) {
      if (!mailingList.segmentId) {
        mailingList.memberCount = 0;
        mailingList.subscribedCount = 0;
        mailingList.unsubscribedCount = 0;
      } else {
        const segment = await Segment.findById(mailingList.segmentId);
        if (segment && segment.rootGroup) {
          const baseQuery = segmentService.buildMongoQuery(segment.rootGroup);

          const [total, subscribed, unsubscribed] = await Promise.all([
            Lead.countDocuments(baseQuery),
            Lead.countDocuments({
              ...baseQuery,
              emailConsent: true,
              status: { $nin: [LeadStatus.UNSUBSCRIBED, LeadStatus.BOUNCED] },
            }),
            Lead.countDocuments({
              ...baseQuery,
              $or: [
                { status: LeadStatus.UNSUBSCRIBED },
                { status: LeadStatus.BOUNCED },
                { emailConsent: false },
              ],
            }),
          ]);

          mailingList.memberCount = total;
          mailingList.subscribedCount = subscribed;
          mailingList.unsubscribedCount = unsubscribed;
        }
      }
    } else {
      // Static list
      if (mailingList.memberIds.length === 0) {
        mailingList.memberCount = 0;
        mailingList.subscribedCount = 0;
        mailingList.unsubscribedCount = 0;
      } else {
        const [total, subscribed, unsubscribed] = await Promise.all([
          Lead.countDocuments({ _id: { $in: mailingList.memberIds } }),
          Lead.countDocuments({
            _id: { $in: mailingList.memberIds },
            emailConsent: true,
            status: { $nin: [LeadStatus.UNSUBSCRIBED, LeadStatus.BOUNCED] },
          }),
          Lead.countDocuments({
            _id: { $in: mailingList.memberIds },
            $or: [
              { status: LeadStatus.UNSUBSCRIBED },
              { status: LeadStatus.BOUNCED },
              { emailConsent: false },
            ],
          }),
        ]);

        mailingList.memberCount = total;
        mailingList.subscribedCount = subscribed;
        mailingList.unsubscribedCount = unsubscribed;
      }
    }

    mailingList.lastCalculatedAt = new Date();
  }

  /**
   * Import members from CSV data
   */
  async importMembers(
    id: string,
    members: Array<{ email: string; firstName?: string; lastName?: string; tags?: string[] }>,
    updatedBy: string
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      throw ApiError.notFound('Mailing list not found');
    }

    if (mailingList.type !== MailingListType.STATIC) {
      throw ApiError.badRequest('Cannot import members to a dynamic list');
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const newMemberIds: string[] = [];

    for (const member of members) {
      try {
        // Check if lead exists
        let lead = await Lead.findByEmail(member.email);

        if (!lead) {
          // Create new lead
          lead = new Lead({
            email: member.email.toLowerCase().trim(),
            firstName: member.firstName,
            lastName: member.lastName,
            tags: member.tags || [],
            source: { type: 'api' },
            emailConsent: true,
            capturedAt: new Date(),
          });
          await lead.save();
        }

        // Add to list if not already a member
        if (!mailingList.memberIds.includes(lead._id.toString())) {
          newMemberIds.push(lead._id.toString());
          imported++;
        } else {
          skipped++;
        }
      } catch (error: any) {
        errors.push(`${member.email}: ${error.message}`);
      }
    }

    if (newMemberIds.length > 0) {
      mailingList.memberIds.push(...newMemberIds);
      mailingList.updatedBy = updatedBy;
      await this.recalculateStats(mailingList);
      await mailingList.save();
    }

    logger.info(`Import to mailing list ${mailingList.name}: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);

    return { imported, skipped, errors };
  }

  /**
   * Export members to array format
   */
  async exportMembers(id: string): Promise<Array<{
    email: string;
    firstName?: string;
    lastName?: string;
    status: string;
    score: number;
    tags: string[];
    capturedAt: Date;
  }>> {
    const mailingList = await this.getMailingList(id);
    if (!mailingList) {
      throw ApiError.notFound('Mailing list not found');
    }

    let leads: ILead[];

    if (mailingList.type === MailingListType.DYNAMIC && mailingList.segmentId) {
      const segment = await Segment.findById(mailingList.segmentId);
      if (!segment || !segment.rootGroup) {
        return [];
      }
      const query = segmentService.buildMongoQuery(segment.rootGroup);
      leads = await Lead.find(query)
        .select('email firstName lastName status score tags capturedAt')
        .lean() as ILead[];
    } else {
      if (mailingList.memberIds.length === 0) {
        return [];
      }
      leads = await Lead.find({ _id: { $in: mailingList.memberIds } })
        .select('email firstName lastName status score tags capturedAt')
        .lean() as ILead[];
    }

    return leads.map(lead => ({
      email: lead.email,
      firstName: lead.firstName,
      lastName: lead.lastName,
      status: lead.status,
      score: lead.score,
      tags: lead.tags,
      capturedAt: lead.capturedAt,
    }));
  }
}

export const mailingListService = new MailingListService();
export default mailingListService;
