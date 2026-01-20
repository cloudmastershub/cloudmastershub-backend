import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import mailingListService from '../services/mailingListService';
import { MailingListType } from '../models/MailingList';
import logger from '../utils/logger';

/**
 * Mailing List Controller - HTTP request handlers for mailing list management
 */

/**
 * Create mailing list
 * POST /admin/mailing-lists
 */
export const createMailingList = async (
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

    const { name, description, type, segmentId, memberIds, doubleOptIn, welcomeEmailTemplateId, tags } = req.body;

    const mailingList = await mailingListService.createMailingList({
      name,
      description,
      type,
      segmentId,
      memberIds,
      doubleOptIn,
      welcomeEmailTemplateId,
      tags,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: mailingList,
      message: 'Mailing list created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get mailing list by ID
 * GET /admin/mailing-lists/:id
 */
export const getMailingList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const mailingList = await mailingListService.getMailingList(id);
    if (!mailingList) {
      res.status(404).json({
        success: false,
        error: { message: 'Mailing list not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: mailingList,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List mailing lists
 * GET /admin/mailing-lists
 */
export const listMailingLists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type,
      status,
      search,
      tags,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await mailingListService.listMailingLists({
      type: type as MailingListType,
      status: status as any,
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
 * Update mailing list
 * PUT /admin/mailing-lists/:id
 */
export const updateMailingList = async (
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
    const { name, description, segmentId, doubleOptIn, welcomeEmailTemplateId, tags } = req.body;

    const mailingList = await mailingListService.updateMailingList(id, {
      name,
      description,
      segmentId,
      doubleOptIn,
      welcomeEmailTemplateId,
      tags,
      updatedBy: req.userId || 'system',
    });

    if (!mailingList) {
      res.status(404).json({
        success: false,
        error: { message: 'Mailing list not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: mailingList,
      message: 'Mailing list updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete mailing list
 * DELETE /admin/mailing-lists/:id
 */
export const deleteMailingList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await mailingListService.deleteMailingList(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Mailing list not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Mailing list deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive mailing list
 * POST /admin/mailing-lists/:id/archive
 */
export const archiveMailingList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const mailingList = await mailingListService.archiveMailingList(id, req.userId || 'system');
    if (!mailingList) {
      res.status(404).json({
        success: false,
        error: { message: 'Mailing list not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: mailingList,
      message: 'Mailing list archived successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Restore archived mailing list
 * POST /admin/mailing-lists/:id/restore
 */
export const restoreMailingList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const mailingList = await mailingListService.restoreMailingList(id, req.userId || 'system');
    if (!mailingList) {
      res.status(404).json({
        success: false,
        error: { message: 'Mailing list not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: mailingList,
      message: 'Mailing list restored successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Duplicate mailing list
 * POST /admin/mailing-lists/:id/duplicate
 */
export const duplicateMailingList = async (
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
    const { name } = req.body;

    const mailingList = await mailingListService.duplicateMailingList(id, name, req.userId || 'system');

    res.status(201).json({
      success: true,
      data: mailingList,
      message: 'Mailing list duplicated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get members of a mailing list
 * GET /admin/mailing-lists/:id/members
 */
export const getMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '50', status } = req.query;

    const result = await mailingListService.getMembers(id, {
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      status: status as any,
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
 * Add members to a static mailing list
 * POST /admin/mailing-lists/:id/members
 */
export const addMembers = async (
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
    const { leadIds } = req.body;

    const mailingList = await mailingListService.addMembers(id, leadIds, req.userId || 'system');

    res.json({
      success: true,
      data: mailingList,
      message: `Members added to mailing list`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove members from a static mailing list
 * DELETE /admin/mailing-lists/:id/members
 */
export const removeMembers = async (
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
    const { leadIds } = req.body;

    const mailingList = await mailingListService.removeMembers(id, leadIds, req.userId || 'system');

    res.json({
      success: true,
      data: mailingList,
      message: 'Members removed from mailing list',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Import members from CSV data
 * POST /admin/mailing-lists/:id/import
 */
export const importMembers = async (
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
    const { members } = req.body;

    const result = await mailingListService.importMembers(id, members, req.userId || 'system');

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
 * Export members to array format
 * GET /admin/mailing-lists/:id/export
 */
export const exportMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const members = await mailingListService.exportMembers(id);

    res.json({
      success: true,
      data: members,
      total: members.length,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createMailingList,
  getMailingList,
  listMailingLists,
  updateMailingList,
  deleteMailingList,
  archiveMailingList,
  restoreMailingList,
  duplicateMailingList,
  getMembers,
  addMembers,
  removeMembers,
  importMembers,
  exportMembers,
};
