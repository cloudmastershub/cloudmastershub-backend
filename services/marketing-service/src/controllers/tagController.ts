import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { tagService } from '../services/tagService';
import { TagCategory } from '../models/Tag';
import logger from '../utils/logger';

/**
 * Get all tags
 * GET /admin/tags
 */
export const getAllTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      category,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      page = '1',
      limit = '50',
    } = req.query;

    const result = await tagService.getAllTags({
      category: category as TagCategory | undefined,
      search: search as string | undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });

    res.json({
      success: true,
      data: result.tags,
      pagination: {
        page: result.page,
        limit: parseInt(limit as string, 10),
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    logger.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tags',
      error: { code: 'FETCH_TAGS_ERROR' },
    });
  }
};

/**
 * Get a single tag by ID
 * GET /admin/tags/:id
 */
export const getTagById = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { id } = req.params;
    const tag = await tagService.getTagById(id);

    if (!tag) {
      res.status(404).json({
        success: false,
        message: 'Tag not found',
        error: { code: 'TAG_NOT_FOUND' },
      });
      return;
    }

    res.json({
      success: true,
      data: tag,
    });
  } catch (error) {
    logger.error('Error fetching tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tag',
      error: { code: 'FETCH_TAG_ERROR' },
    });
  }
};

/**
 * Create a new tag
 * POST /admin/tags
 */
export const createTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { name, description, category, color } = req.body;
    const userId = (req as any).userId || 'system';

    const tag = await tagService.createTag({
      name,
      description,
      category,
      color,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      data: tag,
      message: 'Tag created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating tag:', error);

    if (error.statusCode === 409) {
      res.status(409).json({
        success: false,
        message: error.message,
        error: { code: 'TAG_EXISTS' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create tag',
      error: { code: 'CREATE_TAG_ERROR' },
    });
  }
};

/**
 * Update a tag
 * PUT /admin/tags/:id
 */
export const updateTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { id } = req.params;
    const { name, description, category, color } = req.body;
    const userId = (req as any).userId || 'system';

    const tag = await tagService.updateTag(id, {
      name,
      description,
      category,
      color,
      updatedBy: userId,
    });

    if (!tag) {
      res.status(404).json({
        success: false,
        message: 'Tag not found',
        error: { code: 'TAG_NOT_FOUND' },
      });
      return;
    }

    res.json({
      success: true,
      data: tag,
      message: 'Tag updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating tag:', error);

    if (error.statusCode === 409) {
      res.status(409).json({
        success: false,
        message: error.message,
        error: { code: 'TAG_EXISTS' },
      });
      return;
    }

    if (error.statusCode === 403) {
      res.status(403).json({
        success: false,
        message: error.message,
        error: { code: 'FORBIDDEN' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update tag',
      error: { code: 'UPDATE_TAG_ERROR' },
    });
  }
};

/**
 * Delete a tag
 * DELETE /admin/tags/:id
 */
export const deleteTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { id } = req.params;
    const deleted = await tagService.deleteTag(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Tag not found',
        error: { code: 'TAG_NOT_FOUND' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting tag:', error);

    if (error.statusCode === 403) {
      res.status(403).json({
        success: false,
        message: error.message,
        error: { code: 'FORBIDDEN' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete tag',
      error: { code: 'DELETE_TAG_ERROR' },
    });
  }
};

/**
 * Search tags for autocomplete
 * GET /admin/tags/search
 */
export const searchTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q = '', limit = '10' } = req.query;
    const tags = await tagService.searchTags(q as string, parseInt(limit as string, 10));

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    logger.error('Error searching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search tags',
      error: { code: 'SEARCH_TAGS_ERROR' },
    });
  }
};

/**
 * Get tag statistics
 * GET /admin/tags/stats
 */
export const getTagStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await tagService.getTagStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching tag stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tag statistics',
      error: { code: 'TAG_STATS_ERROR' },
    });
  }
};

/**
 * Merge two tags
 * POST /admin/tags/:id/merge
 */
export const mergeTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { id: sourceId } = req.params;
    const { targetId } = req.body;
    const userId = (req as any).userId || 'system';

    if (!targetId) {
      res.status(400).json({
        success: false,
        message: 'Target tag ID is required',
        error: { code: 'MISSING_TARGET_ID' },
      });
      return;
    }

    const tag = await tagService.mergeTags(sourceId, targetId, userId);

    res.json({
      success: true,
      data: tag,
      message: 'Tags merged successfully',
    });
  } catch (error: any) {
    logger.error('Error merging tags:', error);

    if (error.statusCode === 404) {
      res.status(404).json({
        success: false,
        message: error.message,
        error: { code: 'TAG_NOT_FOUND' },
      });
      return;
    }

    if (error.statusCode === 403) {
      res.status(403).json({
        success: false,
        message: error.message,
        error: { code: 'FORBIDDEN' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to merge tags',
      error: { code: 'MERGE_TAGS_ERROR' },
    });
  }
};

/**
 * Sync tags from leads
 * POST /admin/tags/sync
 */
export const syncTagsFromLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId || 'system';
    const result = await tagService.syncTagsFromLeads(userId);

    res.json({
      success: true,
      data: result,
      message: `Synced tags: ${result.created} created, ${result.existing} updated`,
    });
  } catch (error) {
    logger.error('Error syncing tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync tags',
      error: { code: 'SYNC_TAGS_ERROR' },
    });
  }
};
