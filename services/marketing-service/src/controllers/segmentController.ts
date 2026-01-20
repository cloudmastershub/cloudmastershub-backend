import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import segmentService from '../services/segmentService';
import { SEGMENT_FIELDS, OPERATORS_BY_TYPE } from '../models/Segment';
import logger from '../utils/logger';

/**
 * Segment Controller - HTTP request handlers for audience segmentation
 */

/**
 * Create segment
 * POST /admin/segments
 */
export const createSegment = async (
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

    const { name, description, type, rootGroup, leadIds, tags } = req.body;

    const segment = await segmentService.createSegment({
      name,
      description,
      type,
      rootGroup,
      leadIds,
      tags,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: segment,
      message: 'Segment created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get segment by ID
 * GET /admin/segments/:id
 */
export const getSegment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const segment = await segmentService.getSegment(id);
    if (!segment) {
      res.status(404).json({
        success: false,
        error: { message: 'Segment not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: segment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List segments
 * GET /admin/segments
 */
export const listSegments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type,
      search,
      tags,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await segmentService.listSegments({
      type: type as 'static' | 'dynamic',
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
 * Update segment
 * PUT /admin/segments/:id
 */
export const updateSegment = async (
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
    const { name, description, rootGroup, leadIds, tags } = req.body;

    const segment = await segmentService.updateSegment(id, {
      name,
      description,
      rootGroup,
      leadIds,
      tags,
      updatedBy: req.userId || 'system',
    });

    if (!segment) {
      res.status(404).json({
        success: false,
        error: { message: 'Segment not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: segment,
      message: 'Segment updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete segment
 * DELETE /admin/segments/:id
 */
export const deleteSegment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await segmentService.deleteSegment(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Segment not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Segment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview segment (estimate size without saving)
 * POST /admin/segments/preview
 */
export const previewSegment = async (
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

    const { rootGroup } = req.body;

    const preview = await segmentService.previewSegment(rootGroup);

    res.json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate segment size
 * POST /admin/segments/:id/calculate
 */
export const calculateSegmentSize = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await segmentService.recalculateSize(id);

    res.json({
      success: true,
      data: result,
      message: 'Segment size calculated',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leads in segment
 * GET /admin/segments/:id/leads
 */
export const getSegmentLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '50' } = req.query;

    const result = await segmentService.getSegmentLeads(id, {
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
 * Get available segment fields
 * GET /admin/segments/fields
 */
export const getSegmentFields = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        fields: SEGMENT_FIELDS,
        operators: OPERATORS_BY_TYPE,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createSegment,
  getSegment,
  listSegments,
  updateSegment,
  deleteSegment,
  previewSegment,
  calculateSegmentSize,
  getSegmentLeads,
  getSegmentFields,
};
