import { Request, Response } from 'express';
import crypto from 'crypto';
import { EmailQueueJob, EmailJobStatus, IEmailQueueJob } from '../models/EmailQueueJob';
import { Lead, LeadStatus, ILead } from '../models/Lead';
import { EmailSequence } from '../models/EmailSequence';
import { EmailTemplate } from '../models/EmailTemplate';
import { ConversionEvent, ConversionEventType } from '../models/ConversionEvent';
import logger from '../utils/logger';

// Helper type for email job documents
type EmailJobDoc = (IEmailQueueJob & { save(): Promise<any> }) | null;

// Mailgun webhook signing key
const MAILGUN_WEBHOOK_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || '';

/**
 * Verify Mailgun webhook signature
 */
function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  if (!MAILGUN_WEBHOOK_KEY) {
    logger.warn('MAILGUN_WEBHOOK_SIGNING_KEY not set - skipping signature verification');
    return true; // Skip verification in development
  }

  const encodedToken = crypto
    .createHmac('sha256', MAILGUN_WEBHOOK_KEY)
    .update(timestamp + token)
    .digest('hex');

  return encodedToken === signature;
}

/**
 * Mailgun Webhook Event Types
 */
type MailgunEventType =
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'unsubscribed'
  | 'complained'
  | 'failed'
  | 'permanent_fail'
  | 'temporary_fail';

/**
 * Mailgun Webhook Payload
 */
interface MailgunWebhookPayload {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    id: string;
    event: MailgunEventType;
    timestamp: number;
    recipient: string;
    'user-variables'?: {
      jobId?: string;
      trackingId?: string;
      templateId?: string;
      sequenceId?: string;
      campaignId?: string;
    };
    'delivery-status'?: {
      code?: number;
      message?: string;
      description?: string;
      'bounce-code'?: string;
    };
    message?: {
      headers: {
        'message-id'?: string;
        to?: string;
        from?: string;
        subject?: string;
      };
    };
    url?: string; // For click events
    tags?: string[];
  };
}

/**
 * Handle Mailgun webhook events
 * POST /webhooks/mailgun
 */
