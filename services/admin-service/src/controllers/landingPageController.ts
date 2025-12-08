import { Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import landingPageService from '../services/landingPageService';
import { LandingPageStatus } from '../models/LandingPage';
import logger from '../utils/logger';

/**
 * List all landing pages with pagination and filtering
 */
export const listLandingPages = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const result = await landingPageService.list({
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      status: status as LandingPageStatus | undefined,
      search: search as string | undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error: any) {
    logger.error('Error listing landing pages:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list landing pages',
        details: error.message
      }
    });
  }
};

/**
 * Get a single landing page by ID
 */
export const getLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const landingPage = await landingPageService.getById(id);

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage
    });
  } catch (error: any) {
    logger.error('Error getting landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get landing page',
        details: error.message
      }
    });
  }
};

/**
 * Create a new landing page
 */
export const createLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      slug,
      description,
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImage,
      blocks,
      template
    } = req.body;

    const landingPage = await landingPageService.create({
      title,
      slug,
      description,
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImage,
      blocks: blocks || [],
      template,
      createdBy: req.adminId || 'unknown'
    });

    res.status(201).json({
      success: true,
      data: landingPage,
      message: 'Landing page created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating landing page:', error);

    // Handle duplicate slug error
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        error: {
          message: 'A landing page with this slug already exists'
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create landing page',
        details: error.message
      }
    });
  }
};

/**
 * Update a landing page
 */
export const updateLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      description,
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImage,
      blocks,
      template
    } = req.body;

    const landingPage = await landingPageService.update(id, {
      title,
      slug,
      description,
      metaTitle,
      metaDescription,
      metaKeywords,
      ogImage,
      blocks,
      template,
      updatedBy: req.adminId || 'unknown'
    });

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage,
      message: 'Landing page updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating landing page:', error);

    // Handle duplicate slug error
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        error: {
          message: 'A landing page with this slug already exists'
        }
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update landing page',
        details: error.message
      }
    });
  }
};

/**
 * Delete a landing page
 */
export const deleteLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await landingPageService.delete(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      message: 'Landing page deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete landing page',
        details: error.message
      }
    });
  }
};

/**
 * Publish a landing page
 */
export const publishLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const landingPage = await landingPageService.publish(id, req.adminId || 'unknown');

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage,
      message: 'Landing page published successfully'
    });
  } catch (error: any) {
    logger.error('Error publishing landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to publish landing page',
        details: error.message
      }
    });
  }
};

/**
 * Unpublish a landing page
 */
export const unpublishLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const landingPage = await landingPageService.unpublish(id, req.adminId || 'unknown');

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage,
      message: 'Landing page unpublished successfully'
    });
  } catch (error: any) {
    logger.error('Error unpublishing landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to unpublish landing page',
        details: error.message
      }
    });
  }
};

/**
 * Duplicate a landing page
 */
export const duplicateLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const landingPage = await landingPageService.duplicate(id, req.adminId || 'unknown');

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: landingPage,
      message: 'Landing page duplicated successfully'
    });
  } catch (error: any) {
    logger.error('Error duplicating landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to duplicate landing page',
        details: error.message
      }
    });
  }
};

/**
 * Update blocks for a landing page
 */
export const updateLandingPageBlocks = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { blocks } = req.body;

    if (!Array.isArray(blocks)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Blocks must be an array'
        }
      });
      return;
    }

    const landingPage = await landingPageService.updateBlocks(id, blocks, req.adminId || 'unknown');

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage,
      message: 'Landing page blocks updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating landing page blocks:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update landing page blocks',
        details: error.message
      }
    });
  }
};

/**
 * Get analytics for a landing page
 */
export const getLandingPageAnalytics = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const analytics = await landingPageService.getAnalytics(id);

    if (!analytics) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    logger.error('Error getting landing page analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get landing page analytics',
        details: error.message
      }
    });
  }
};

/**
 * Get a published landing page by slug (public endpoint)
 */
export const getPublicLandingPage = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const landingPage = await landingPageService.getPublishedBySlug(slug);

    if (!landingPage) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Landing page not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: landingPage
    });
  } catch (error: any) {
    logger.error('Error getting public landing page:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get landing page',
        details: error.message
      }
    });
  }
};

/**
 * Record a conversion event (public endpoint)
 */
export const recordConversion = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const success = await landingPageService.recordConversion(slug);

    res.json({
      success,
      message: success ? 'Conversion recorded' : 'Landing page not found'
    });
  } catch (error: any) {
    logger.error('Error recording conversion:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to record conversion'
      }
    });
  }
};
