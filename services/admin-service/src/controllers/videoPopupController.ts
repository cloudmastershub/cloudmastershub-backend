import { Request, Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { VideoPopup } from '../models/VideoPopup';
import logger from '../utils/logger';

/**
 * List all video popups with pagination
 */
export const listVideoPopups = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const enabled = req.query.enabled;

    let query: any = {};
    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }

    const [popups, total] = await Promise.all([
      VideoPopup.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VideoPopup.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: popups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    logger.error('Error listing video popups:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list video popups',
        details: error.message
      }
    });
  }
};

/**
 * Get a single video popup by ID
 */
export const getVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await VideoPopup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Video popup not found' }
      });
      return;
    }

    res.json({
      success: true,
      data: popup
    });
  } catch (error: any) {
    logger.error('Error getting video popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get video popup',
        details: error.message
      }
    });
  }
};

/**
 * Create a new video popup
 */
export const createVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      title,
      description,
      videoType,
      videoUrl,
      videoEmbedCode,
      enabled,
      targetPages,
      excludePages,
      showAfterSeconds,
      showOnce,
      dismissible,
      autoPlay,
      ctaText,
      ctaLink,
      ctaOpenInNewTab,
      priority,
      startDate,
      endDate
    } = req.body;

    if (!name || !title || !videoUrl) {
      res.status(400).json({
        success: false,
        error: { message: 'Name, title, and videoUrl are required' }
      });
      return;
    }

    const popup = new VideoPopup({
      name,
      title,
      description,
      videoType: videoType || 'youtube',
      videoUrl,
      videoEmbedCode,
      enabled: enabled || false,
      targetPages: targetPages || ['*'],
      excludePages: excludePages || [],
      showAfterSeconds: showAfterSeconds ?? 5,
      showOnce: showOnce ?? true,
      dismissible: dismissible ?? true,
      autoPlay: autoPlay || false,
      ctaText,
      ctaLink,
      ctaOpenInNewTab: ctaOpenInNewTab || false,
      priority: priority || 0,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      createdBy: req.adminId || 'unknown',
      updatedBy: req.adminId || 'unknown'
    });

    await popup.save();

    logger.info(`Video popup created: ${popup.name} by ${req.adminId}`);

    res.status(201).json({
      success: true,
      data: popup,
      message: 'Video popup created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating video popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create video popup',
        details: error.message
      }
    });
  }
};

/**
 * Update a video popup
 */
export const updateVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      title,
      description,
      videoType,
      videoUrl,
      videoEmbedCode,
      enabled,
      targetPages,
      excludePages,
      showAfterSeconds,
      showOnce,
      dismissible,
      autoPlay,
      ctaText,
      ctaLink,
      ctaOpenInNewTab,
      priority,
      startDate,
      endDate
    } = req.body;

    const popup = await VideoPopup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Video popup not found' }
      });
      return;
    }

    if (name !== undefined) popup.name = name;
    if (title !== undefined) popup.title = title;
    if (description !== undefined) popup.description = description;
    if (videoType !== undefined) popup.videoType = videoType;
    if (videoUrl !== undefined) popup.videoUrl = videoUrl;
    if (videoEmbedCode !== undefined) popup.videoEmbedCode = videoEmbedCode;
    if (enabled !== undefined) popup.enabled = enabled;
    if (targetPages !== undefined) popup.targetPages = targetPages;
    if (excludePages !== undefined) popup.excludePages = excludePages;
    if (showAfterSeconds !== undefined) popup.showAfterSeconds = showAfterSeconds;
    if (showOnce !== undefined) popup.showOnce = showOnce;
    if (dismissible !== undefined) popup.dismissible = dismissible;
    if (autoPlay !== undefined) popup.autoPlay = autoPlay;
    if (ctaText !== undefined) popup.ctaText = ctaText;
    if (ctaLink !== undefined) popup.ctaLink = ctaLink;
    if (ctaOpenInNewTab !== undefined) popup.ctaOpenInNewTab = ctaOpenInNewTab;
    if (priority !== undefined) popup.priority = priority;
    if (startDate !== undefined) popup.startDate = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) popup.endDate = endDate ? new Date(endDate) : undefined;
    popup.updatedBy = req.adminId || 'unknown';

    await popup.save();

    logger.info(`Video popup updated: ${popup.name} by ${req.adminId}`);

    res.json({
      success: true,
      data: popup,
      message: 'Video popup updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating video popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update video popup',
        details: error.message
      }
    });
  }
};

/**
 * Delete a video popup
 */
export const deleteVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await VideoPopup.findByIdAndDelete(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Video popup not found' }
      });
      return;
    }

    logger.info(`Video popup deleted: ${popup.name} by ${req.adminId}`);

    res.json({
      success: true,
      message: 'Video popup deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting video popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete video popup',
        details: error.message
      }
    });
  }
};