export const handleMailgunWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body as MailgunWebhookPayload;

    // Verify signature
    if (payload.signature) {
      const isValid = verifyMailgunSignature(
        payload.signature.timestamp,
        payload.signature.token,
        payload.signature.signature
      );

      if (!isValid) {
        logger.warn('Invalid Mailgun webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const eventData = payload['event-data'];
    if (!eventData) {
      return res.status(400).json({ error: 'Missing event-data' });
    }

    const { event, recipient } = eventData;
    const userVars = eventData['user-variables'] || {};
    const jobId = userVars.jobId;
    const messageId = eventData.message?.headers?.['message-id'];

    logger.info(`Mailgun webhook: ${event}`, {
      recipient,
      jobId,
      messageId,
    });

    // Process based on event type
    switch (event) {
      case 'delivered':
        await handleDelivered(eventData, jobId, messageId);
        break;

      case 'opened':
        await handleOpened(eventData, jobId, messageId, recipient);
        break;

      case 'clicked':
        await handleClicked(eventData, jobId, messageId, recipient);
        break;

      case 'unsubscribed':
        await handleUnsubscribed(eventData, recipient);
        break;

      case 'complained':
        await handleComplained(eventData, recipient);
        break;

      case 'failed':
      case 'permanent_fail':
        await handleBounce(eventData, 'hard', jobId, messageId, recipient);
        break;

      case 'temporary_fail':
        await handleBounce(eventData, 'soft', jobId, messageId, recipient);
        break;

      default:
        logger.debug(`Unhandled Mailgun event: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error('Mailgun webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Handle delivered event
 */
async function handleDelivered(
  eventData: MailgunWebhookPayload['event-data'],
  jobId?: string,
  messageId?: string
): Promise<void> {
  // Update email job - find by jobId first, then by messageId
  let emailJob: EmailJobDoc = jobId ? await EmailQueueJob.findById(jobId) : null;
  if (!emailJob && messageId) {
    emailJob = await EmailQueueJob.findByMessageId(messageId) as EmailJobDoc;
  }

  if (emailJob) {
    await emailJob.markDelivered();

    // Update template stats
    if (emailJob.templateId) {
      await updateTemplateStats(emailJob.templateId, 'delivered');
    }
  }
}

/**
 * Handle opened event
 */
async function handleOpened(
  eventData: MailgunWebhookPayload['event-data'],
  jobId?: string,
  messageId?: string,
  recipient?: string
): Promise<void> {
  // Update email job - find by jobId first, then by messageId
  let emailJob: EmailJobDoc = jobId ? await EmailQueueJob.findById(jobId) : null;
  if (!emailJob && messageId) {
    emailJob = await EmailQueueJob.findByMessageId(messageId) as EmailJobDoc;
  }

  if (emailJob) {
    await emailJob.markOpened();

    // Update sequence email metrics
    if (emailJob.sequenceId && emailJob.sequenceEmailOrder !== undefined) {
      await updateSequenceEmailMetrics(
        emailJob.sequenceId.toString(),
        emailJob.sequenceEmailOrder,
        'opened'
      );
    }

    // Update template stats
    if (emailJob.templateId) {
      await updateTemplateStats(emailJob.templateId, 'opened');
    }
  }

  // Update lead engagement
  if (recipient) {
    const lead = await Lead.findOne({ email: recipient.toLowerCase() });
    if (lead) {
      lead.recordEmailOpen();
      await lead.save();

      // Track conversion event
      await trackEmailEvent(ConversionEventType.EMAIL_OPEN, lead, eventData);
    }
  }
}

/**
 * Handle clicked event
 */
async function handleClicked(
  eventData: MailgunWebhookPayload['event-data'],
  jobId?: string,
  messageId?: string,
  recipient?: string
): Promise<void> {
  const clickedUrl = eventData.url;

  // Update email job - find by jobId first, then by messageId
  let emailJob: EmailJobDoc = jobId ? await EmailQueueJob.findById(jobId) : null;
  if (!emailJob && messageId) {
    emailJob = await EmailQueueJob.findByMessageId(messageId) as EmailJobDoc;
  }

  if (emailJob) {
    await emailJob.markClicked();

    // Update sequence email metrics
    if (emailJob.sequenceId && emailJob.sequenceEmailOrder !== undefined) {
      await updateSequenceEmailMetrics(
        emailJob.sequenceId.toString(),
        emailJob.sequenceEmailOrder,
        'clicked'
      );
    }

    // Update template stats
    if (emailJob.templateId) {
      await updateTemplateStats(emailJob.templateId, 'clicked');
    }
  }

  // Update lead engagement
  if (recipient) {
    const lead = await Lead.findOne({ email: recipient.toLowerCase() });
    if (lead) {
      lead.recordEmailClick({ url: clickedUrl });
      await lead.save();

      // Track conversion event
      await trackEmailEvent(ConversionEventType.EMAIL_CLICK, lead, eventData, { clickedUrl });
    }
  }
}

/**
 * Handle unsubscribed event
 */
async function handleUnsubscribed(
  eventData: MailgunWebhookPayload['event-data'],
  recipient?: string
): Promise<void> {
  if (!recipient) return;

  const lead = await Lead.findOne({ email: recipient.toLowerCase() });
  if (lead) {
    lead.unsubscribe('Unsubscribed via email link');
    await lead.save();

    // Cancel pending sequence emails
    await EmailQueueJob.cancelPendingForLead(lead._id);

    logger.info(`Lead unsubscribed via Mailgun webhook`, {
      leadId: lead._id.toString(),
      email: recipient,
    });
  }
}

/**
 * Handle complaint (spam report)
 */
async function handleComplained(
  eventData: MailgunWebhookPayload['event-data'],
  recipient?: string
): Promise<void> {
  if (!recipient) return;

  const lead = await Lead.findOne({ email: recipient.toLowerCase() });
  if (lead) {
    lead.unsubscribe('Marked as spam');
    lead.addTag('complained');
    await lead.save();

    // Cancel pending emails
    await EmailQueueJob.cancelPendingForLead(lead._id);

    logger.warn(`Lead complained (spam)`, {
      leadId: lead._id.toString(),
      email: recipient,
    });
  }
}

/**
 * Handle bounce event
 */
async function handleBounce(
  eventData: MailgunWebhookPayload['event-data'],
  bounceType: 'soft' | 'hard',
  jobId?: string,
  messageId?: string,
  recipient?: string
): Promise<void> {
  const deliveryStatus = eventData['delivery-status'];
  const bounceReason = deliveryStatus?.message || deliveryStatus?.description || 'Unknown';
  const bounceCode = deliveryStatus?.code?.toString() || deliveryStatus?.['bounce-code'];

  // Update email job - find by jobId first, then by messageId
  let emailJob: EmailJobDoc = jobId ? await EmailQueueJob.findById(jobId) : null;
  if (!emailJob && messageId) {
    emailJob = await EmailQueueJob.findByMessageId(messageId) as EmailJobDoc;
  }

  if (emailJob) {
    await emailJob.markBounced(bounceType, bounceReason);

    // Update sequence email metrics
    if (emailJob.sequenceId && emailJob.sequenceEmailOrder !== undefined) {
      await updateSequenceEmailMetrics(
        emailJob.sequenceId.toString(),
        emailJob.sequenceEmailOrder,
        'bounced'
      );
    }
  }

  // Update lead status for hard bounces
  if (recipient && bounceType === 'hard') {
    const lead = await Lead.findOne({ email: recipient.toLowerCase() });
    if (lead) {
      lead.updateStatus(LeadStatus.BOUNCED, `Hard bounce: ${bounceReason}`);
      lead.emailConsent = false;
      await lead.save();

      // Cancel pending emails
      await EmailQueueJob.cancelPendingForLead(lead._id);

      logger.warn(`Lead marked as bounced`, {
        leadId: lead._id.toString(),
        email: recipient,
        bounceType,
        bounceReason,
        bounceCode,
      });
    }
  }
}

/**
 * Update sequence email metrics
 */
async function updateSequenceEmailMetrics(
  sequenceId: string,
  emailOrder: number,
  metricType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed'
): Promise<void> {
  const metricField = `emails.$.metrics.${metricType}`;

  await EmailSequence.updateOne(
    {
      _id: sequenceId,
      'emails.order': emailOrder,
    },
    {
      $inc: { [metricField]: 1 },
    }
  );
}

/**
 * Update template stats
 */
async function updateTemplateStats(
  templateId: string,
  eventType: 'delivered' | 'opened' | 'clicked'
): Promise<void> {
  // Note: Template stats are aggregate and would need more sophisticated tracking
  // For now, we just record the usage
  await EmailTemplate.findByIdAndUpdate(templateId, {
    $inc: { 'stats.timesUsed': eventType === 'delivered' ? 1 : 0 },
    $set: { 'stats.lastUsedAt': new Date() },
  });
}

/**
 * Track email event as conversion event
 */
async function trackEmailEvent(
  eventType: ConversionEventType,
  lead: any,
  eventData: MailgunWebhookPayload['event-data'],
  additionalMetadata?: Record<string, any>
): Promise<void> {
  const userVars = eventData['user-variables'] || {};

  try {
    const event = new ConversionEvent({
      eventType,
      leadId: lead._id,
      userId: lead.conversion?.userId,
      emailId: eventData.message?.headers?.['message-id'],
      funnelId: userVars.sequenceId, // Using sequenceId as context
      metadata: {
        templateId: userVars.templateId,
        sequenceId: userVars.sequenceId,
        campaignId: userVars.campaignId,
        ...additionalMetadata,
      },
      timestamp: new Date(eventData.timestamp * 1000),
    });

    await event.save();
  } catch (error) {
    logger.error('Failed to track email event:', error);
  }
}

/**
 * Webhook status endpoint
 * GET /webhooks/status
 */
export const getWebhookStatus = async (req: Request, res: Response) => {
  try {
    const stats = await EmailQueueJob.getStats(
      new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      new Date()
    );

    res.json({
      success: true,
      data: {
        webhookConfigured: !!MAILGUN_WEBHOOK_KEY,
        last24Hours: stats,
      },
    });
  } catch (error: any) {
    logger.error('Error getting webhook status:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get webhook status' },
    });
  }
};
