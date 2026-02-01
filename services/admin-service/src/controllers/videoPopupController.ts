import { Request, Response } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import {
  Popup,
  PopupType,
  DisplayTrigger,
  FormFieldType,
  SuccessAction,
  DEFAULT_LEAD_CAPTURE_FIELDS,
  IFormField
} from '../models/VideoPopup';
import logger from '../utils/logger';
import axios from 'axios';

// Backward compatibility alias
const VideoPopup = Popup;

// Marketing service URL for lead creation
const MARKETING_SERVICE_URL = process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006';

/**
 * List all popups with pagination and type filtering
 */
export const listVideoPopups = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const enabled = req.query.enabled;
    const type = req.query.type as PopupType | undefined;

    let query: any = {};
    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }
    if (type && Object.values(PopupType).includes(type)) {
      query.type = type;
    }

    const [popups, total] = await Promise.all([
      Popup.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Popup.countDocuments(query)
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
    logger.error('Error listing popups:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list popups',
        details: error.message
      }
    });
  }
};

// Backward compatibility alias
export const listPopups = listVideoPopups;

/**
 * Get a single popup by ID
 */
export const getVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await Popup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Popup not found' }
      });
      return;
    }

    res.json({
      success: true,
      data: popup
    });
  } catch (error: any) {
    logger.error('Error getting popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get popup',
        details: error.message
      }
    });
  }
};

// Backward compatibility alias
export const getPopup = getVideoPopup;

/**
 * Create a new popup (video or lead capture)
 */
export const createVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      title,
      description,
      type = PopupType.VIDEO,
      // Display settings
      displayTrigger = DisplayTrigger.DELAY,
      showAfterSeconds,
      scrollPercentage,
      // Common settings
      enabled,
      targetPages,
      excludePages,
      showOnce,
      dismissible,
      priority,
      startDate,
      endDate,
      // Video-specific
      videoType,
      videoUrl,
      videoEmbedCode,
      autoPlay,
      ctaText,
      ctaLink,
      ctaOpenInNewTab,
      // Lead capture-specific
      formFields,
      submitButtonText,
      thankYouMessage,
      successAction,
      redirectUrl,
      redirectDelay,
      workflowId,
      tagsToApply,
      initialScore
    } = req.body;

    // Validate required fields based on type
    if (!name || !title) {
      res.status(400).json({
        success: false,
        error: { message: 'Name and title are required' }
      });
      return;
    }

    // Validate video popup requirements
    if (type === PopupType.VIDEO && !videoUrl) {
      res.status(400).json({
        success: false,
        error: { message: 'Video URL is required for video popups' }
      });
      return;
    }

    // Use default form fields if not provided for lead capture
    const popupFormFields = type === PopupType.LEAD_CAPTURE
      ? (formFields || DEFAULT_LEAD_CAPTURE_FIELDS)
      : undefined;

    const popup = new Popup({
      name,
      title,
      description,
      type,
      // Display settings
      displayTrigger,
      showAfterSeconds: showAfterSeconds ?? 5,
      scrollPercentage: scrollPercentage ?? 50,
      // Common settings
      enabled: enabled || false,
      targetPages: targetPages || ['*'],
      excludePages: excludePages || [],
      showOnce: showOnce ?? true,
      dismissible: dismissible ?? true,
      priority: priority || 0,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      // Video-specific
      videoType: type === PopupType.VIDEO ? (videoType || 'youtube') : undefined,
      videoUrl: type === PopupType.VIDEO ? videoUrl : undefined,
      videoEmbedCode: type === PopupType.VIDEO ? videoEmbedCode : undefined,
      autoPlay: autoPlay || false,
      ctaText,
      ctaLink,
      ctaOpenInNewTab: ctaOpenInNewTab || false,
      // Lead capture-specific
      formFields: popupFormFields,
      submitButtonText: submitButtonText || 'Subscribe',
      thankYouMessage: thankYouMessage || 'Thank you for subscribing!',
      successAction: successAction || SuccessAction.MESSAGE,
      redirectUrl,
      redirectDelay: redirectDelay ?? 2000,
      workflowId,
      tagsToApply: tagsToApply || [],
      initialScore: initialScore ?? 10,
      // Audit
      createdBy: req.adminId || 'unknown',
      updatedBy: req.adminId || 'unknown'
    });

    await popup.save();

    logger.info(`Popup created: ${popup.name} (type: ${type}) by ${req.adminId}`);

    res.status(201).json({
      success: true,
      data: popup,
      message: `${type === PopupType.VIDEO ? 'Video' : 'Lead capture'} popup created successfully`
    });
  } catch (error: any) {
    logger.error('Error creating popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create popup',
        details: error.message
      }
    });
  }
};

