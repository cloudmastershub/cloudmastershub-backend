import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { emailService } from '../services/emailService';
import logger from '../utils/logger';

/**
 * POST /contact
 * Public endpoint – accepts contact form submissions,
 * emails the support team and sends a confirmation to the user.
 */
export const submitContactForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;
    const timestamp = new Date().toISOString();

    // Log the submission so data is never lost even if emails fail
    logger.info('Contact form submission received', { name, email, subject, message, timestamp });

    // 1. Notify support team (best-effort)
    try {
      await emailService.sendEmail({
        to: 'support@cloudmastershub.com',
        toName: 'CloudMastersHub Support',
        subject: `[Contact Form] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #40E0D0;">New Contact Form Submission</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Name</td><td style="padding: 8px;">${name}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Email</td><td style="padding: 8px;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Subject</td><td style="padding: 8px;">${subject}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; color: #666;">Received</td><td style="padding: 8px;">${timestamp}</td></tr>
            </table>
            <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        `,
        tags: ['contact-form'],
        metadata: { source: 'contact-form' },
      });
    } catch (emailErr) {
      logger.error('Failed to send admin notification for contact form', { email, subject, error: (emailErr as Error).message });
    }

    // 2. Send confirmation to user (best-effort)
    try {
      await emailService.sendEmail({
        to: email,
        toName: name,
        subject: 'We received your message - CloudMastersHub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #40E0D0;">Thanks for reaching out, ${name}!</h2>
            <p>We've received your message regarding <strong>"${subject}"</strong> and our team will get back to you within 24 hours.</p>
            <p>If your matter is urgent, you can also reach us at <a href="mailto:support@cloudmastershub.com">support@cloudmastershub.com</a>.</p>
            <br/>
            <p>Best regards,<br/>The CloudMastersHub Team</p>
          </div>
        `,
        tags: ['contact-form-confirmation'],
        metadata: { source: 'contact-form' },
      });
    } catch (emailErr) {
      logger.error('Failed to send user confirmation for contact form', { email, subject, error: (emailErr as Error).message });
    }

    logger.info('Contact form processed', { email, subject });
    res.status(200).json({ success: true, message: 'Message received' });
  } catch (error) {
    logger.error('Contact form error:', error);
    next(error);
  }
};
