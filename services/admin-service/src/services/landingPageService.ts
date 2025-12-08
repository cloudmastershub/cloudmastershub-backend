import { LandingPage, ILandingPage, LandingPageStatus, IBlock } from '../models/LandingPage';
import logger from '../utils/logger';

export interface CreateLandingPageInput {
  title: string;
  slug?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
  blocks?: IBlock[];
  template?: string;
  createdBy: string;
}

export interface UpdateLandingPageInput {
  title?: string;
  slug?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
  blocks?: IBlock[];
  template?: string;
  updatedBy: string;
}

export interface ListLandingPagesOptions {
  page?: number;
  limit?: number;
  status?: LandingPageStatus;
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

class LandingPageService {
  /**
   * Create a new landing page
   */
  async create(input: CreateLandingPageInput): Promise<ILandingPage> {
    try {
      logger.info('Creating new landing page', { title: input.title, createdBy: input.createdBy });

      const landingPage = new LandingPage({
        ...input,
        updatedBy: input.createdBy,
        status: LandingPageStatus.DRAFT,
      });

      await landingPage.save();

      logger.info('Landing page created successfully', {
        id: landingPage._id,
        slug: landingPage.slug
      });

      return landingPage;
    } catch (error: any) {
      logger.error('Error creating landing page:', error);
      throw error;
    }
  }

  /**
   * Get a landing page by ID
   */
  async getById(id: string): Promise<ILandingPage | null> {
    try {
      const landingPage = await LandingPage.findById(id);
      return landingPage;
    } catch (error: any) {
      logger.error('Error fetching landing page by ID:', error);
      throw error;
    }
  }

  /**
   * Get a landing page by slug
   */
  async getBySlug(slug: string): Promise<ILandingPage | null> {
    try {
      const landingPage = await LandingPage.findOne({ slug });
      return landingPage;
    } catch (error: any) {
      logger.error('Error fetching landing page by slug:', error);
      throw error;
    }
  }

  /**
   * Get a published landing page by slug (for public access)
   */
  async getPublishedBySlug(slug: string): Promise<ILandingPage | null> {
    try {
      const landingPage = await LandingPage.findOne({
        slug,
        status: LandingPageStatus.PUBLISHED
      });

      // Increment view count if found
      if (landingPage) {
        landingPage.viewCount = (landingPage.viewCount || 0) + 1;
        await landingPage.save();
      }

      return landingPage;
    } catch (error: any) {
      logger.error('Error fetching published landing page:', error);
      throw error;
    }
  }

  /**
   * List landing pages with pagination and filtering
   */
  async list(options: ListLandingPagesOptions = {}): Promise<PaginatedResult<ILandingPage>> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        createdBy
      } = options;

      // Build query
      const query: any = {};

      if (status) {
        query.status = status;
      }

      if (createdBy) {
        query.createdBy = createdBy;
      }

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate skip
      const skip = (page - 1) * limit;

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query
      const [landingPages, total] = await Promise.all([
        LandingPage.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        LandingPage.countDocuments(query)
      ]);

      // Transform _id to id for each landing page (lean() bypasses Mongoose transforms)
      const transformedPages = landingPages.map((page: any) => ({
        ...page,
        id: page._id.toString(),
        _id: undefined
      }));

      return {
        data: transformedPages as ILandingPage[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error: any) {
      logger.error('Error listing landing pages:', error);
      throw error;
    }
  }

  /**
   * Update a landing page
   */
  async update(id: string, input: UpdateLandingPageInput): Promise<ILandingPage | null> {
    try {
      logger.info('Updating landing page', { id, updatedBy: input.updatedBy });

      const landingPage = await LandingPage.findById(id);

      if (!landingPage) {
        return null;
      }

      // Filter out undefined values to avoid overwriting required fields with undefined
      const filteredInput = Object.fromEntries(
        Object.entries(input).filter(([_, value]) => value !== undefined)
      );

      // Update only defined fields
      Object.assign(landingPage, filteredInput);

      await landingPage.save();

      logger.info('Landing page updated successfully', { id, slug: landingPage.slug });

      return landingPage;
    } catch (error: any) {
      logger.error('Error updating landing page:', error);
      throw error;
    }
  }

