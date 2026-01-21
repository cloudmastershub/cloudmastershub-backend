import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import workflowService from '../services/workflowService';
import { WorkflowStatus, WorkflowTriggerType } from '../models/Workflow';
import { WorkflowParticipantStatus } from '../models/WorkflowParticipant';
import logger from '../utils/logger';

/**
 * Workflow Controller - HTTP request handlers for workflow automation
 */

/**
 * Create workflow
 * POST /admin/workflows
 */
export const createWorkflow = async (
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
      trigger,
      nodes,
      edges,
      settings,
      folder,
      tags,
    } = req.body;

    const workflow = await workflowService.createWorkflow({
      name,
      description,
      trigger,
      nodes,
      edges,
      settings,
      folder,
      tags,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: workflow,
      message: 'Workflow created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get workflow by ID
 * GET /admin/workflows/:id
 */
export const getWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const workflow = await workflowService.getWorkflow(id);
    if (!workflow) {
      res.status(404).json({
        success: false,
        error: { message: 'Workflow not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List workflows
 * GET /admin/workflows
 */
export const listWorkflows = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      triggerType,
      folder,
      tags,
      search,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await workflowService.listWorkflows({
      status: status as WorkflowStatus,
      triggerType: triggerType as WorkflowTriggerType,
      folder: folder as string,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      search: search as string,
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
 * Update workflow
 * PUT /admin/workflows/:id
 */
export const updateWorkflow = async (
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
      trigger,
      nodes,
      edges,
      settings,
      folder,
      tags,
    } = req.body;

    const workflow = await workflowService.updateWorkflow(id, {
      name,
      description,
      trigger,
      nodes,
      edges,
      settings,
      folder,
      tags,
      updatedBy: req.userId || 'system',
    });

    if (!workflow) {
      res.status(404).json({
        success: false,
        error: { message: 'Workflow not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: workflow,
      message: 'Workflow updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete workflow
 * DELETE /admin/workflows/:id
 */
export const deleteWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await workflowService.deleteWorkflow(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Workflow not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Activate workflow
 * POST /admin/workflows/:id/activate
 */
export const activateWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const workflow = await workflowService.activateWorkflow(id, req.userId || 'system');

    res.json({
      success: true,
      data: workflow,
      message: 'Workflow activated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause workflow
 * POST /admin/workflows/:id/pause
 */
export const pauseWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const workflow = await workflowService.pauseWorkflow(id, req.userId || 'system');

    res.json({
      success: true,
      data: workflow,
      message: 'Workflow paused successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive workflow
 * POST /admin/workflows/:id/archive
 */
export const archiveWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const workflow = await workflowService.archiveWorkflow(id, req.userId || 'system');

    res.json({
      success: true,
      data: workflow,
      message: 'Workflow archived successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Duplicate workflow
 * POST /admin/workflows/:id/duplicate
 */
export const duplicateWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const workflow = await workflowService.duplicateWorkflow(id, req.userId || 'system');

    res.status(201).json({
      success: true,
      data: workflow,
      message: 'Workflow duplicated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get workflow statistics
 * GET /admin/workflows/:id/stats
 */
export const getWorkflowStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const stats = await workflowService.getWorkflowStats(id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get workflow participants
 * GET /admin/workflows/:id/participants
 */
export const getWorkflowParticipants = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, page = '1', limit = '20' } = req.query;

    const result = await workflowService.getWorkflowParticipants(id, {
      status: status as WorkflowParticipantStatus,
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
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
 * Manually enroll lead in workflow
 * POST /admin/workflows/:id/enroll
 */
export const enrollLead = async (
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
    const { leadId, triggerData } = req.body;

    const participant = await workflowService.enrollLead(id, leadId, triggerData);

    res.status(201).json({
      success: true,
      data: participant,
      message: 'Lead enrolled in workflow successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove lead from workflow
 * DELETE /admin/workflows/:id/participants/:leadId
 */
export const removeLead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, leadId } = req.params;
    const { reason } = req.body;

    const removed = await workflowService.removeLead(id, leadId, reason || 'Manually removed');

    if (!removed) {
      res.status(404).json({
        success: false,
        error: { message: 'Lead is not enrolled in this workflow' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Lead removed from workflow successfully',
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  activateWorkflow,
  pauseWorkflow,
  archiveWorkflow,
  duplicateWorkflow,
  getWorkflowStats,
  getWorkflowParticipants,
  enrollLead,
  removeLead,
};
