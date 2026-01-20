import { Request, Response } from 'express';
import { ConversionEvent, ConversionEventType, IConversionEvent } from '../models/ConversionEvent';
import { Funnel } from '../models/Funnel';
import { FunnelParticipant } from '../models/FunnelParticipant';
import { Lead } from '../models/Lead';
import logger from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Device info interface
 */
interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile';
  os: string;
  browser: string;
  screenWidth?: number;
  screenHeight?: number;
}

/**
 * Parse user agent to determine device type
 */
const parseUserAgent = (userAgent: string | undefined): DeviceInfo => {
  if (!userAgent) return { type: 'desktop', os: 'Unknown', browser: 'Unknown' };

  const ua = userAgent.toLowerCase();

  // Device type
  let type: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    type = 'mobile';
  } else if (/ipad|tablet|playbook|silk/i.test(ua)) {
    type = 'tablet';
  }

  // OS
  let os = 'Unknown';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

  // Browser
  let browser = 'Unknown';
  if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return { type, os, browser };
};

/**
 * Get client IP from request
 */
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * Track a conversion event
 * POST /track/event
 */
export const trackEvent = async (req: Request, res: Response) => {
  try {
    const {
      eventType,
      eventName,
      sessionId,
      anonymousId,
      funnelId,
      funnelSlug,
      stepId,
      stepOrder,
      challengeId,
      emailId,
      metadata = {},
      source = {},
      value,
    } = req.body;

    // Validate required fields
    if (!eventType || !sessionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'eventType and sessionId are required', code: 'INVALID_REQUEST' },
      });
    }

    // Validate event type
    if (!Object.values(ConversionEventType).includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid event type: ${eventType}`, code: 'INVALID_EVENT_TYPE' },
      });
    }

    // Parse user agent
    const device = parseUserAgent(req.headers['user-agent']);

    // Get screen dimensions from metadata if provided
    if (metadata.screenWidth) device.screenWidth = metadata.screenWidth;
    if (metadata.screenHeight) device.screenHeight = metadata.screenHeight;

    // Try to find lead/user by session
    let leadId: mongoose.Types.ObjectId | undefined;
    let userId: string | undefined;

    // Check if we have a funnel participant with this session
    if (funnelSlug && sessionId) {
      const participant = await FunnelParticipant.findOne({
        funnelSlug,
        sessionToken: sessionId
      });
      if (participant) {
        leadId = participant.leadId;
        userId = participant.userId;
      }
    }

    // Create conversion event
    const event = new ConversionEvent({
      eventType,
      eventName: eventType === ConversionEventType.CUSTOM ? eventName : undefined,
      sessionId,
      anonymousId,
      leadId,
      userId,
      funnelId: funnelId ? new mongoose.Types.ObjectId(funnelId) : undefined,
      funnelSlug,
      stepId,
      stepOrder,
      challengeId: challengeId ? new mongoose.Types.ObjectId(challengeId) : undefined,
      emailId,
      metadata: {
        pageUrl: metadata.pageUrl || req.headers.referer,
        pageTitle: metadata.pageTitle,
        referrer: metadata.referrer || req.headers.referer,
        videoId: metadata.videoId,
        videoPercent: metadata.videoPercent,
        videoDuration: metadata.videoDuration,
        watchTimeSeconds: metadata.watchTimeSeconds,
        productId: metadata.productId,
        productName: metadata.productName,
        amount: metadata.amount,
        currency: metadata.currency,
        orderId: metadata.orderId,
        scrollPercent: metadata.scrollPercent,
        timeOnPageSeconds: metadata.timeOnPageSeconds,
        buttonId: metadata.buttonId,
        buttonText: metadata.buttonText,
        linkUrl: metadata.linkUrl,
        formId: metadata.formId,
        formFields: metadata.formFields,
        customData: metadata.customData,
      },
      source: {
        utmSource: source.utmSource,
        utmMedium: source.utmMedium,
        utmCampaign: source.utmCampaign,
        utmContent: source.utmContent,
        utmTerm: source.utmTerm,
        referralCode: source.referralCode,
      },
      device,
      location: {
        ip: getClientIp(req),
        // Note: Country/region/city would require a GeoIP lookup service
        timezone: metadata.timezone,
      },
      value,
      timestamp: new Date(),
    });

    await event.save();

    // Update funnel metrics if this is a funnel event
    if (funnelId && [
      ConversionEventType.FUNNEL_START,
      ConversionEventType.OPTIN,
      ConversionEventType.PURCHASE,
    ].includes(eventType)) {
      await updateFunnelMetrics(funnelId, eventType, value);
    }

    logger.info('Tracking event recorded', {
      eventType,
      sessionId,
      funnelSlug,
      stepId,
    });

    res.status(201).json({
      success: true,
      data: { id: event._id.toString() },
    });
  } catch (error: any) {
    logger.error('Error tracking event:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to track event', code: 'TRACKING_ERROR' },
    });
  }
};

/**
 * Track page view (lightweight endpoint)
 * POST /track/pageview
 */
export const trackPageView = async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      anonymousId,
      funnelSlug,
      stepId,
      stepOrder,
      pageUrl,
      pageTitle,
      referrer,
      source = {},
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'sessionId is required', code: 'INVALID_REQUEST' },
      });
    }

    const device = parseUserAgent(req.headers['user-agent']);

    const event = new ConversionEvent({
      eventType: funnelSlug ? ConversionEventType.STEP_VIEW : ConversionEventType.PAGE_VIEW,
      sessionId,
      anonymousId,
      funnelSlug,
      stepId,
      stepOrder,
      metadata: {
        pageUrl,
        pageTitle,
        referrer,
      },
      source,
      device,
      location: {
        ip: getClientIp(req),
      },
      timestamp: new Date(),
    });

    await event.save();

    res.status(201).json({ success: true });
  } catch (error: any) {
    logger.error('Error tracking page view:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to track page view', code: 'TRACKING_ERROR' },
    });
  }
};

/**
 * Track batch events (for offline/batched tracking)
 * POST /track/batch
 */
export const trackBatch = async (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'events array is required', code: 'INVALID_REQUEST' },
      });
    }

    if (events.length > 100) {
      return res.status(400).json({
        success: false,
        error: { message: 'Maximum 100 events per batch', code: 'BATCH_TOO_LARGE' },
      });
    }

    const device = parseUserAgent(req.headers['user-agent']);
    const clientIp = getClientIp(req);

    const eventDocs = events.map((e: any) => ({
      eventType: e.eventType,
      eventName: e.eventName,
      sessionId: e.sessionId,
      anonymousId: e.anonymousId,
      funnelId: e.funnelId ? new mongoose.Types.ObjectId(e.funnelId) : undefined,
      funnelSlug: e.funnelSlug,
      stepId: e.stepId,
      stepOrder: e.stepOrder,
      metadata: e.metadata || {},
      source: e.source || {},
      device,
      location: { ip: clientIp },
      timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
    }));

    await ConversionEvent.insertMany(eventDocs);

    logger.info(`Batch tracking: ${events.length} events recorded`);

    res.status(201).json({
      success: true,
      data: { count: events.length },
    });
  } catch (error: any) {
    logger.error('Error tracking batch events:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to track batch events', code: 'TRACKING_ERROR' },
    });
  }
};

/**
 * Get funnel analytics
 * GET /track/analytics/funnel/:funnelId
 */
export const getFunnelAnalytics = async (req: Request, res: Response) => {
  try {
    const { funnelId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get event counts by type
    const eventStats = await ConversionEvent.aggregate([
      {
        $match: {
          funnelId: new mongoose.Types.ObjectId(funnelId),
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' },
          totalValue: { $sum: '$value' },
        },
      },
      {
        $project: {
          eventType: '$_id',
          count: 1,
          uniqueCount: { $size: '$uniqueSessions' },
          totalValue: 1,
          _id: 0,
        },
      },
    ]);

    // Get step conversion rates
    const stepStats = await ConversionEvent.aggregate([
      {
        $match: {
          funnelId: new mongoose.Types.ObjectId(funnelId),
          eventType: { $in: [ConversionEventType.STEP_VIEW, ConversionEventType.STEP_COMPLETE] },
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { stepOrder: '$stepOrder', eventType: '$eventType' },
          uniqueSessions: { $addToSet: '$sessionId' },
        },
      },
      {
        $project: {
          stepOrder: '$_id.stepOrder',
          eventType: '$_id.eventType',
          count: { $size: '$uniqueSessions' },
          _id: 0,
        },
      },
      { $sort: { stepOrder: 1, eventType: 1 } },
    ]);

    // Get source breakdown
    const sourceStats = await ConversionEvent.aggregate([
      {
        $match: {
          funnelId: new mongoose.Types.ObjectId(funnelId),
          eventType: ConversionEventType.FUNNEL_START,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            source: '$source.utmSource',
            medium: '$source.utmMedium',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          source: '$_id.source',
          medium: '$_id.medium',
          count: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get daily trend
    const dailyTrend = await ConversionEvent.aggregate([
      {
        $match: {
          funnelId: new mongoose.Types.ObjectId(funnelId),
          eventType: { $in: [ConversionEventType.STEP_VIEW, ConversionEventType.OPTIN, ConversionEventType.PURCHASE] },
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          date: '$_id.date',
          eventType: '$_id.eventType',
          count: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1, eventType: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        period: { start, end },
        eventStats,
        stepStats,
        sourceStats,
        dailyTrend,
      },
    });
  } catch (error: any) {
    logger.error('Error getting funnel analytics:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get analytics', code: 'ANALYTICS_ERROR' },
    });
  }
};

/**
 * Get session journey
 * GET /track/session/:sessionId
 */
export const getSessionJourney = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const events = await ConversionEvent.find({ sessionId })
      .sort({ timestamp: 1 })
      .select('eventType eventName metadata timestamp funnelSlug stepId stepOrder value')
      .lean();

    res.json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    logger.error('Error getting session journey:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get session journey', code: 'QUERY_ERROR' },
    });
  }
};

/**
 * Pixel endpoint (for image-based tracking)
 * GET /track/pixel.gif
 */
export const pixelTrack = async (req: Request, res: Response) => {
  try {
    const { e: eventType, s: sessionId, f: funnelSlug, p: stepId } = req.query;

    if (sessionId && eventType) {
      // Fire and forget - don't wait for save
      const event = new ConversionEvent({
        eventType: eventType as ConversionEventType || ConversionEventType.PAGE_VIEW,
        sessionId: sessionId as string,
        funnelSlug: funnelSlug as string,
        stepId: stepId as string,
        metadata: {
          pageUrl: req.headers.referer,
        },
        device: parseUserAgent(req.headers['user-agent']),
        location: { ip: getClientIp(req) },
        timestamp: new Date(),
      });
      event.save().catch((err) => logger.error('Pixel tracking save error:', err));
    }

    // Return a 1x1 transparent GIF
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': gif.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.send(gif);
  } catch (error: any) {
    // Still return the pixel even on error
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.send(gif);
  }
};

/**
 * Helper: Update funnel metrics
 */
async function updateFunnelMetrics(
  funnelId: string,
  eventType: ConversionEventType,
  value?: number
) {
  try {
    const update: Record<string, any> = {};

    switch (eventType) {
      case ConversionEventType.FUNNEL_START:
        update['$inc'] = { 'metrics.totalVisitors': 1, 'metrics.uniqueVisitors': 1 };
        break;
      case ConversionEventType.OPTIN:
        update['$inc'] = { 'metrics.totalLeads': 1 };
        break;
      case ConversionEventType.PURCHASE:
        update['$inc'] = {
          'metrics.totalConversions': 1,
          'metrics.totalRevenue': value || 0,
        };
        break;
    }

    if (Object.keys(update).length > 0) {
      await Funnel.findByIdAndUpdate(funnelId, update);
    }
  } catch (error) {
    logger.error('Error updating funnel metrics:', error);
  }
}
