import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import emailService from '../services/emailService';
import logger from '../utils/logger';

/**
 * Email Controller - HTTP request handlers for email operations
 */

// ==========================================
// Email Template Management
// ==========================================

/**
 * Create email template
 * POST /admin/email-templates
 */
export const createTemplate = async (
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
      slug,
      description,
      category,
      subject,
      htmlContent,
      textContent,
      variables,
      tags,
    } = req.body;

    const template = await emailService.createTemplate({
      name,
      slug,
      description,
      category,
      subject,
      htmlContent,
      textContent,
      variables,
      tags,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'Email template created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get email template by ID
 * GET /admin/email-templates/:id
 */
export const getTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await emailService.getTemplate(id);
    if (!template) {
      res.status(404).json({
        success: false,
        error: { message: 'Email template not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List email templates
 * GET /admin/email-templates
 */
export const listTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      category,
      status,
      search,
      page = '1',
      limit = '20',
    } = req.query;

    const result = await emailService.listTemplates({
      category: category as string,
      status: status as string,
      search: search as string,
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
 * Update email template
 * PUT /admin/email-templates/:id
 */
export const updateTemplate = async (
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
      subject,
      htmlContent,
      textContent,
      variables,
      tags,
      status,
    } = req.body;

    const template = await emailService.updateTemplate(id, {
      name,
      description,
      subject,
      htmlContent,
      textContent,
      variables,
      tags,
      status,
      updatedBy: req.userId || 'system',
    });

    if (!template) {
      res.status(404).json({
        success: false,
        error: { message: 'Email template not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: template,
      message: 'Email template updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete email template
 * DELETE /admin/email-templates/:id
 */
export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await emailService.deleteTemplate(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Email template not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Email template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview email template with sample data
 * POST /admin/email-templates/:id/preview
 */
export const previewTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { context } = req.body;

    const template = await emailService.getTemplate(id);
    if (!template) {
      res.status(404).json({
        success: false,
        error: { message: 'Email template not found' },
      });
      return;
    }

    // Use Handlebars to render preview
    const Handlebars = await import('handlebars');
    const sampleContext = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      challengeName: 'Sample Challenge',
      dayNumber: 1,
      dayTitle: 'Getting Started',
      currentYear: new Date().getFullYear(),
      unsubscribeLink: '#',
      ...context,
    };

    const compiledSubject = Handlebars.compile(template.subject);
    const compiledHtml = Handlebars.compile(template.htmlContent);

    res.json({
      success: true,
      data: {
        subject: compiledSubject(sampleContext),
        html: compiledHtml(sampleContext),
        variables: template.variables,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send test email
 * POST /admin/email-templates/:id/test
 */
export const sendTestEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { testEmail, context } = req.body;

    if (!testEmail) {
      res.status(400).json({
        success: false,
        error: { message: 'Test email address is required' },
      });
      return;
    }

    const result = await emailService.sendTemplatedEmail(id, testEmail, {
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      ...context,
    });

    res.json({
      success: true,
      data: { messageId: result.messageId },
      message: `Test email sent to ${testEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Email Sequence Management
// ==========================================

/**
 * Create email sequence
 * POST /admin/email-sequences
 */
export const createSequence = async (
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

    const { name, slug, description, triggerType, emails, tags } = req.body;

    const sequence = await emailService.createSequence({
      name,
      slug,
      description,
      triggerType,
      emails,
      tags,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: sequence,
      message: 'Email sequence created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get email sequence by ID
 * GET /admin/email-sequences/:id
 */
export const getSequence = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const sequence = await emailService.getSequence(id);
    if (!sequence) {
      res.status(404).json({
        success: false,
        error: { message: 'Email sequence not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: sequence,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List email sequences
 * GET /admin/email-sequences
 */
export const listSequences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      triggerType,
      page = '1',
      limit = '20',
    } = req.query;

    const result = await emailService.listSequences({
      status: status as string,
      triggerType: triggerType as string,
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

// ==========================================
// Direct Email Sending
// ==========================================

/**
 * Send email to a lead
 * POST /admin/email/send
 */
export const sendEmail = async (
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

    const { to, toName, templateId, subject, html, context, tags } = req.body;

    let result;
    if (templateId) {
      result = await emailService.sendTemplatedEmail(templateId, to, context || {}, {
        toName,
        tags,
      });
    } else if (subject && html) {
      result = await emailService.sendEmail({
        to,
        toName,
        subject,
        html,
        tags,
      });
    } else {
      res.status(400).json({
        success: false,
        error: { message: 'Either templateId or subject+html is required' },
      });
      return;
    }

    res.json({
      success: true,
      data: { messageId: result.messageId },
      message: `Email sent to ${to}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send bulk email
 * POST /admin/email/bulk
 */
export const sendBulkEmail = async (
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

    const { recipients, templateId, baseContext } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Recipients array is required' },
      });
      return;
    }

    if (recipients.length > 1000) {
      res.status(400).json({
        success: false,
        error: { message: 'Maximum 1000 recipients per request' },
      });
      return;
    }

    const result = await emailService.sendBulkEmail(recipients, templateId, baseContext);

    res.json({
      success: true,
      data: result,
      message: `Bulk email completed: ${result.success} sent, ${result.failed} failed`,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  // Templates
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  sendTestEmail,
  // Sequences
  createSequence,
  getSequence,
  listSequences,
  // Direct sending
  sendEmail,
  sendBulkEmail,
};
