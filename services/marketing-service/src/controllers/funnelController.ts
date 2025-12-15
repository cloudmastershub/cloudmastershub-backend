import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import funnelService from '../services/funnelService';
import funnelParticipantService from '../services/funnelParticipantService';
import { FunnelStatus, FunnelType } from '../models';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Funnel Controller - HTTP request handlers
 */

/**
 * Create a new funnel
 * POST /admin/funnels
 */
export const createFunnel = async (
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

    const { name, slug, description, type, settings, design, tags } = req.body;

    const funnel = await funnelService.create({
      name,
      slug,
      description,
      type,
      settings,
      design,
      tags,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: funnel,
      message: 'Funnel created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get funnel by ID
 * GET /admin/funnels/:id
 */
export const getFunnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const funnel = await funnelService.getById(id);
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get funnel by slug
 * GET /admin/funnels/slug/:slug
 */
export const getFunnelBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    const funnel = await funnelService.getBySlug(slug);
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List funnels with pagination
 * GET /admin/funnels
 */
export const listFunnels = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      type,
      search,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await funnelService.list({
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      status: status as FunnelStatus,
      type: type as FunnelType,
      search: search as string,
      tags: tags ? (tags as string).split(',') : undefined,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      createdBy: req.query.createdBy as string,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update funnel
 * PUT /admin/funnels/:id
 */
export const updateFunnel = async (
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
    const { name, slug, description, type, settings, design, tags } = req.body;

    const funnel = await funnelService.update(id, {
      name,
      slug,
      description,
      type,
      settings,
      design,
      tags,
      updatedBy: req.userId || 'system',
    });

    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Funnel updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete funnel
 * DELETE /admin/funnels/:id
 */
export const deleteFunnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await funnelService.delete(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Funnel deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publish funnel
 * POST /admin/funnels/:id/publish
 */
export const publishFunnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const funnel = await funnelService.publish(id, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Funnel published successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unpublish (pause) funnel
 * POST /admin/funnels/:id/unpublish
 */
export const unpublishFunnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const funnel = await funnelService.unpublish(id, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Funnel paused successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive funnel
 * POST /admin/funnels/:id/archive
 */
export const archiveFunnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const funnel = await funnelService.archive(id, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Funnel archived successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Duplicate funnel
 * POST /admin/funnels/:id/duplicate
 */
export const duplicateFunnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const funnel = await funnelService.duplicate(id, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: funnel,
      message: 'Funnel duplicated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update funnel steps
 * PUT /admin/funnels/:id/steps
 */
export const updateFunnelSteps = async (
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
    const { steps } = req.body;

    const funnel = await funnelService.updateSteps(id, steps, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Funnel steps updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add step to funnel
 * POST /admin/funnels/:id/steps
 */
export const addFunnelStep = async (
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
    const step = req.body;

    const funnel = await funnelService.addStep(id, step, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: funnel,
      message: 'Step added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove step from funnel
 * DELETE /admin/funnels/:id/steps/:stepId
 */
export const removeFunnelStep = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, stepId } = req.params;

    const funnel = await funnelService.removeStep(id, stepId, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Step removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a step in funnel
 * PUT /admin/funnels/:id/steps/:stepId
 */
export const updateFunnelStep = async (
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

    const { id, stepId } = req.params;
    const stepData = req.body;

    const funnel = await funnelService.updateStep(id, stepId, stepData, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Step updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder funnel steps
 * POST /admin/funnels/:id/steps/reorder
 */
export const reorderFunnelSteps = async (
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
    const { stepIds } = req.body;

    const funnel = await funnelService.reorderSteps(id, stepIds, req.userId || 'system');
    if (!funnel) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: funnel,
      message: 'Steps reordered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get funnel analytics
 * GET /admin/funnels/:id/analytics
 */
export const getFunnelAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const analytics = await funnelService.getAnalytics(id);
    if (!analytics) {
      res.status(404).json({
        success: false,
        error: { message: 'Funnel not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public funnel by slug with access control
 * GET /f/:slug
 */
export const getPublicFunnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    // Get session token from cookie or header
    const sessionToken = req.cookies?.funnel_session || req.headers['x-funnel-session'] as string;
    const email = req.query.email as string;

    // Get funnel with access control
    const result = await funnelParticipantService.getPublicFunnelWithAccess(
      slug,
      (sessionToken || email) ? { sessionToken, email } : undefined
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register for a funnel (create participant)
 * POST /f/:slug/register
 */
export const registerForFunnel = async (
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

    const { slug } = req.params;
    const {
      email,
      firstName,
      lastName,
      phone,
      customFields,
      source,
      emailConsent,
    } = req.body;

    const result = await funnelParticipantService.register(slug, {
      email,
      firstName,
      lastName,
      phone,
      customFields,
      source,
      emailConsent,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      timezone: req.headers['x-timezone'] as string,
    });

    // Set session cookie
    res.cookie('funnel_session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(201).json({
      success: true,
      data: {
        registered: true,
        sessionToken: result.sessionToken,
        nextStepId: result.nextStepId,
        participant: {
          email: result.participant.email,
          firstName: result.participant.firstName,
          currentStepId: result.participant.currentStepId,
          currentStepOrder: result.participant.currentStepOrder,
          completedStepIds: result.participant.completedStepIds,
        },
      },
      message: 'Successfully registered for funnel',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get participant progress
 * GET /f/:slug/progress
 */
export const getParticipantProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const sessionToken = req.cookies?.funnel_session || req.headers['x-funnel-session'] as string;
    const email = req.query.email as string;

    if (!sessionToken && !email) {
      res.status(401).json({
        success: false,
        error: { message: 'No session token or email provided' },
      });
      return;
    }

    const participant = await funnelParticipantService.getParticipant(slug, { sessionToken, email });
    if (!participant) {
      res.status(404).json({
        success: false,
        error: { message: 'Not registered for this funnel' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        currentStepId: participant.currentStepId,
        currentStepOrder: participant.currentStepOrder,
        completedStepIds: participant.completedStepIds,
        stepProgress: participant.stepProgress,
        status: participant.status,
        registeredAt: participant.registeredAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete a funnel step
 * POST /f/:slug/steps/:stepId/complete
 */
export const completeFunnelStep = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug, stepId } = req.params;
    const sessionToken = req.cookies?.funnel_session || req.headers['x-funnel-session'] as string;
    const email = req.body.email || req.query.email as string;

    if (!sessionToken && !email) {
      res.status(401).json({
        success: false,
        error: { message: 'No session token or email provided' },
      });
      return;
    }

    const { videoWatchPercent, timeSpentSeconds } = req.body;

    const result = await funnelParticipantService.completeStep(
      slug,
      stepId,
      { sessionToken, email },
      { videoWatchPercent, timeSpentSeconds }
    );

    res.json({
      success: true,
      data: result,
      message: 'Step completed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get step content with access check
 * GET /f/:slug/steps/:stepId
 */
export const getStepContent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug, stepId } = req.params;
    const sessionToken = req.cookies?.funnel_session || req.headers['x-funnel-session'] as string;
    const email = req.query.email as string;

    const result = await funnelParticipantService.getStepContent(
      slug,
      stepId,
      (sessionToken || email) ? { sessionToken, email } : undefined
    );

    if (!result.isAccessible) {
      res.status(403).json({
        success: false,
        error: { message: 'Step is not accessible. Please complete previous steps first.' },
        data: {
          step: {
            id: result.step.id,
            name: result.step.name,
            type: result.step.type,
            order: result.step.order,
          },
          isAccessible: false,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        step: result.step,
        isAccessible: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createFunnel,
  getFunnel,
  getFunnelBySlug,
  listFunnels,
  updateFunnel,
  deleteFunnel,
  publishFunnel,
  unpublishFunnel,
  archiveFunnel,
  duplicateFunnel,
  updateFunnelSteps,
  addFunnelStep,
  removeFunnelStep,
  updateFunnelStep,
  reorderFunnelSteps,
  getFunnelAnalytics,
  getPublicFunnel,
  registerForFunnel,
  getParticipantProgress,
  completeFunnelStep,
  getStepContent,
};
