import mongoose from 'mongoose';
import { Tag, ITag, TagCategory } from '../models/Tag';
import { Lead } from '../models/Lead';
import { ApiError } from '../middleware/errorHandler';
import logger from '../utils/logger';

/**
 * Tag Service - Handles tag CRUD operations
 */
export class TagService {
  /**
   * Get all tags with optional filtering
   */
  async getAllTags(options: {
    category?: TagCategory;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}): Promise<{ tags: ITag[]; total: number; page: number; totalPages: number }> {
    const {
      category,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 50,
    } = options;

    const query: any = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [tags, total] = await Promise.all([
      Tag.find(query).sort(sortOptions).skip(skip).limit(limit),
      Tag.countDocuments(query),
    ]);

    return {
      tags,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single tag by ID
   */
  async getTagById(id: string): Promise<ITag | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid tag ID');
    }
    return Tag.findById(id);
  }

  /**
   * Get a tag by slug
   */
  async getTagBySlug(slug: string): Promise<ITag | null> {
    return Tag.findOne({ slug: slug.toLowerCase() });
  }

  /**
   * Create a new tag
   */
  async createTag(input: {
    name: string;
    description?: string;
    category?: TagCategory;
    color?: string;
    createdBy: string;
  }): Promise<ITag> {
    // Check for existing tag with same name
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existingTag = await Tag.findOne({ slug });
    if (existingTag) {
      throw ApiError.conflict(`Tag "${input.name}" already exists`);
    }

    const tag = new Tag({
      name: input.name,
      slug,
      description: input.description,
      category: input.category || TagCategory.CUSTOM,
      color: input.color,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });

    await tag.save();
    logger.info(`Tag created: ${tag.name} (${tag.id})`);
    return tag;
  }

  /**
   * Update a tag
   */
  async updateTag(
    id: string,
    input: {
      name?: string;
      description?: string;
      category?: TagCategory;
      color?: string;
      updatedBy: string;
    }
  ): Promise<ITag | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid tag ID');
    }

    const tag = await Tag.findById(id);
    if (!tag) {
      return null;
    }

    // Check if it's a system tag
    if (tag.isSystem && input.name && input.name !== tag.name) {
      throw ApiError.forbidden('Cannot rename system tags');
    }

    // Check for name conflict if name is being changed
    if (input.name && input.name !== tag.name) {
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const existingTag = await Tag.findOne({ slug, _id: { $ne: id } });
      if (existingTag) {
        throw ApiError.conflict(`Tag "${input.name}" already exists`);
      }

      tag.name = input.name;
      tag.slug = slug;
    }

    if (input.description !== undefined) tag.description = input.description;
    if (input.category !== undefined) tag.category = input.category;
    if (input.color !== undefined) tag.color = input.color;
    tag.updatedBy = input.updatedBy;

    await tag.save();
    logger.info(`Tag updated: ${tag.name} (${tag.id})`);
    return tag;
  }

  /**
   * Delete a tag
   */
  async deleteTag(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid tag ID');
    }

    const tag = await Tag.findById(id);
    if (!tag) {
      return false;
    }

    // Check if it's a system tag
    if (tag.isSystem) {
      throw ApiError.forbidden('Cannot delete system tags');
    }

    // Remove the tag from all leads that have it
    await Lead.updateMany(
      { tags: tag.name },
      { $pull: { tags: tag.name } }
    );

    await Tag.findByIdAndDelete(id);
    logger.info(`Tag deleted: ${tag.name} (${id})`);
    return true;
  }

  /**
   * Search tags for autocomplete
   */
  async searchTags(query: string, limit = 10): Promise<ITag[]> {
    if (!query || query.length < 1) {
      return Tag.find().sort({ usageCount: -1, name: 1 }).limit(limit);
    }

    return Tag.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { slug: { $regex: query, $options: 'i' } },
      ],
    })
      .sort({ usageCount: -1, name: 1 })
      .limit(limit);
  }

  /**
   * Get tag usage statistics
   */
  async getTagStats(): Promise<{
    totalTags: number;
    byCategory: { category: string; count: number }[];
    topTags: ITag[];
  }> {
    const [totalTags, byCategory, topTags] = await Promise.all([
      Tag.countDocuments(),
      Tag.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $project: { category: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      Tag.find().sort({ usageCount: -1 }).limit(10),
    ]);

    return {
      totalTags,
      byCategory,
      topTags,
    };
  }

  /**
   * Merge two tags (move all usages from source to target)
   */
  async mergeTags(
    sourceId: string,
    targetId: string,
    updatedBy: string
  ): Promise<ITag | null> {
    if (!mongoose.Types.ObjectId.isValid(sourceId) || !mongoose.Types.ObjectId.isValid(targetId)) {
      throw ApiError.badRequest('Invalid tag ID');
    }

    if (sourceId === targetId) {
      throw ApiError.badRequest('Cannot merge a tag with itself');
    }

    const [sourceTag, targetTag] = await Promise.all([
      Tag.findById(sourceId),
      Tag.findById(targetId),
    ]);

    if (!sourceTag) {
      throw ApiError.notFound('Source tag not found');
    }
    if (!targetTag) {
      throw ApiError.notFound('Target tag not found');
    }

    if (sourceTag.isSystem) {
      throw ApiError.forbidden('Cannot merge system tags');
    }

    // Update all leads: replace source tag with target tag
    const leadsWithSource = await Lead.find({ tags: sourceTag.name });

    for (const lead of leadsWithSource) {
      const hasTarget = lead.tags.includes(targetTag.name);
      if (hasTarget) {
        // Just remove source if target already exists
        lead.tags = lead.tags.filter(t => t !== sourceTag.name);
      } else {
        // Replace source with target
        lead.tags = lead.tags.map(t => t === sourceTag.name ? targetTag.name : t);
      }
      await lead.save();
    }

    // Update target usage count
    targetTag.usageCount += sourceTag.usageCount;
    targetTag.updatedBy = updatedBy;
    await targetTag.save();

    // Delete source tag
    await Tag.findByIdAndDelete(sourceId);

    logger.info(`Tags merged: ${sourceTag.name} -> ${targetTag.name}`);
    return targetTag;
  }

  /**
   * Sync tags from leads - creates Tag documents for any tags that exist on leads but not in Tag collection
   */
  async syncTagsFromLeads(createdBy: string): Promise<{ created: number; existing: number }> {
    // Get all unique tags from leads
    const leadTags = await Lead.distinct('tags');

    let created = 0;
    let existing = 0;

    for (const tagName of leadTags) {
      if (!tagName || typeof tagName !== 'string') continue;

      const slug = tagName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const existingTag = await Tag.findOne({ slug });

      if (existingTag) {
        // Update usage count
        const count = await Lead.countDocuments({ tags: tagName });
        existingTag.usageCount = count;
        await existingTag.save();
        existing++;
      } else {
        // Create new tag
        const count = await Lead.countDocuments({ tags: tagName });
        const tag = new Tag({
          name: tagName,
          slug,
          category: TagCategory.CUSTOM,
          usageCount: count,
          createdBy,
          updatedBy: createdBy,
        });
        await tag.save();
        created++;
      }
    }

    logger.info(`Tags synced from leads: ${created} created, ${existing} existing`);
    return { created, existing };
  }
}

export const tagService = new TagService();
export default tagService;
