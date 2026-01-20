import { Router } from 'express';
import { handleMailgunWebhook, getWebhookStatus } from '../controllers/webhookController';
import { authenticate } from '../middleware/auth';

const router = Router();

// ============================================
// Mailgun Webhooks (no auth - signature verified)
// ============================================

/**
 * Handle Mailgun webhook events
 * POST /webhooks/mailgun
 *
 * Events handled:
 * - delivered: Email was delivered
 * - opened: Email was opened
 * - clicked: Link was clicked
 * - unsubscribed: User unsubscribed
 * - complained: User marked as spam
 * - failed/permanent_fail: Hard bounce
 * - temporary_fail: Soft bounce
 *
 * Mailgun documentation:
 * https://documentation.mailgun.com/en/latest/user_manual.html#webhooks
 */
router.post('/mailgun', handleMailgunWebhook);

// ============================================
// Webhook Management (auth required)
// ============================================

/**
 * Get webhook status and stats
 * GET /webhooks/status
 */
router.get('/status', authenticate, getWebhookStatus);

export default router;