  /**
   * Delete a landing page
   */
  async delete(id: string): Promise<boolean> {
    try {
      logger.info('Deleting landing page', { id });

      const result = await LandingPage.findByIdAndDelete(id);

      if (result) {
        logger.info('Landing page deleted successfully', { id });
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Error deleting landing page:', error);
      throw error;
    }
  }

  /**
   * Publish a landing page
   */
  async publish(id: string, updatedBy: string): Promise<ILandingPage | null> {
    try {
      logger.info('Publishing landing page', { id, updatedBy });

      const landingPage = await LandingPage.findById(id);

      if (!landingPage) {
        return null;
      }

      landingPage.status = LandingPageStatus.PUBLISHED;
      landingPage.publishedAt = new Date();
      landingPage.updatedBy = updatedBy;

      await landingPage.save();

      logger.info('Landing page published successfully', { id, slug: landingPage.slug });

      return landingPage;
    } catch (error: any) {
      logger.error('Error publishing landing page:', error);
      throw error;
    }
  }

  /**
   * Unpublish a landing page
   */
  async unpublish(id: string, updatedBy: string): Promise<ILandingPage | null> {
    try {
      logger.info('Unpublishing landing page', { id, updatedBy });

      const landingPage = await LandingPage.findById(id);

      if (!landingPage) {
        return null;
      }

      landingPage.status = LandingPageStatus.DRAFT;
      landingPage.updatedBy = updatedBy;

      await landingPage.save();

      logger.info('Landing page unpublished successfully', { id, slug: landingPage.slug });

      return landingPage;
    } catch (error: any) {
      logger.error('Error unpublishing landing page:', error);
      throw error;
    }
  }

  /**
   * Duplicate a landing page
   */
  async duplicate(id: string, createdBy: string): Promise<ILandingPage | null> {
    try {
      logger.info('Duplicating landing page', { id, createdBy });

      const original = await LandingPage.findById(id);

      if (!original) {
        return null;
      }

      // Create new landing page with copied data
      const duplicate = new LandingPage({
        title: `${original.title} (Copy)`,
        description: original.description,
        metaTitle: original.metaTitle,
        metaDescription: original.metaDescription,
        metaKeywords: original.metaKeywords,
        ogImage: original.ogImage,
        blocks: original.blocks.map(block => ({
          ...block,
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })),
        template: original.template,
        createdBy,
        updatedBy: createdBy,
        status: LandingPageStatus.DRAFT
      });

      await duplicate.save();

      logger.info('Landing page duplicated successfully', {
        originalId: id,
        newId: duplicate._id,
        newSlug: duplicate.slug
      });

      return duplicate;
    } catch (error: any) {
      logger.error('Error duplicating landing page:', error);
      throw error;
    }
  }

  /**
   * Update blocks for a landing page
   */
  async updateBlocks(id: string, blocks: IBlock[], updatedBy: string): Promise<ILandingPage | null> {
    try {
      logger.info('Updating landing page blocks', { id, blockCount: blocks.length, updatedBy });

      const landingPage = await LandingPage.findById(id);

      if (!landingPage) {
        return null;
      }

      landingPage.blocks = blocks;
      landingPage.updatedBy = updatedBy;

      await landingPage.save();

      logger.info('Landing page blocks updated successfully', { id });

      return landingPage;
    } catch (error: any) {
      logger.error('Error updating landing page blocks:', error);
      throw error;
    }
  }

  /**
   * Record a conversion event
   */
  async recordConversion(slug: string): Promise<boolean> {
    try {
      const landingPage = await LandingPage.findOne({
        slug,
        status: LandingPageStatus.PUBLISHED
      });

      if (landingPage) {
        landingPage.conversionCount = (landingPage.conversionCount || 0) + 1;
        await landingPage.save();
        return true;
      }

      return false;
    } catch (error: any) {
      logger.error('Error recording conversion:', error);
      return false;
    }
  }

  /**
   * Get analytics for a landing page
   */
  async getAnalytics(id: string): Promise<{
    viewCount: number;
    conversionCount: number;
    conversionRate: number;
  } | null> {
    try {
      const landingPage = await LandingPage.findById(id).select('viewCount conversionCount');

      if (!landingPage) {
        return null;
      }

      const viewCount = landingPage.viewCount || 0;
      const conversionCount = landingPage.conversionCount || 0;
      const conversionRate = viewCount > 0 ? (conversionCount / viewCount) * 100 : 0;

      return {
        viewCount,
        conversionCount,
        conversionRate: Math.round(conversionRate * 100) / 100
      };
    } catch (error: any) {
      logger.error('Error getting landing page analytics:', error);
      throw error;
    }
  }
}

export default new LandingPageService();
