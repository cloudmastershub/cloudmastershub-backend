import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import leadService from '../services/leadService';
import { LeadSource, LeadStatus, LeadScoreLevel } from '../models/Lead';
import logger from '../utils/logger';

/**
 * Lead Controller - HTTP request handlers for lead management
 */

/**
 * Create lead
 * POST /admin/leads
 */
export const createLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const {
      email,
      firstName,
      lastName,
      phone,
      company,
      jobTitle,
      source,
      tags,
      emailConsent,
      customFields,
    } = req.body;

    const lead = await leadService.createLead({
      email,
      firstName,
      lastName,
      phone,
      company,
      jobTitle,
      source,
      tags,
      emailConsent,
      customFields,
    });

    res.status(201).json({
      success: true,
      data: lead,
      message: 'Lead created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get lead by ID
 * GET /admin/leads/:id
 */
export const getLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const lead = await leadService.getLead(id);
    if (!lead) {
      res.status(404).json({
        success: false,
        error: { message: 'Lead not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List leads
 * GET /admin/leads
 */
export const listLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      scoreLevel,
      source,
      tags,
      search,
      emailConsent,
      page = '1',
      limit = '20',
      sortBy = 'capturedAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo,
    } = req.query;

    const result = await leadService.listLeads({
      status: status as LeadStatus,
      scoreLevel: scoreLevel as LeadScoreLevel,
      source: source as LeadSource,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      search: search as string,
      emailConsent: emailConsent !== undefined ? emailConsent === 'true' : undefined,
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string, 10)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update lead
 * PUT /admin/leads/:id
 */
export const updateLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const {
      firstName,
      lastName,
      phone,
      company,
      jobTitle,
      status,
      score,
      tags,
      emailConsent,
      customFields,
      country,
      city,
      timezone,
    } = req.body;

    const lead = await leadService.updateLead(id, {
      firstName,
      lastName,
      phone,
      company,
      jobTitle,
      status,
      score,
      tags,
      emailConsent,
      customFields,
      country,
      city,
      timezone,
    });

    if (!lead) {
      res.status(404).json({
        success: false,
        error: { message: 'Lead not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: lead,
      message: 'Lead updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete lead
 * DELETE /admin/leads/:id
 */
export const deleteLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await leadService.deleteLead(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Lead not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search leads
 * POST /admin/leads/search
 */
export const searchLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { query, page = 1, limit = 20 } = req.body;

    const result = await leadService.searchLeads(query, {
      page,
      limit: Math.min(limit, 100),
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all tags
 * GET /admin/leads/tags
 */
export const getAllTags = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tags = await leadService.getAllTags();

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add tag to lead
 * POST /admin/leads/:id/tags
 */
export const addTag = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const { tags } = req.body;

    // Get the lead first
    let lead = await leadService.getLead(id);
    if (!lead) {
      res.status(404).json({
        success: false,
        error: { message: 'Lead not found' },
      });
      return;
    }

    // Add each tag
    for (const tag of tags) {
      lead = await leadService.addTag(id, tag);
    }

    res.json({
      success: true,
      data: lead,
      message: `${tags.length} tag(s) added successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove multiple tags from lead
 * DELETE /admin/leads/:id/tags
 */
export const removeTags = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const { tags } = req.body;

    // Get the lead first
    let lead = await leadService.getLead(id);
    if (!lead) {
      res.status(404).json({
        success: false,
        error: { message: 'Lead not found' },
      });
      return;
    }

    // Remove each tag
    for (const tag of tags) {
      lead = await leadService.removeTag(id, tag);
    }

    res.json({
      success: true,
      data: lead,
      message: `${tags.length} tag(s) removed successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove single tag from lead (legacy)
 * DELETE /admin/leads/:id/tags/:tag
 */
export const removeTag = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, tag } = req.params;

    const lead = await leadService.removeTag(id, decodeURIComponent(tag));
    if (!lead) {
      res.status(404).json({
        success: false,
        error: { message: 'Lead not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: lead,
      message: 'Tag removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update leads
 * POST /admin/leads/bulk/update
 */
export const bulkUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { leadIds, updates } = req.body;

    const result = await leadService.bulkUpdate({ leadIds, updates });

    res.json({
      success: true,
      data: result,
      message: `Bulk update complete: ${result.updated} updated, ${result.failed} failed`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk delete leads
 * POST /admin/leads/bulk/delete
 */
export const bulkDelete = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { leadIds } = req.body;

    const result = await leadService.bulkDelete(leadIds);

    res.json({
      success: true,
      data: result,
      message: `Bulk delete complete: ${result.deleted} deleted, ${result.failed} failed`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get lead statistics
 * GET /admin/leads/stats
 */
export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await leadService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Import leads
 * POST /admin/leads/import
 */
export const importLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { leads, source = 'api' } = req.body;

    const result = await leadService.importLeads(leads, source as LeadSource);

    res.json({
      success: true,
      data: result,
      message: `Import complete: ${result.imported} imported, ${result.skipped} skipped`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export leads
 * GET /admin/leads/export
 */
export const exportLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, tags, dateFrom, dateTo } = req.query;

    const leads = await leadService.exportLeads({
      status: status as LeadStatus,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
    });

    res.json({
      success: true,
      data: leads,
      total: leads.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Merge leads
 * POST /admin/leads/merge
 */
export const mergeLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { primaryId, secondaryId } = req.body;

    const lead = await leadService.mergeLeads(primaryId, secondaryId);

    res.json({
      success: true,
      data: lead,
      message: 'Leads merged successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Capture bootcamp interest lead (PUBLIC - no auth required)
 * POST /leads/bootcamp-interest
 *
 * This endpoint is for the public bootcamps page to capture leads
 * who want to download curriculum information.
 */
export const captureBootcampInterest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, firstName, lastName, bootcamp_slug } = req.body;

    // Validate required fields
    if (!email || !bootcamp_slug) {
      res.status(400).json({
        success: false,
        error: { message: 'Email and bootcamp_slug are required' },
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid email format' },
      });
      return;
    }

    // Try to find existing lead
    const Lead = (await import('../models/Lead')).default;
    let lead = await Lead.findOne({ email: email.toLowerCase().trim() });

    if (lead) {
      // Update existing lead with bootcamp interest
      if (!lead.tags.includes('bootcamp_interest')) {
        lead.tags.push('bootcamp_interest');
      }
      if (!lead.tags.includes(`bootcamp_${bootcamp_slug}`)) {
        lead.tags.push(`bootcamp_${bootcamp_slug}`);
      }
      if (!lead.tags.includes('curriculum_download')) {
        lead.tags.push('curriculum_download');
      }

      // Update name if provided and not already set
      if (firstName && !lead.firstName) {
        lead.firstName = firstName;
      }
      if (lastName && !lead.lastName) {
        lead.lastName = lastName;
      }

      // Record curriculum download activity
      lead.recordActivity('download', {
        type: 'curriculum',
        bootcamp: bootcamp_slug,
        timestamp: new Date().toISOString()
      });

      await lead.save();

      logger.info('Updated existing lead with bootcamp interest', {
        email,
        bootcamp_slug,
        leadId: lead._id.toString()
      });
    } else {
      // Create new lead using Lead model directly to maintain type consistency
      lead = new Lead({
        email: email.toLowerCase().trim(),
        firstName,
        lastName,
        source: {
          type: LeadSource.LANDING_PAGE,
          landingPageId: `/bootcamps/${bootcamp_slug}`,
        },
        tags: ['bootcamp_interest', `bootcamp_${bootcamp_slug}`, 'curriculum_download'],
        emailConsent: true,
        emailConsentAt: new Date(),
        status: 'new',
        score: 0,
        scoreLevel: 'cold',
        capturedAt: new Date(),
      });

      // Record curriculum download activity
      lead.recordActivity('download', {
        type: 'curriculum',
        bootcamp: bootcamp_slug,
        timestamp: new Date().toISOString()
      });
      await lead.save();

      logger.info('Created new lead from bootcamp interest', {
        email,
        bootcamp_slug,
        leadId: lead._id.toString()
      });
    }

    // At this point lead is guaranteed to be non-null
    const leadId = lead._id.toString();

    res.status(200).json({
      success: true,
      message: 'Thank you for your interest! Check your email for the curriculum.',
      data: {
        lead_id: leadId,
        bootcamp: bootcamp_slug
      }
    });
  } catch (error: any) {
    logger.error('Error capturing bootcamp interest:', {
      error: error.message,
      stack: error.stack
    });

    // Handle duplicate email error gracefully
    if (error.message?.includes('already exists')) {
      res.status(200).json({
        success: true,
        message: 'Thank you for your interest! Check your email for the curriculum.',
        data: { bootcamp: req.body.bootcamp_slug }
      });
      return;
    }

    next(error);
  }
};

/**
 * Subscribe to newsletter - PUBLIC endpoint
 * POST /leads/newsletter
 *
 * This endpoint allows visitors to subscribe to the newsletter
 * without authentication.
 */
export const subscribeNewsletter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      res.status(400).json({
        success: false,
        error: { message: 'Email is required' },
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid email format' },
      });
      return;
    }

    // Try to find existing lead
    const Lead = (await import('../models/Lead')).default;
    let lead = await Lead.findOne({ email: email.toLowerCase().trim() });

    if (lead) {
      // Update existing lead with newsletter subscription
      if (!lead.tags.includes('newsletter')) {
        lead.tags.push('newsletter');
      }
      lead.emailConsent = true;
      lead.lastActivityAt = new Date();
      await lead.save();

      logger.info(`Existing lead subscribed to newsletter: ${email}`);
    } else {
      // Create new lead
      lead = new Lead({
        email: email.toLowerCase().trim(),
        source: {
          type: 'organic',
          name: 'Footer Newsletter',
          page: '/',
        },
        tags: ['newsletter'],
        emailConsent: true,
        status: 'new',
        capturedAt: new Date(),
        lastActivityAt: new Date(),
      });
      await lead.save();

      logger.info(`New newsletter subscriber captured: ${email}`);
    }

    res.status(200).json({
      success: true,
      message: 'Successfully subscribed to newsletter',
    });
  } catch (error) {
    logger.error('Error subscribing to newsletter:', error);
    next(error);
  }
};

export default {
  createLead,
  getLead,
  listLeads,
  updateLead,
  deleteLead,
  searchLeads,
  getAllTags,
  addTag,
  removeTag,
  bulkUpdate,
  bulkDelete,
  getStats,
  importLeads,
  exportLeads,
  mergeLeads,
  captureBootcampInterest,
  subscribeNewsletter,
};