/**
 * Toggle video popup enabled status
 */
export const toggleVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await VideoPopup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Video popup not found' }
      });
      return;
    }

    popup.enabled = !popup.enabled;
    popup.updatedBy = req.adminId || 'unknown';
    await popup.save();

    res.json({
      success: true,
      data: popup,
      message: `Video popup ${popup.enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error: any) {
    logger.error('Error toggling video popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to toggle video popup',
        details: error.message
      }
    });
  }
};

/**
 * Duplicate a video popup
 */
export const duplicateVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const original = await VideoPopup.findById(id);

    if (!original) {
      res.status(404).json({
        success: false,
        error: { message: 'Video popup not found' }
      });
      return;
    }

    const duplicate = new VideoPopup({
      name: `${original.name} (Copy)`,
      title: original.title,
      description: original.description,
      videoType: original.videoType,
      videoUrl: original.videoUrl,
      videoEmbedCode: original.videoEmbedCode,
      enabled: false,
      targetPages: original.targetPages,
      excludePages: original.excludePages,
      showAfterSeconds: original.showAfterSeconds,
      showOnce: original.showOnce,
      dismissible: original.dismissible,
      autoPlay: original.autoPlay,
      ctaText: original.ctaText,
      ctaLink: original.ctaLink,
      ctaOpenInNewTab: original.ctaOpenInNewTab,
      priority: original.priority,
      startDate: original.startDate,
      endDate: original.endDate,
      createdBy: req.adminId || 'unknown',
      updatedBy: req.adminId || 'unknown'
    });

    await duplicate.save();

    logger.info(`Video popup duplicated: ${duplicate.name} from ${original.name}`);

    res.status(201).json({
      success: true,
      data: duplicate,
      message: 'Video popup duplicated successfully'
    });
  } catch (error: any) {
    logger.error('Error duplicating video popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to duplicate video popup',
        details: error.message
      }
    });
  }
};

/**
 * Get active video popups for a specific page (public endpoint)
 */
export const getActivePopupsForPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagePath = req.query.page as string || '/';
    const now = new Date();

    const popups = await VideoPopup.find({
      enabled: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] }
      ]
    }).sort({ priority: -1, createdAt: -1 });

    // Filter popups that match the page
    const matchingPopups = popups.filter(popup => {
      // Check if page is excluded
      if (popup.excludePages.some(excluded => {
        if (excluded === pagePath) return true;
        if (excluded.includes('*')) {
          const regex = new RegExp('^' + excluded.replace(/\*/g, '.*') + '$');
          return regex.test(pagePath);
        }
        return false;
      })) {
        return false;
      }

      // Check if page matches target
      if (popup.targetPages.length === 0 || popup.targetPages.includes('*')) {
        return true;
      }

      return popup.targetPages.some(target => {
        if (target === pagePath) return true;
        if (target.includes('*')) {
          const regex = new RegExp('^' + target.replace(/\*/g, '.*') + '$');
          return regex.test(pagePath);
        }
        return false;
      });
    });

    res.json({
      success: true,
      data: matchingPopups
    });
  } catch (error: any) {
    logger.error('Error getting active popups:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get active popups',
        details: error.message
      }
    });
  }
};

/**
 * Record popup view (public endpoint)
 */
export const recordPopupView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await VideoPopup.findById(id);
    if (popup) {
      popup.viewCount = (popup.viewCount || 0) + 1;
      await popup.save();
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error recording popup view:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * Record popup CTA click (public endpoint)
 */
export const recordPopupClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await VideoPopup.findById(id);
    if (popup) {
      popup.clickCount = (popup.clickCount || 0) + 1;
      await popup.save();
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error recording popup click:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * Record popup dismiss (public endpoint)
 */
export const recordPopupDismiss = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await VideoPopup.findById(id);
    if (popup) {
      popup.dismissCount = (popup.dismissCount || 0) + 1;
      await popup.save();
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error recording popup dismiss:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * Get popup analytics
 */
export const getPopupAnalytics = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await VideoPopup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Video popup not found' }
      });
      return;
    }

    const clickRate = popup.viewCount > 0
      ? ((popup.clickCount / popup.viewCount) * 100).toFixed(2)
      : '0.00';

    const dismissRate = popup.viewCount > 0
      ? ((popup.dismissCount / popup.viewCount) * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      data: {
        id: popup._id,
        name: popup.name,
        viewCount: popup.viewCount,
        clickCount: popup.clickCount,
        dismissCount: popup.dismissCount,
        clickRate: `${clickRate}%`,
        dismissRate: `${dismissRate}%`,
        enabled: popup.enabled,
        targetPages: popup.targetPages
      }
    });
  } catch (error: any) {
    logger.error('Error getting popup analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get popup analytics',
        details: error.message
      }
    });
  }
};