// Backward compatibility alias
export const createPopup = createVideoPopup;

/**
 * Update a popup
 */
export const updateVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      title,
      description,
      // Note: type cannot be changed after creation
      // Display settings
      displayTrigger,
      showAfterSeconds,
      scrollPercentage,
      // Common settings
      enabled,
      targetPages,
      excludePages,
      showOnce,
      dismissible,
      priority,
      startDate,
      endDate,
      // Video-specific
      videoType,
      videoUrl,
      videoEmbedCode,
      autoPlay,
      ctaText,
      ctaLink,
      ctaOpenInNewTab,
      // Lead capture-specific
      formFields,
      submitButtonText,
      thankYouMessage,
      successAction,
      redirectUrl,
      redirectDelay,
      workflowId,
      tagsToApply,
      initialScore
    } = req.body;

    const popup = await Popup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Popup not found' }
      });
      return;
    }

    // Update shared fields
    if (name !== undefined) popup.name = name;
    if (title !== undefined) popup.title = title;
    if (description !== undefined) popup.description = description;
    if (displayTrigger !== undefined) popup.displayTrigger = displayTrigger;
    if (showAfterSeconds !== undefined) popup.showAfterSeconds = showAfterSeconds;
    if (scrollPercentage !== undefined) popup.scrollPercentage = scrollPercentage;
    if (enabled !== undefined) popup.enabled = enabled;
    if (targetPages !== undefined) popup.targetPages = targetPages;
    if (excludePages !== undefined) popup.excludePages = excludePages;
    if (showOnce !== undefined) popup.showOnce = showOnce;
    if (dismissible !== undefined) popup.dismissible = dismissible;
    if (priority !== undefined) popup.priority = priority;
    if (startDate !== undefined) popup.startDate = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) popup.endDate = endDate ? new Date(endDate) : undefined;

    // Update video-specific fields
    if (popup.type === PopupType.VIDEO || !popup.type) {
      if (videoType !== undefined) popup.videoType = videoType;
      if (videoUrl !== undefined) popup.videoUrl = videoUrl;
      if (videoEmbedCode !== undefined) popup.videoEmbedCode = videoEmbedCode;
      if (autoPlay !== undefined) popup.autoPlay = autoPlay;
    }

    // Update CTA fields (shared between types)
    if (ctaText !== undefined) popup.ctaText = ctaText;
    if (ctaLink !== undefined) popup.ctaLink = ctaLink;
    if (ctaOpenInNewTab !== undefined) popup.ctaOpenInNewTab = ctaOpenInNewTab;

    // Update lead capture-specific fields
    if (popup.type === PopupType.LEAD_CAPTURE) {
      if (formFields !== undefined) popup.formFields = formFields;
      if (submitButtonText !== undefined) popup.submitButtonText = submitButtonText;
      if (thankYouMessage !== undefined) popup.thankYouMessage = thankYouMessage;
      if (successAction !== undefined) popup.successAction = successAction;
      if (redirectUrl !== undefined) popup.redirectUrl = redirectUrl;
      if (redirectDelay !== undefined) popup.redirectDelay = redirectDelay;
      if (workflowId !== undefined) popup.workflowId = workflowId;
      if (tagsToApply !== undefined) popup.tagsToApply = tagsToApply;
      if (initialScore !== undefined) popup.initialScore = initialScore;
    }

    popup.updatedBy = req.adminId || 'unknown';

    await popup.save();

    logger.info(`Popup updated: ${popup.name} by ${req.adminId}`);

    res.json({
      success: true,
      data: popup,
      message: 'Popup updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update popup',
        details: error.message
      }
    });
  }
};

