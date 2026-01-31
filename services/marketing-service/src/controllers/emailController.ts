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

/**
 * Update email sequence
 * PUT /admin/email/sequences/:id
 */
export const updateSequence = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || 'system';

    const { name, description, status, triggerType, triggerConfig, emails, tags } = req.body;

    const sequence = await emailService.updateSequence(id, {
      name,
      description,
      status,
      triggerType,
      triggerConfig,
      emails,
      tags,
      updatedBy: userId,
    });

    if (!sequence) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sequence not found' },
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
 * Delete email sequence
 * DELETE /admin/email/sequences/:id
 */
export const deleteSequence = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await emailService.deleteSequence(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sequence not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Sequence deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Email Dashboard Stats
// ==========================================

/**
 * Get email dashboard statistics
 * GET /admin/email/stats
 */
export const getEmailDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Import models dynamically to avoid circular dependencies
    const EmailCampaign = (await import('../models/EmailCampaign')).default;
    const EmailTemplate = (await import('../models/EmailTemplate')).default;
    const EmailSequence = (await import('../models/EmailSequence')).default;
    const Lead = (await import('../models/Lead')).default;
    const Segment = (await import('../models/Segment')).default;

    // Run all aggregations in parallel for performance
    const [
      campaignStats,
      templateStats,
      sequenceStats,
      leadStats,
      segmentStats,
      recentCampaigns,
    ] = await Promise.all([
      // Campaign statistics
      EmailCampaign.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            metrics: [
              {
                $group: {
                  _id: null,
                  totalSent: { $sum: '$metrics.sent' },
                  totalDelivered: { $sum: '$metrics.delivered' },
                  totalOpened: { $sum: '$metrics.opened' },
                  totalClicked: { $sum: '$metrics.clicked' },
                  totalBounced: { $sum: '$metrics.bounced' },
                  totalUnsubscribed: { $sum: '$metrics.unsubscribed' },
                },
              },
            ],
          },
        },
      ]),

      // Template statistics
      EmailTemplate.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            byCategory: [
              { $group: { _id: '$category', count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // Sequence statistics
      EmailSequence.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            totalEnrolled: [
              {
                $group: {
                  _id: null,
                  enrolled: { $sum: '$metrics.totalEnrolled' },
                  completed: { $sum: '$metrics.totalCompleted' },
                },
              },
            ],
          },
        },
      ]),

      // Lead/subscriber statistics
      Lead.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            subscribed: [
              { $match: { emailConsent: true } },
              { $count: 'count' },
            ],
            unsubscribed: [
              { $match: { emailConsent: false } },
              { $count: 'count' },
            ],
            recentLeads: [
              { $match: { capturedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
              { $count: 'count' },
            ],
          },
        },
      ]),

      // Segment statistics
      Segment.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            byType: [
              { $group: { _id: '$type', count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // Recent campaigns (last 10)
      EmailCampaign.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name subject status type metrics.sent metrics.opened metrics.clicked scheduledFor sentAt createdAt')
        .lean(),
    ]);

    // Process campaign stats
    const campaignData = campaignStats[0];
    const totalCampaigns = campaignData.total[0]?.count || 0;
    const campaignsByStatus = campaignData.byStatus.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const campaignMetrics = campaignData.metrics[0] || {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      totalUnsubscribed: 0,
    };

    // Process template stats
    const templateData = templateStats[0];
    const totalTemplates = templateData.total[0]?.count || 0;
    const templatesByStatus = templateData.byStatus.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const templatesByCategory = templateData.byCategory.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Process sequence stats
    const sequenceData = sequenceStats[0];
    const totalSequences = sequenceData.total[0]?.count || 0;
    const sequencesByStatus = sequenceData.byStatus.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const sequenceEnrollment = sequenceData.totalEnrolled[0] || { enrolled: 0, completed: 0 };

    // Process lead stats
    const leadData = leadStats[0];
    const totalLeads = leadData.total[0]?.count || 0;
    const leadsByStatus = leadData.byStatus.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const subscribedCount = leadData.subscribed[0]?.count || 0;
    const unsubscribedCount = leadData.unsubscribed[0]?.count || 0;
    const recentLeadsCount = leadData.recentLeads[0]?.count || 0;

    // Process segment stats
    const segmentData = segmentStats[0];
    const totalSegments = segmentData.total[0]?.count || 0;
    const segmentsByType = segmentData.byType.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Calculate derived metrics
    const openRate = campaignMetrics.totalSent > 0
      ? (campaignMetrics.totalOpened / campaignMetrics.totalSent * 100).toFixed(2)
      : '0.00';
    const clickRate = campaignMetrics.totalOpened > 0
      ? (campaignMetrics.totalClicked / campaignMetrics.totalOpened * 100).toFixed(2)
      : '0.00';
    const bounceRate = campaignMetrics.totalSent > 0
      ? (campaignMetrics.totalBounced / campaignMetrics.totalSent * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      data: {
        overview: {
          totalSent: campaignMetrics.totalSent,
          totalDelivered: campaignMetrics.totalDelivered,
          totalOpened: campaignMetrics.totalOpened,
          totalClicked: campaignMetrics.totalClicked,
          openRate: parseFloat(openRate),
          clickRate: parseFloat(clickRate),
          bounceRate: parseFloat(bounceRate),
          unsubscribeRate: campaignMetrics.totalSent > 0
            ? parseFloat((campaignMetrics.totalUnsubscribed / campaignMetrics.totalSent * 100).toFixed(2))
            : 0,
        },
        campaigns: {
          total: totalCampaigns,
          byStatus: campaignsByStatus,
        },
        templates: {
          total: totalTemplates,
          byStatus: templatesByStatus,
          byCategory: templatesByCategory,
        },
        sequences: {
          total: totalSequences,
          byStatus: sequencesByStatus,
          totalEnrolled: sequenceEnrollment.enrolled,
          totalCompleted: sequenceEnrollment.completed,
        },
        segments: {
          total: totalSegments,
          byType: segmentsByType,
        },
        leads: {
          total: totalLeads,
          byStatus: leadsByStatus,
          subscribed: subscribedCount,
          unsubscribed: unsubscribedCount,
          newThisWeek: recentLeadsCount,
        },
        recentCampaigns: recentCampaigns.map((campaign: any) => ({
          id: campaign._id,
          name: campaign.name,
          subject: campaign.subject,
          status: campaign.status,
          type: campaign.type,
          sent: campaign.metrics?.sent || 0,
          opened: campaign.metrics?.opened || 0,
          clicked: campaign.metrics?.clicked || 0,
          openRate: campaign.metrics?.sent > 0
            ? parseFloat(((campaign.metrics.opened || 0) / campaign.metrics.sent * 100).toFixed(2))
            : 0,
          scheduledFor: campaign.scheduledFor,
          sentAt: campaign.sentAt,
          createdAt: campaign.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching email dashboard stats:', error);
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

/**
 * Internal email sending for service-to-service communication
 * POST /internal/send
 * Requires x-internal-service header
 */
export const sendInternalEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify internal service header
    const internalHeader = req.headers['x-internal-service'];
    if (internalHeader !== 'true') {
      res.status(403).json({
        success: false,
        error: { message: 'Internal service access required' },
      });
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { to, toName, subject, html, tags } = req.body;

    const result = await emailService.sendEmail({
      to,
      toName,
      subject,
      html,
      tags: tags || ['internal', 'transactional'],
    });

    logger.info('Internal email sent', { to, subject, messageId: result.messageId });

    res.json({
      success: true,
      data: { messageId: result.messageId },
    });
  } catch (error) {
    logger.error('Internal email send failed:', error);
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
  updateSequence,
  deleteSequence,
  // Direct sending
  sendEmail,
  sendBulkEmail,
  // Internal
  sendInternalEmail,
  // Dashboard
  getEmailDashboardStats,
};
