import mongoose, { FilterQuery } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Segment, ISegment, ISegmentGroup, ISegmentRule, SEGMENT_FIELDS } from '../models/Segment';
import { Lead, ILead } from '../models/Lead';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Segment creation input
 */
interface CreateSegmentInput {
  name: string;
  description?: string;
  type: 'static' | 'dynamic';
  rootGroup?: ISegmentGroup;
  leadIds?: string[];
  tags?: string[];
  createdBy: string;
}

/**
 * Segment update input
 */
interface UpdateSegmentInput {
  name?: string;
  description?: string;
  rootGroup?: ISegmentGroup;
  leadIds?: string[];
  tags?: string[];
  updatedBy: string;
}

/**
 * Segment list options
 */
interface ListSegmentsOptions {
  type?: 'static' | 'dynamic';
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Segment Service - Handles audience segmentation
 */
class SegmentService {
  /**
   * Create a new segment
   */
  async createSegment(input: CreateSegmentInput): Promise<ISegment> {
    // Validate name uniqueness
    const existing = await Segment.findByName(input.name);
    if (existing) {
      throw ApiError.badRequest('A segment with this name already exists');
    }

    // Generate IDs for rules if not provided
    if (input.rootGroup) {
      this.ensureGroupIds(input.rootGroup);
    }

    const segment = new Segment({
      name: input.name,
      description: input.description,
      type: input.type,
      rootGroup: input.type === 'dynamic' ? input.rootGroup : undefined,
      leadIds: input.type === 'static' ? input.leadIds || [] : undefined,
      tags: input.tags,
      createdBy: input.createdBy,
      estimatedSize: 0,
    });

    // Calculate initial size
    const size = await this.calculateSegmentSize(segment);
    segment.estimatedSize = size;
    segment.lastCalculatedAt = new Date();

    await segment.save();
    logger.info(`Segment created: ${segment.name} (${segment.id})`);
    return segment;
  }

