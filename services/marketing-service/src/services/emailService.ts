import Mailgun from 'mailgun.js';
import formData from 'form-data';
import Handlebars from 'handlebars';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { EmailTemplate, IEmailTemplate, EmailSequence, IEmailSequence, Lead, ILead } from '../models';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

// Initialize Mailgun
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@cloudmastershub.com';
const FROM_NAME = process.env.FROM_NAME || 'CloudMastersHub';

// Mailgun client setup
const mailgun = new Mailgun(formData);
let mg: ReturnType<typeof mailgun.client> | null = null;

if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
  mg = mailgun.client({
    username: 'api',
    key: MAILGUN_API_KEY,
  });
  logger.info('Mailgun initialized', { domain: MAILGUN_DOMAIN });
} else {
  logger.warn('MAILGUN_API_KEY or MAILGUN_DOMAIN not set - emails will be logged only');
}

/**
 * Email sending options
 */
interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  trackingId?: string;
  tags?: string[];
  metadata?: Record<string, string>;
}

/**
 * Template variable context
 */
interface TemplateContext {
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  challengeName?: string;
  dayNumber?: number;
  dayTitle?: string;
  accessLink?: string;
  unsubscribeLink?: string;
  currentYear?: number;
  [key: string]: any;
}

/**
 * Email Service - Handles all email operations using Mailgun
 */
class EmailService {
  private compiledTemplates: Map<string, Handlebars.TemplateDelegate> = new Map();

