import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import campaignService from '../services/campaignService';
import { CampaignStatus, CampaignType } from '../models/EmailCampaign';
import logger from '../utils/logger';

/**
 * Campaign Controller - HTTP request handlers for campaign management
 */

/**
 * Create campaign
 * POST /admin/campaigns
 */
export const createCampaign = async (
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
      name,
      description,
      type,
      templateId,
      subject,
      preheader,
      fromName,
      fromEmail,
      replyTo,
      audience,
      scheduling,
      abTest,
      templateContext,
      tags,
    } = req.body;

    const campaign = await campaignService.createCampaign({
      name,
      description,
      type,
      templateId,
      subject,
      preheader,
      fromName,
      fromEmail,
      replyTo,
      audience,
      scheduling,
      abTest,
      templateContext,
      tags,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign by ID
 * GET /admin/campaigns/:id
 */
export const getCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await campaignService.getCampaign(id);
    if (!campaign) {
      res.status(404).json({
        success: false,
        error: { message: 'Campaign not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List campaigns
 * GET /admin/campaigns
 */
export const listCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      type,
      search,
      tags,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await campaignService.listCampaigns({
      status: status as CampaignStatus,
      type: type as CampaignType,
      search: search as string,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
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
 * Update campaign
 * PUT /admin/campaigns/:id
 */
export const updateCampaign = async (
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
      name,
      description,
      type,
      templateId,
      subject,
      preheader,
      fromName,
      fromEmail,
      replyTo,
      audience,
      scheduling,
      abTest,
      templateContext,
      tags,
    } = req.body;

    const campaign = await campaignService.updateCampaign(id, {
      name,
      description,
      type,
      templateId,
      subject,
      preheader,
      fromName,
      fromEmail,
      replyTo,
      audience,
      scheduling,
      abTest,
      templateContext,
      tags,
      updatedBy: req.userId || 'system',
    });

    if (!campaign) {
      res.status(404).json({
        success: false,
        error: { message: 'Campaign not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete campaign
 * DELETE /admin/campaigns/:id
 */
export const deleteCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await campaignService.deleteCampaign(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Campaign not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Schedule campaign
 * POST /admin/campaigns/:id/schedule
 */
export const scheduleCampaign = async (
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
    const { sendAt } = req.body;

    const campaign = await campaignService.scheduleCampaign(
      id,
      new Date(sendAt),
      req.userId || 'system'
    );

    res.json({
      success: true,
      data: campaign,
      message: `Campaign scheduled for ${new Date(sendAt).toISOString()}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send campaign immediately
 * POST /admin/campaigns/:id/send
 */
export const sendCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await campaignService.sendCampaign(id, req.userId || 'system');

    res.json({
      success: true,
      data: {
        jobId: result.jobId,
        recipientCount: result.recipientCount,
      },
      message: `Campaign sending started to ${result.recipientCount} recipients`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause campaign
 * POST /admin/campaigns/:id/pause
 */
export const pauseCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await campaignService.pauseCampaign(id, req.userId || 'system');

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign paused successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel campaign
 * POST /admin/campaigns/:id/cancel
 */
export const cancelCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await campaignService.cancelCampaign(id, req.userId || 'system');

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign statistics
 * GET /admin/campaigns/:id/stats
 */
export const getCampaignStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const stats = await campaignService.getCampaignStats(id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview campaign
 * POST /admin/campaigns/:id/preview
 */
export const previewCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { context } = req.body;

    const preview = await campaignService.previewCampaign(id, context);

    res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Duplicate campaign
 * POST /admin/campaigns/:id/duplicate
 */
export const duplicateCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await campaignService.duplicateCampaign(id, req.userId || 'system');

    res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign duplicated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  scheduleCampaign,
  sendCampaign,
  pauseCampaign,
  cancelCampaign,
  getCampaignStats,
  previewCampaign,
  duplicateCampaign,
};
