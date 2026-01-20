import { Router } from 'express';
import {
  trackEvent,
  trackPageView,
  trackBatch,
  getFunnelAnalytics,
  getSessionJourney,
  pixelTrack,
} from '../controllers/trackingController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// ============================================
// Public Tracking Routes (no auth required)
// These are called from the frontend tracking library
// ============================================

/**
 * Track a single event
 * POST /track/event
 *
 * Body:
 * {
 *   eventType: string (required) - One of ConversionEventType values
 *   sessionId: string (required) - Unique session identifier
 *   anonymousId?: string - Persistent anonymous user ID
 *   funnelId?: string - Funnel MongoDB ID
 *   funnelSlug?: string - Funnel slug
 *   stepId?: string - Step ID within funnel
 *   stepOrder?: number - Step order/position
 *   challengeId?: string - Challenge MongoDB ID
 *   emailId?: string - Email message ID
 *   metadata?: object - Event-specific metadata
 *   source?: object - UTM parameters
 *   value?: number - Monetary value
 * }
 */
router.post('/event', trackEvent);

/**
 * Track a page view (lightweight)
 * POST /track/pageview
 *
 * Body:
 * {
 *   sessionId: string (required)
 *   anonymousId?: string
 *   funnelSlug?: string
 *   stepId?: string
 *   stepOrder?: number
 *   pageUrl?: string
 *   pageTitle?: string
 *   referrer?: string
 *   source?: object - UTM parameters
 * }
 */
router.post('/pageview', trackPageView);

/**
 * Track batch events (for offline/batched tracking)
 * POST /track/batch
 *
 * Body:
 * {
 *   events: Array<EventObject> - Maximum 100 events per batch
 * }
 */
router.post('/batch', trackBatch);

/**
 * Pixel tracking endpoint (image-based, for email opens etc.)
 * GET /track/pixel.gif?e=event_type&s=session_id&f=funnel_slug&p=step_id
 */
router.get('/pixel.gif', pixelTrack);

// ============================================
// Authenticated Analytics Routes
// These require admin authentication
// ============================================

/**
 * Get funnel analytics
 * GET /track/analytics/funnel/:funnelId
 *
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 */
router.get('/analytics/funnel/:funnelId', authenticate, getFunnelAnalytics);

/**
 * Get session journey (for debugging/analysis)
 * GET /track/session/:sessionId
 */
router.get('/session/:sessionId', authenticate, getSessionJourney);

export default router;