  /**
   * Get segment by ID
   */
  async getSegment(id: string): Promise<ISegment | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid segment ID');
    }
    return Segment.findById(id);
  }

  /**
   * Update segment
   */
  async updateSegment(id: string, input: UpdateSegmentInput): Promise<ISegment | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid segment ID');
    }

    const segment = await Segment.findById(id);
    if (!segment) {
      return null;
    }

    // Check name uniqueness if name is being changed
    if (input.name && input.name !== segment.name) {
      const existing = await Segment.findByName(input.name);
      if (existing) {
        throw ApiError.badRequest('A segment with this name already exists');
      }
      segment.name = input.name;
    }

    if (input.description !== undefined) segment.description = input.description;
    if (input.tags !== undefined) segment.tags = input.tags;

    // Update rules/leads based on type
    if (segment.type === 'dynamic' && input.rootGroup) {
      this.ensureGroupIds(input.rootGroup);
      segment.rootGroup = input.rootGroup;
    }
    if (segment.type === 'static' && input.leadIds) {
      segment.leadIds = input.leadIds;
    }

    segment.updatedBy = input.updatedBy;

    // Recalculate size
    const size = await this.calculateSegmentSize(segment);
    segment.estimatedSize = size;
    segment.lastCalculatedAt = new Date();

    await segment.save();
    logger.info(`Segment updated: ${segment.name} (${segment.id})`);
    return segment;
  }

  /**
   * Delete segment
   */
  async deleteSegment(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid segment ID');
    }

    const segment = await Segment.findByIdAndDelete(id);
    if (!segment) {
      return false;
    }

    logger.info(`Segment deleted: ${segment.name} (${id})`);
    return true;
  }

  /**
   * List segments with filtering and pagination
   */
  async listSegments(options: ListSegmentsOptions = {}): Promise<{ data: ISegment[]; total: number }> {
    const {
      type,
      search,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const query: FilterQuery<ISegment> = {};

    if (type) query.type = type;
    if (tags && tags.length > 0) query.tags = { $in: tags };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: any = { [sortBy]: sortDirection };

    const [rawData, total] = await Promise.all([
      Segment.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Segment.countDocuments(query),
    ]);

    // Transform _id to id for lean results (since toJSON transform is bypassed by .lean())
    const data = rawData.map((segment: any) => ({
      ...segment,
      id: segment._id.toString(),
    }));

    return { data: data as ISegment[], total };
  }

  /**
   * Calculate segment size
   */
  async calculateSegmentSize(segment: ISegment): Promise<number> {
    if (segment.type === 'static') {
      return segment.leadIds?.length || 0;
    }

    if (!segment.rootGroup) {
      return 0;
    }

    const query = this.buildMongoQuery(segment.rootGroup);
    return Lead.countDocuments(query);
  }

  /**
   * Recalculate and update segment size
   */
  async recalculateSize(id: string): Promise<{ count: number }> {
    const segment = await this.getSegment(id);
    if (!segment) {
      throw ApiError.notFound('Segment not found');
    }

    const count = await this.calculateSegmentSize(segment);
    segment.estimatedSize = count;
    segment.lastCalculatedAt = new Date();
    await segment.save();

    return { count };
  }

  /**
   * Get leads matching a segment
   */
  async getSegmentLeads(
    segmentId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ data: ILead[]; total: number }> {
    const segment = await this.getSegment(segmentId);
    if (!segment) {
      throw ApiError.notFound('Segment not found');
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;

    if (segment.type === 'static') {
      if (!segment.leadIds || segment.leadIds.length === 0) {
        return { data: [], total: 0 };
      }

      const [rawData, total] = await Promise.all([
        Lead.find({ _id: { $in: segment.leadIds } })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        segment.leadIds.length,
      ]);

      // Transform _id to id for lean results
      const data = rawData.map((lead: any) => ({
        ...lead,
        id: lead._id.toString(),
      }));

      return { data: data as ILead[], total };
    }

    if (!segment.rootGroup) {
      return { data: [], total: 0 };
    }

    const query = this.buildMongoQuery(segment.rootGroup);
    const [rawData, total] = await Promise.all([
      Lead.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query),
    ]);

    // Transform _id to id for lean results
    const data = rawData.map((lead: any) => ({
      ...lead,
      id: lead._id.toString(),
    }));

    return { data: data as ILead[], total };
  }

  /**
   * Preview segment (estimate size without saving)
   */
  async previewSegment(
    rootGroup: ISegmentGroup
  ): Promise<{ count: number; sampleLeads: Partial<ILead>[] }> {
    const query = this.buildMongoQuery(rootGroup);

    const [count, rawSampleLeads] = await Promise.all([
      Lead.countDocuments(query),
      Lead.find(query)
        .select('email firstName lastName status score scoreLevel tags capturedAt')
        .limit(10)
        .lean(),
    ]);

    // Transform _id to id for lean results
    const sampleLeads = rawSampleLeads.map((lead: any) => ({
      ...lead,
      id: lead._id.toString(),
    }));

    return { count, sampleLeads: sampleLeads as Partial<ILead>[] };
  }

  /**
   * Get available segment fields
   */
  getAvailableFields(): typeof SEGMENT_FIELDS {
    return SEGMENT_FIELDS;
  }

  /**
   * Build MongoDB query from segment group
   */
  buildMongoQuery(group: ISegmentGroup): FilterQuery<ILead> {
    const conditions: FilterQuery<ILead>[] = [];

    // Process rules
    for (const rule of group.rules) {
      const ruleQuery = this.buildRuleQuery(rule);
      if (Object.keys(ruleQuery).length > 0) {
        conditions.push(ruleQuery);
      }
    }

    // Process nested groups recursively
    if (group.groups && group.groups.length > 0) {
      for (const nestedGroup of group.groups) {
        const nestedQuery = this.buildMongoQuery(nestedGroup);
        if (Object.keys(nestedQuery).length > 0) {
          conditions.push(nestedQuery);
        }
      }
    }

    if (conditions.length === 0) {
      return {};
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return group.operator === 'and'
      ? { $and: conditions }
      : { $or: conditions };
  }

  /**
   * Build query from a single rule
   */
  private buildRuleQuery(rule: ISegmentRule): FilterQuery<ILead> {
    const { field, operator, value } = rule;

    switch (operator) {
      case 'equals':
        return { [field]: value };

      case 'not_equals':
        return { [field]: { $ne: value } };

      case 'contains':
        if (field === 'tags') {
          return { [field]: value };
        }
        return { [field]: { $regex: value, $options: 'i' } };

      case 'not_contains':
        if (field === 'tags') {
          return { [field]: { $ne: value } };
        }
        return { [field]: { $not: { $regex: value, $options: 'i' } } };

      case 'starts_with':
        return { [field]: { $regex: `^${this.escapeRegex(value)}`, $options: 'i' } };

      case 'ends_with':
        return { [field]: { $regex: `${this.escapeRegex(value)}$`, $options: 'i' } };

      case 'greater_than':
        return { [field]: { $gt: value } };

      case 'less_than':
        return { [field]: { $lt: value } };

      case 'greater_than_or_equals':
        return { [field]: { $gte: value } };

      case 'less_than_or_equals':
        return { [field]: { $lte: value } };

      case 'in':
        return { [field]: { $in: Array.isArray(value) ? value : [value] } };

      case 'not_in':
        return { [field]: { $nin: Array.isArray(value) ? value : [value] } };

      case 'exists':
        return { [field]: { $exists: true, $ne: null } };

      case 'not_exists':
        return { $or: [
          { [field]: { $exists: false } },
          { [field]: null },
        ]};

      case 'before':
        return { [field]: { $lt: new Date(value) } };

      case 'after':
        return { [field]: { $gt: new Date(value) } };

      case 'is_empty':
        return { $or: [
          { [field]: { $exists: false } },
          { [field]: null },
          { [field]: '' },
          { [field]: { $size: 0 } },
        ]};

      case 'is_not_empty':
        return {
          [field]: { $exists: true, $nin: [null, ''] },
          ...(field.includes('.') ? {} : { [`${field}.0`]: { $exists: true } }),
        };

      default:
        return { [field]: value };
    }
  }

  /**
   * Ensure all groups and rules have IDs
   */
  private ensureGroupIds(group: ISegmentGroup): void {
    if (!group.id) {
      group.id = uuidv4();
    }

    for (const rule of group.rules) {
      if (!rule.id) {
        rule.id = uuidv4();
      }
    }

    if (group.groups) {
      for (const nestedGroup of group.groups) {
        this.ensureGroupIds(nestedGroup);
      }
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const segmentService = new SegmentService();
export default segmentService;