  constructor() {
    // Register Handlebars helpers
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    });

    Handlebars.registerHelper('uppercase', (str: string) => {
      return str?.toUpperCase() || '';
    });

    Handlebars.registerHelper('lowercase', (str: string) => {
      return str?.toLowerCase() || '';
    });

    Handlebars.registerHelper('ifEquals', function(this: any, arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });
  }

  /**
   * Send a single email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    const trackingId = options.trackingId || uuidv4();

    const messageData = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: options.toName ? `${options.toName} <${options.to}>` : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || this.htmlToText(options.html),
      'o:tracking': 'yes',
      'o:tracking-clicks': 'yes',
      'o:tracking-opens': 'yes',
      'o:tag': options.tags || ['marketing'],
      'v:trackingId': trackingId,
      'v:templateId': options.templateId || 'custom',
      ...(options.metadata ? Object.fromEntries(
        Object.entries(options.metadata).map(([k, v]) => [`v:${k}`, v])
      ) : {}),
    };

    // If Mailgun is not configured, log the email instead
    if (!mg || !MAILGUN_DOMAIN) {
      logger.info('Email would be sent (Mailgun not configured):', {
        to: options.to,
        subject: options.subject,
        trackingId,
      });
      return { success: true, messageId: `mock-${trackingId}` };
    }

    try {
      // Cast to any to handle Mailgun SDK's strict typing for custom options
      const response = await mg.messages.create(MAILGUN_DOMAIN, messageData as any);
      logger.info(`Email sent successfully`, {
        to: options.to,
        subject: options.subject,
        messageId: response.id,
        trackingId,
      });
      return {
        success: true,
        messageId: response.id,
      };
    } catch (error: any) {
      logger.error('Failed to send email:', {
        to: options.to,
        subject: options.subject,
        error: error.message,
        details: error.details,
      });
      throw ApiError.internal(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send email using a template
   */
  async sendTemplatedEmail(
    templateId: string,
    to: string,
    context: TemplateContext,
    options?: {
      toName?: string;
      tags?: string[];
      metadata?: Record<string, string>;
    }
  ): Promise<{ success: boolean; messageId?: string }> {
    const template = await EmailTemplate.findById(templateId);
    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    // Add default context values
    const fullContext: TemplateContext = {
      currentYear: new Date().getFullYear(),
      unsubscribeLink: `${process.env.APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`,
      ...context,
    };

    // Compile and render template
    const renderedSubject = this.renderTemplate(template.subject, fullContext);
    const renderedHtml = this.renderTemplate(template.htmlContent, fullContext);
    const renderedText = template.textContent
      ? this.renderTemplate(template.textContent, fullContext)
      : undefined;

    return this.sendEmail({
      to,
      toName: options?.toName || context.firstName,
      subject: renderedSubject,
      html: renderedHtml,
      text: renderedText,
      templateId: template.id,
      tags: [...(template.tags || []), ...(options?.tags || [])],
      metadata: options?.metadata,
    });
  }

  /**
   * Send bulk emails (up to 1000 recipients)
   */
  async sendBulkEmail(
    recipients: Array<{ email: string; name?: string; context?: TemplateContext }>,
    templateId: string,
    baseContext: TemplateContext = {}
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const template = await EmailTemplate.findById(templateId);
    if (!template) {
      throw ApiError.notFound('Email template not found');
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (recipient) => {
          try {
            const context = { ...baseContext, ...recipient.context };
            await this.sendTemplatedEmail(templateId, recipient.email, context, {
              toName: recipient.name,
            });
            success++;
          } catch (error: any) {
            failed++;
            errors.push(`${recipient.email}: ${error.message}`);
          }
        })
      );

      // Rate limiting - wait between batches
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Bulk email completed`, { success, failed, total: recipients.length });
    return { success, failed, errors };
  }

  /**
   * Render a Handlebars template with context
   */
  private renderTemplate(templateString: string, context: TemplateContext): string {
    // Check cache first
    let compiled = this.compiledTemplates.get(templateString);
    if (!compiled) {
      compiled = Handlebars.compile(templateString);
      this.compiledTemplates.set(templateString, compiled);
    }
    return compiled(context);
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ==========================================
  // Email Template Management
  // ==========================================

  /**
   * Create an email template
   */
  async createTemplate(input: {
    name: string;
    slug?: string;
    description?: string;
    category: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    variables?: string[];
    tags?: string[];
    createdBy: string;
  }): Promise<IEmailTemplate> {
    // Transform string[] variables to ITemplateVariable[] objects
    // The model expects objects with name, description, required, type fields
    const transformedVariables = input.variables?.map(varName => ({
      name: varName,
      description: `Variable: ${varName}`,
      required: false,
      type: 'string' as const,
    })) || [];

    const template = new EmailTemplate({
      ...input,
      variables: transformedVariables,
      status: 'draft',
      updatedBy: input.createdBy, // Required field - set to createdBy on creation
    });

    await template.save();
    logger.info(`Email template created: ${template.name} (${template.id})`);
    return template;
  }

  /**
   * Update an email template
   */
  async updateTemplate(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      subject: string;
      htmlContent: string;
      textContent: string;
      variables: string[];
      tags: string[];
      status: string;
      updatedBy: string;
    }>
  ): Promise<IEmailTemplate | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid template ID');
    }

    // Transform string[] variables to ITemplateVariable[] objects if provided
    const updateData: Record<string, unknown> = { ...input };
    if (input.variables) {
      updateData.variables = input.variables.map(varName => ({
        name: varName,
        description: `Variable: ${varName}`,
        required: false,
        type: 'string' as const,
      }));
    }

    const template = await EmailTemplate.findByIdAndUpdate(id, updateData, { new: true });
    if (template) {
      // Clear template cache
      this.compiledTemplates.delete(template.htmlContent);
      if (template.textContent) {
        this.compiledTemplates.delete(template.textContent);
      }
      logger.info(`Email template updated: ${template.name} (${template.id})`);
    }
    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<IEmailTemplate | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid template ID');
    }
    return EmailTemplate.findById(id);
  }

  /**
   * List templates
   */
  async listTemplates(options: {
    category?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: IEmailTemplate[]; total: number }> {
    const { category, status, search, page = 1, limit = 20 } = options;

    const query: any = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [rawData, total] = await Promise.all([
      EmailTemplate.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailTemplate.countDocuments(query),
    ]);

    // Transform _id to id since .lean() bypasses toJSON transform
    const data = rawData.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
      _id: undefined,
    }));

    return { data: data as IEmailTemplate[], total };
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid template ID');
    }

    const result = await EmailTemplate.findByIdAndDelete(id);
    if (result) {
      logger.info(`Email template deleted: ${result.name} (${id})`);
      return true;
    }
    return false;
  }

  // ==========================================
  // Email Sequence Management
  // ==========================================

  /**
   * Create an email sequence
   */
  async createSequence(input: {
    name: string;
    slug?: string;
    description?: string;
    triggerType: string;
    emails: Array<{
      order: number;
      templateId: string;
      delayHours: number;
      subject?: string;
      conditions?: Record<string, any>;
    }>;
    tags?: string[];
    createdBy: string;
  }): Promise<IEmailSequence> {
    const sequence = new EmailSequence({
      ...input,
      status: 'draft',
      metrics: {
        totalSent: 0,
        totalOpens: 0,
        totalClicks: 0,
        totalUnsubscribes: 0,
        openRate: 0,
        clickRate: 0,
      },
    });

    await sequence.save();
    logger.info(`Email sequence created: ${sequence.name} (${sequence.id})`);
    return sequence;
  }

  /**
   * Get sequence by ID
   */
  async getSequence(id: string): Promise<IEmailSequence | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid sequence ID');
    }
    return EmailSequence.findById(id);
  }

  /**
   * List sequences
   */
  async listSequences(options: {
    status?: string;
    triggerType?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: IEmailSequence[]; total: number }> {
    const { status, triggerType, page = 1, limit = 20 } = options;

    const query: any = {};
    if (status) query.status = status;
    if (triggerType) query.triggerType = triggerType;

    const [rawData, total] = await Promise.all([
      EmailSequence.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmailSequence.countDocuments(query),
    ]);

    // Transform _id to id since .lean() bypasses toJSON transform
    const data = rawData.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
      _id: undefined,
    }));

    return { data: data as IEmailSequence[], total };
  }

  // ==========================================
  // Challenge Email Helpers
  // ==========================================

  /**
   * Send welcome email for challenge registration
   */
  async sendChallengeWelcomeEmail(
    email: string,
    challengeName: string,
    firstName?: string,
    welcomeTemplateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      challengeName,
      accessLink: `${process.env.APP_URL}/challenge/${challengeName.toLowerCase().replace(/\s+/g, '-')}/day/1`,
    };

    if (welcomeTemplateId) {
      await this.sendTemplatedEmail(welcomeTemplateId, email, context, {
        tags: ['challenge', 'welcome'],
      });
    } else {
      // Use default welcome email
      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: `Welcome to ${challengeName}! 🚀`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Welcome to ${challengeName}!</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>You're all set to start your journey! Day 1 is now available.</p>
            <p><a href="${context.accessLink}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Start Day 1</a></p>
            <p>Let's do this!</p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['challenge', 'welcome'],
      });
    }
  }

  /**
   * Send day unlock notification
   */
  async sendDayUnlockEmail(
    email: string,
    challengeName: string,
    dayNumber: number,
    dayTitle: string,
    firstName?: string,
    templateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      challengeName,
      dayNumber,
      dayTitle,
      accessLink: `${process.env.APP_URL}/challenge/${challengeName.toLowerCase().replace(/\s+/g, '-')}/day/${dayNumber}`,
    };

    if (templateId) {
      await this.sendTemplatedEmail(templateId, email, context, {
        tags: ['challenge', 'day-unlock'],
      });
    } else {
      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: `Day ${dayNumber} is now available! 📚`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Day ${dayNumber}: ${dayTitle}</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>Great news! Day ${dayNumber} of ${challengeName} is now unlocked and ready for you.</p>
            <p><a href="${context.accessLink}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Start Day ${dayNumber}</a></p>
            <p>Keep up the great work!</p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['challenge', 'day-unlock'],
      });
    }
  }

  /**
   * Send challenge completion email
   */
  async sendChallengeCompletionEmail(
    email: string,
    challengeName: string,
    firstName?: string,
    completionTemplateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      challengeName,
    };

    if (completionTemplateId) {
      await this.sendTemplatedEmail(completionTemplateId, email, context, {
        tags: ['challenge', 'completion'],
      });
    } else {
      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: `Congratulations! You've completed ${challengeName}! 🎉`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>🎉 Congratulations!</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>Amazing work! You've successfully completed ${challengeName}!</p>
            <p>You should be proud of yourself for committing to your growth and seeing it through.</p>
            <p>What's next? Check out our advanced courses to continue your journey.</p>
            <p><a href="${process.env.APP_URL}/courses" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Explore Courses</a></p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['challenge', 'completion'],
      });
    }
  }

  /**
   * Send pitch/offer email
   */
  async sendPitchEmail(
    email: string,
    challengeName: string,
    offer: {
      productName: string;
      originalPrice: number;
      discountedPrice?: number;
      bonuses?: string[];
      ctaUrl: string;
    },
    firstName?: string,
    templateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      challengeName,
      productName: offer.productName,
      originalPrice: offer.originalPrice,
      discountedPrice: offer.discountedPrice,
      bonuses: offer.bonuses,
      ctaUrl: offer.ctaUrl,
      hasDiscount: !!offer.discountedPrice,
      savings: offer.discountedPrice ? offer.originalPrice - offer.discountedPrice : 0,
    };

    if (templateId) {
      await this.sendTemplatedEmail(templateId, email, context, {
        tags: ['challenge', 'pitch', 'sales'],
      });
    } else {
      const priceDisplay = offer.discountedPrice
        ? `<span style="text-decoration: line-through; color: #666;">$${offer.originalPrice}</span> <strong style="color: #22C55E;">$${offer.discountedPrice}</strong>`
        : `<strong>$${offer.originalPrice}</strong>`;

      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: `Special offer: ${offer.productName} 🎁`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Ready for the Next Level?</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>You've proven your commitment by completing ${challengeName}. Now it's time to take your skills even further with <strong>${offer.productName}</strong>.</p>
            <h2>${offer.productName}</h2>
            <p style="font-size: 24px;">${priceDisplay}</p>
            ${offer.bonuses && offer.bonuses.length > 0 ? `
              <h3>Plus, you'll get:</h3>
              <ul>
                ${offer.bonuses.map(b => `<li>${b}</li>`).join('')}
              </ul>
            ` : ''}
            <p><a href="${offer.ctaUrl}" style="background: #4F46E5; color: white; padding: 16px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 18px;">Get Access Now</a></p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['challenge', 'pitch', 'sales'],
      });
    }
  }

  // ==========================================
  // Trial Subscription Email Helpers
  // ==========================================

  /**
   * Send trial started welcome email
   */
  async sendTrialStartedEmail(
    email: string,
    planName: string,
    trialDays: number,
    trialEndsAt: Date,
    firstName?: string,
    templateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      planName,
      trialDays,
      trialEndsAt: trialEndsAt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      dashboardLink: `${process.env.APP_URL}/dashboard`,
      subscriptionLink: `${process.env.APP_URL}/profile/subscription`,
    };

    if (templateId) {
      await this.sendTemplatedEmail(templateId, email, context, {
        tags: ['trial', 'welcome', 'subscription'],
      });
    } else {
      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: `Your ${trialDays}-day free trial has started! 🚀`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Welcome to CloudMastersHub ${planName}!</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>Your ${trialDays}-day free trial is now active. You have full access to all ${planName} features until <strong>${context.trialEndsAt}</strong>.</p>
            <h3>What you can do now:</h3>
            <ul>
              <li>Access all ${planName} courses</li>
              <li>Start hands-on cloud labs</li>
              <li>Track your learning progress</li>
              <li>Join our community</li>
            </ul>
            <p><a href="${context.dashboardLink}" style="background: #40E0D0; color: black; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Go to Dashboard</a></p>
            <p style="color: #666; font-size: 14px; margin-top: 24px;">
              Your card won't be charged until the trial ends. You can cancel anytime from your <a href="${context.subscriptionLink}">subscription settings</a>.
            </p>
            <p>Happy learning!</p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['trial', 'welcome', 'subscription'],
      });
    }
  }

  /**
   * Send trial reminder email
   */
  async sendTrialReminderEmail(
    email: string,
    planName: string,
    daysRemaining: number,
    trialEndsAt: Date,
    firstName?: string,
    templateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      planName,
      daysRemaining,
      trialEndsAt: trialEndsAt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      subscriptionLink: `${process.env.APP_URL}/profile/subscription`,
      dashboardLink: `${process.env.APP_URL}/dashboard`,
    };

    const urgencyPrefix = daysRemaining <= 1 ? '⚠️ ' : daysRemaining <= 3 ? '⏰ ' : '';
    const subjectLine = daysRemaining === 1
      ? `${urgencyPrefix}Your trial ends tomorrow!`
      : `${urgencyPrefix}${daysRemaining} days left in your ${planName} trial`;

    if (templateId) {
      await this.sendTemplatedEmail(templateId, email, context, {
        tags: ['trial', 'reminder', 'subscription'],
      });
    } else {
      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: subjectLine,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>${daysRemaining === 1 ? 'Last Day!' : `${daysRemaining} Days Remaining`}</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>Just a friendly reminder that your ${planName} trial ends on <strong>${context.trialEndsAt}</strong>.</p>
            ${daysRemaining <= 3 ? `
              <div style="background: #FFF3CD; border: 1px solid #FFE69C; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0; color: #664D03;"><strong>Don't lose access!</strong> Your subscription will automatically continue after the trial to ensure uninterrupted access to your courses and progress.</p>
              </div>
            ` : ''}
            <h3>Make the most of your remaining trial:</h3>
            <ul>
              <li>Complete any courses you've started</li>
              <li>Try out the hands-on labs</li>
              <li>Explore advanced features</li>
            </ul>
            <p><a href="${context.dashboardLink}" style="background: #40E0D0; color: black; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Continue Learning</a></p>
            <p style="color: #666; font-size: 14px; margin-top: 24px;">
              Want to cancel? You can manage your subscription anytime from your <a href="${context.subscriptionLink}">account settings</a>.
            </p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['trial', 'reminder', 'subscription'],
      });
    }
  }

  /**
   * Send subscription paused confirmation
   */
  async sendSubscriptionPausedEmail(
    email: string,
    planName: string,
    pauseExpiresAt: Date,
    firstName?: string,
    templateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      planName,
      pauseExpiresAt: pauseExpiresAt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      subscriptionLink: `${process.env.APP_URL}/profile/subscription`,
    };

    if (templateId) {
      await this.sendTemplatedEmail(templateId, email, context, {
        tags: ['subscription', 'paused'],
      });
    } else {
      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: `Your ${planName} subscription is paused`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Subscription Paused</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>Your ${planName} subscription has been paused. You won't be charged during this time.</p>
            <div style="background: #E8F4FD; border: 1px solid #B8DAFF; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Important:</strong> Your pause period expires on <strong>${context.pauseExpiresAt}</strong>. After this date, your subscription will automatically resume.</p>
            </div>
            <p>During the pause period:</p>
            <ul>
              <li>You won't be charged</li>
              <li>Your course progress is saved</li>
              <li>You can resume anytime</li>
            </ul>
            <p><a href="${context.subscriptionLink}" style="background: #40E0D0; color: black; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Resume Now</a></p>
            <p>We hope to see you back soon!</p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['subscription', 'paused'],
      });
    }
  }

  /**
   * Send subscription resumed confirmation
   */
  async sendSubscriptionResumedEmail(
    email: string,
    planName: string,
    nextBillingDate: Date | null,
    firstName?: string,
    templateId?: string
  ): Promise<void> {
    const context: TemplateContext = {
      firstName: firstName || 'there',
      email,
      planName,
      nextBillingDate: nextBillingDate?.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }) || 'your next billing cycle',
      dashboardLink: `${process.env.APP_URL}/dashboard`,
    };

    if (templateId) {
      await this.sendTemplatedEmail(templateId, email, context, {
        tags: ['subscription', 'resumed'],
      });
    } else {
      await this.sendEmail({
        to: email,
        toName: firstName,
        subject: `Welcome back! Your ${planName} subscription is active 🎉`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1>Welcome Back! 🎉</h1>
            <p>Hi ${firstName || 'there'},</p>
            <p>Great news! Your ${planName} subscription is now active again.</p>
            <p>You have full access to all your courses, labs, and progress.</p>
            ${nextBillingDate ? `<p style="color: #666;">Your next billing date is <strong>${context.nextBillingDate}</strong>.</p>` : ''}
            <p><a href="${context.dashboardLink}" style="background: #40E0D0; color: black; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold;">Go to Dashboard</a></p>
            <p>Happy learning!</p>
            <p>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['subscription', 'resumed'],
      });
    }
  }
}

export const emailService = new EmailService();
export default emailService;