// Backward compatibility alias
export const updatePopup = updateVideoPopup;

/**
 * Delete a popup
 */
export const deleteVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await Popup.findByIdAndDelete(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Popup not found' }
      });
      return;
    }

    logger.info(`Popup deleted: ${popup.name} by ${req.adminId}`);

    res.json({
      success: true,
      message: 'Popup deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete popup',
        details: error.message
      }
    });
  }
};

// Backward compatibility alias
export const deletePopup = deleteVideoPopup;

/**
 * Toggle popup enabled status
 */
export const toggleVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const popup = await Popup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Popup not found' }
      });
      return;
    }

    popup.enabled = !popup.enabled;
    popup.updatedBy = req.adminId || 'unknown';
    await popup.save();

    res.json({
      success: true,
      data: popup,
      message: `Popup ${popup.enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error: any) {
    logger.error('Error toggling popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to toggle popup',
        details: error.message
      }
    });
  }
};

// Backward compatibility alias
export const togglePopup = toggleVideoPopup;

/**
 * Duplicate a popup
 */
export const duplicateVideoPopup = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const original = await Popup.findById(id);

    if (!original) {
      res.status(404).json({
        success: false,
        error: { message: 'Popup not found' }
      });
      return;
    }

    const duplicate = new Popup({
      // Shared fields
      name: `${original.name} (Copy)`,
      title: original.title,
      description: original.description,
      type: original.type || PopupType.VIDEO,
      displayTrigger: original.displayTrigger,
      showAfterSeconds: original.showAfterSeconds,
      scrollPercentage: original.scrollPercentage,
      enabled: false,
      targetPages: original.targetPages,
      excludePages: original.excludePages,
      showOnce: original.showOnce,
      dismissible: original.dismissible,
      priority: original.priority,
      startDate: original.startDate,
      endDate: original.endDate,
      // Video-specific
      videoType: original.videoType,
      videoUrl: original.videoUrl,
      videoEmbedCode: original.videoEmbedCode,
      autoPlay: original.autoPlay,
      ctaText: original.ctaText,
      ctaLink: original.ctaLink,
      ctaOpenInNewTab: original.ctaOpenInNewTab,
      // Lead capture-specific
      formFields: original.formFields,
      submitButtonText: original.submitButtonText,
      thankYouMessage: original.thankYouMessage,
      successAction: original.successAction,
      redirectUrl: original.redirectUrl,
      redirectDelay: original.redirectDelay,
      workflowId: original.workflowId,
      tagsToApply: original.tagsToApply,
      initialScore: original.initialScore,
      // Audit
      createdBy: req.adminId || 'unknown',
      updatedBy: req.adminId || 'unknown'
    });

    await duplicate.save();

    logger.info(`Popup duplicated: ${duplicate.name} from ${original.name}`);

    res.status(201).json({
      success: true,
      data: duplicate,
      message: 'Popup duplicated successfully'
    });
  } catch (error: any) {
    logger.error('Error duplicating popup:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to duplicate popup',
        details: error.message
      }
    });
  }
};

// Backward compatibility alias
export const duplicatePopup = duplicateVideoPopup;

/**
 * Get active popups for a specific page (public endpoint)
 */
export const getActivePopupsForPage = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagePath = req.query.page as string || '/';
    const popupType = req.query.type as PopupType | undefined;
    const now = new Date();

    const query: any = {
      enabled: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] }
      ]
    };

    // Filter by popup type if specified
    if (popupType && Object.values(PopupType).includes(popupType)) {
      query.type = popupType;
    }

    const popups = await Popup.find(query).sort({ priority: -1, createdAt: -1 });

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

    const popup = await Popup.findById(id);
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

    const popup = await Popup.findById(id);
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

    const popup = await Popup.findById(id);
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

    const popup = await Popup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Popup not found' }
      });
      return;
    }

    const clickRate = popup.viewCount > 0
      ? ((popup.clickCount / popup.viewCount) * 100).toFixed(2)
      : '0.00';

    const dismissRate = popup.viewCount > 0
      ? ((popup.dismissCount / popup.viewCount) * 100).toFixed(2)
      : '0.00';

    const submissionRate = popup.viewCount > 0
      ? ((popup.submissionCount / popup.viewCount) * 100).toFixed(2)
      : '0.00';

    const analyticsData: any = {
      id: popup._id,
      name: popup.name,
      type: popup.type || PopupType.VIDEO,
      viewCount: popup.viewCount,
      clickCount: popup.clickCount,
      dismissCount: popup.dismissCount,
      clickRate: `${clickRate}%`,
      dismissRate: `${dismissRate}%`,
      enabled: popup.enabled,
      targetPages: popup.targetPages
    };

    // Add submission data for lead capture popups
    if (popup.type === PopupType.LEAD_CAPTURE) {
      analyticsData.submissionCount = popup.submissionCount;
      analyticsData.submissionRate = `${submissionRate}%`;
    }

    res.json({
      success: true,
      data: analyticsData
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

/**
 * Submit lead capture form (public endpoint)
 */
export const submitPopupForm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const formData = req.body;

    const popup = await Popup.findById(id);

    if (!popup) {
      res.status(404).json({
        success: false,
        error: { message: 'Popup not found' }
      });
      return;
    }

    if (popup.type !== PopupType.LEAD_CAPTURE) {
      res.status(400).json({
        success: false,
        error: { message: 'This popup does not accept form submissions' }
      });
      return;
    }

    // Validate required fields
    const requiredFields = popup.formFields?.filter(f => f.required) || [];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!formData[field.name] || formData[field.name].toString().trim() === '') {
        missingFields.push(field.label);
      }
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          fields: missingFields
        }
      });
      return;
    }

    // Validate email format if email field exists
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid email format' }
      });
      return;
    }

    // Create lead in marketing service
    try {
      const leadData = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        company: formData.company,
        source: {
          type: 'popup',
          popupId: popup._id.toString(),
          popupName: popup.name
        },
        tags: popup.tagsToApply || [],
        score: popup.initialScore || 10,
        customFields: {} as Record<string, string>,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      };

      // Add any custom fields that aren't standard lead fields
      const standardFields = ['email', 'firstName', 'lastName', 'phone', 'company'];
      for (const [key, value] of Object.entries(formData)) {
        if (!standardFields.includes(key) && typeof value === 'string') {
          leadData.customFields[key] = value;
        }
      }

      // Call marketing service public endpoint to create lead
      await axios.post(`${MARKETING_SERVICE_URL}/api/leads/popup`, leadData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000
      });

      logger.info(`Lead created from popup: ${popup.name} - ${formData.email}`);
    } catch (leadError: any) {
      // Log but don't fail the request - lead creation is best-effort
      // The submission is still recorded
      logger.warn(`Failed to create lead in marketing service: ${leadError.message}`);
    }

    // Record submission
    popup.submissionCount = (popup.submissionCount || 0) + 1;
    await popup.save();

    // Trigger workflow if configured
    if (popup.workflowId) {
      try {
        await axios.post(`${MARKETING_SERVICE_URL}/api/workflows/${popup.workflowId}/trigger`, {
          email: formData.email,
          popupId: popup._id.toString(),
          formData
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Request': 'true'
          },
          timeout: 5000
        });
        logger.info(`Workflow triggered from popup: ${popup.name} - workflow ${popup.workflowId}`);
      } catch (workflowError: any) {
        logger.warn(`Failed to trigger workflow: ${workflowError.message}`);
      }
    }

    res.json({
      success: true,
      message: popup.thankYouMessage || 'Thank you for subscribing!',
      successAction: popup.successAction,
      redirectUrl: popup.successAction === SuccessAction.REDIRECT ? popup.redirectUrl : undefined,
      redirectDelay: popup.redirectDelay
    });
  } catch (error: any) {
    logger.error('Error submitting popup form:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to submit form',
        details: error.message
      }
    });
  }
};
