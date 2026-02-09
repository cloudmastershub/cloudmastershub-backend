import mongoose from 'mongoose';
import { EmailQueueJob, EmailJobStatus } from '../models/EmailQueueJob';
import { EmailSequence } from '../models/EmailSequence';
import { Lead, LeadStatus } from '../models/Lead';
import { ConversionEvent, ConversionEventType } from '../models/ConversionEvent';
import { FunnelParticipant, FunnelParticipantStatus } from '../models/FunnelParticipant';
import logger from '../utils/logger';

function defaultDateRange(startDate?: Date, endDate?: Date): { start: Date; end: Date } {
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

class AnalyticsService {
  /**
   * Email performance: summary counts by status, breakdown by type, daily trend
   */
  async getEmailPerformance(startDate?: Date, endDate?: Date) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const [statusBreakdown, typeBreakdown, dailyTrend] = await Promise.all([
      // Summary counts by status
      EmailQueueJob.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 as const } },
      ]),

      // Breakdown by type (sequence, campaign, transactional, trigger)
      EmailQueueJob.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $ne: ['$deliveredAt', null] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $ne: ['$openedAt', null] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $ne: ['$clickedAt', null] }, 1, 0] } },
            bounced: { $sum: { $cond: [{ $ne: ['$bouncedAt', null] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 as const } },
      ]),

      // Daily trend
      EmailQueueJob.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            sent: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $ne: ['$deliveredAt', null] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $ne: ['$openedAt', null] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $ne: ['$clickedAt', null] }, 1, 0] } },
            bounced: { $sum: { $cond: [{ $ne: ['$bouncedAt', null] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 as const } },
      ]),
    ]);

    // Build summary from status breakdown
    const summary: Record<string, number> = { total: 0 };
    for (const s of statusBreakdown) {
      summary[s._id] = s.count;
      summary.total += s.count;
    }

    return {
      summary,
      byType: typeBreakdown.map((t: any) => ({
        type: t._id,
        total: t.total,
        delivered: t.delivered,
        opened: t.opened,
        clicked: t.clicked,
        bounced: t.bounced,
        openRate: t.delivered > 0 ? Math.round((t.opened / t.delivered) * 10000) / 100 : 0,
        clickRate: t.opened > 0 ? Math.round((t.clicked / t.opened) * 10000) / 100 : 0,
      })),
      dailyTrend: dailyTrend.map((d: any) => ({
        date: d._id,
        sent: d.sent,
        delivered: d.delivered,
        opened: d.opened,
        clicked: d.clicked,
        bounced: d.bounced,
      })),
      dateRange: { start, end },
    };
  }

  /**
   * Sequence performance: per-sequence step metrics with open/click rates and drop-off
   */
  async getSequencePerformance(sequenceId?: string) {
    const query: any = { status: { $in: ['active', 'paused'] } };
    if (sequenceId) {
      if (!mongoose.Types.ObjectId.isValid(sequenceId)) {
        throw new Error('Invalid sequence ID');
      }
      query._id = new mongoose.Types.ObjectId(sequenceId);
    }

    const sequences = await EmailSequence.find(query).lean();

    return sequences.map((seq: any) => {
      const steps = (seq.emails || []).map((email: any, index: number) => {
        const m = email.metrics || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
        return {
          order: email.order,
          name: email.name,
          templateId: email.templateId,
          sent: m.sent,
          delivered: m.delivered,
          opened: m.opened,
          clicked: m.clicked,
          bounced: m.bounced,
          unsubscribed: m.unsubscribed,
          openRate: m.delivered > 0 ? Math.round((m.opened / m.delivered) * 10000) / 100 : 0,
          clickRate: m.opened > 0 ? Math.round((m.clicked / m.opened) * 10000) / 100 : 0,
          bounceRate: m.sent > 0 ? Math.round((m.bounced / m.sent) * 10000) / 100 : 0,
          unsubscribeRate: m.delivered > 0 ? Math.round((m.unsubscribed / m.delivered) * 10000) / 100 : 0,
        };
      });

      // Calculate drop-off between steps
      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1];
        steps[i].dropOff = prev.delivered > 0
          ? Math.round(((prev.delivered - steps[i].delivered) / prev.delivered) * 10000) / 100
          : 0;
      }
      if (steps.length > 0) {
        steps[0].dropOff = 0;
      }

      return {
        sequenceId: seq._id.toString(),
        name: seq.name,
        status: seq.status,
        trigger: seq.trigger,
        totalEnrolled: seq.metrics?.totalEnrolled || 0,
        totalCompleted: seq.metrics?.totalCompleted || 0,
        totalExited: seq.metrics?.totalExited || 0,
        steps,
      };
    });
  }

  /**
   * Lifecycle funnel: leads → engaged → qualified → signedUp → purchased + revenue + by source
   */
  async getLifecycleFunnel(startDate?: Date, endDate?: Date) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const [statusFunnel, sourceCounts, revenueData] = await Promise.all([
      // Status-based funnel stages
      Lead.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            engaged: [
              { $match: { status: { $in: [LeadStatus.ENGAGED, LeadStatus.QUALIFIED, LeadStatus.CONVERTED] } } },
              { $count: 'count' },
            ],
            qualified: [
              { $match: { status: { $in: [LeadStatus.QUALIFIED, LeadStatus.CONVERTED] } } },
              { $count: 'count' },
            ],
            signedUp: [
              { $match: { 'conversion.userId': { $exists: true, $ne: null } } },
              { $count: 'count' },
            ],
            purchased: [
              { $match: { 'conversion.totalSpent': { $gt: 0 } } },
              { $count: 'count' },
            ],
          },
        },
      ]),

      // Leads by source
      Lead.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$source.type',
            count: { $sum: 1 },
            converted: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.CONVERTED] }, 1, 0] } },
            revenue: { $sum: { $ifNull: ['$conversion.totalSpent', 0] } },
          },
        },
        { $sort: { count: -1 as const } },
      ]),

      // Total revenue
      Lead.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end }, 'conversion.totalSpent': { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$conversion.totalSpent' },
            avgRevenue: { $avg: '$conversion.totalSpent' },
          },
        },
      ]),
    ]);

    const extract = (arr: any[]) => arr[0]?.count || 0;
    const facets = statusFunnel[0] || {};

    const total = extract(facets.total);
    const engaged = extract(facets.engaged);
    const qualified = extract(facets.qualified);
    const signedUp = extract(facets.signedUp);
    const purchased = extract(facets.purchased);

    return {
      funnel: {
        leads: total,
        engaged,
        qualified,
        signedUp,
        purchased,
        engagementRate: total > 0 ? Math.round((engaged / total) * 10000) / 100 : 0,
        qualificationRate: engaged > 0 ? Math.round((qualified / engaged) * 10000) / 100 : 0,
        signupRate: qualified > 0 ? Math.round((signedUp / qualified) * 10000) / 100 : 0,
        purchaseRate: signedUp > 0 ? Math.round((purchased / signedUp) * 10000) / 100 : 0,
        overallConversion: total > 0 ? Math.round((purchased / total) * 10000) / 100 : 0,
      },
      revenue: {
        total: revenueData[0]?.totalRevenue || 0,
        average: Math.round((revenueData[0]?.avgRevenue || 0) * 100) / 100,
      },
      bySource: sourceCounts.map((s: any) => ({
        source: s._id || 'unknown',
        leads: s.count,
        converted: s.converted,
        revenue: s.revenue,
        conversionRate: s.count > 0 ? Math.round((s.converted / s.count) * 10000) / 100 : 0,
      })),
      dateRange: { start, end },
    };
  }

  /**
   * Funnel step analytics: per-step views/completions/rates + participant status breakdown
   */
  async getFunnelStepAnalytics(funnelId: string, startDate?: Date, endDate?: Date) {
    if (!mongoose.Types.ObjectId.isValid(funnelId)) {
      throw new Error('Invalid funnel ID');
    }

    const { start, end } = defaultDateRange(startDate, endDate);

    const [stepRates, participantBreakdown] = await Promise.all([
      // Step conversion rates from ConversionEvent
      (ConversionEvent as any).getStepConversionRates(funnelId, start, end),

      // Participant status breakdown
      FunnelParticipant.aggregate([
        { $match: { funnelId: new mongoose.Types.ObjectId(funnelId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Transform step rates into per-step objects
    const stepMap: Record<number, { views: number; completions: number }> = {};
    for (const row of stepRates) {
      if (!stepMap[row.stepOrder]) {
        stepMap[row.stepOrder] = { views: 0, completions: 0 };
      }
      if (row.eventType === ConversionEventType.STEP_VIEW) {
        stepMap[row.stepOrder].views = row.count;
      } else if (row.eventType === ConversionEventType.STEP_COMPLETE) {
        stepMap[row.stepOrder].completions = row.count;
      }
    }

    const stepAnalytics: Array<{
      stepOrder: number;
      views: number;
      completions: number;
      conversionRate: number;
      dropOff: number;
    }> = Object.entries(stepMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([order, data]) => ({
        stepOrder: Number(order),
        views: data.views,
        completions: data.completions,
        conversionRate: data.views > 0
          ? Math.round((data.completions / data.views) * 10000) / 100
          : 0,
        dropOff: 0,
      }));

    // Add drop-off between steps
    for (let i = 1; i < stepAnalytics.length; i++) {
      const prev = stepAnalytics[i - 1];
      stepAnalytics[i].dropOff = prev.views > 0
        ? Math.round(((prev.views - stepAnalytics[i].views) / prev.views) * 10000) / 100
        : 0;
    }

    const statusBreakdown: Record<string, number> = {};
    for (const p of participantBreakdown) {
      statusBreakdown[p._id] = p.count;
    }

    return {
      funnelId,
      steps: stepAnalytics,
      participants: statusBreakdown,
      totalParticipants: Object.values(statusBreakdown).reduce((a, b) => a + b, 0),
      dateRange: { start, end },
    };
  }

  /**
   * Dashboard overview: top-level rollup of all domains
   */
  async getDashboardOverview(startDate?: Date, endDate?: Date) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const [leadStats, emailStats, conversionCounts] = await Promise.all([
      // Lead stats
      Lead.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            recent: [
              { $match: { createdAt: { $gte: start, $lte: end } } },
              { $count: 'count' },
            ],
            byStatus: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            avgScore: [
              { $group: { _id: null, avg: { $avg: '$score' } } },
            ],
            totalRevenue: [
              { $match: { 'conversion.totalSpent': { $gt: 0 } } },
              { $group: { _id: null, total: { $sum: '$conversion.totalSpent' } } },
            ],
          },
        },
      ]),

      // Email stats for the period
      EmailQueueJob.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $ne: ['$deliveredAt', null] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $ne: ['$openedAt', null] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $ne: ['$clickedAt', null] }, 1, 0] } },
            bounced: { $sum: { $cond: [{ $ne: ['$bouncedAt', null] }, 1, 0] } },
          },
        },
      ]),

      // Conversion events in period
      ConversionEvent.aggregate([
        { $match: { timestamp: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const leadData = leadStats[0] || {};
    const emailData = emailStats[0] || { total: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };

    const statusMap: Record<string, number> = {};
    for (const s of (leadData.byStatus || [])) {
      statusMap[s._id] = s.count;
    }

    const eventMap: Record<string, number> = {};
    for (const e of conversionCounts) {
      eventMap[e._id] = e.count;
    }

    return {
      leads: {
        total: (leadData.total || [])[0]?.count || 0,
        newInPeriod: (leadData.recent || [])[0]?.count || 0,
        byStatus: statusMap,
        avgScore: Math.round(((leadData.avgScore || [])[0]?.avg || 0) * 100) / 100,
        totalRevenue: (leadData.totalRevenue || [])[0]?.total || 0,
      },
      email: {
        sent: emailData.total,
        delivered: emailData.delivered,
        opened: emailData.opened,
        clicked: emailData.clicked,
        bounced: emailData.bounced,
        openRate: emailData.delivered > 0 ? Math.round((emailData.opened / emailData.delivered) * 10000) / 100 : 0,
        clickRate: emailData.opened > 0 ? Math.round((emailData.clicked / emailData.opened) * 10000) / 100 : 0,
      },
      conversions: eventMap,
      dateRange: { start, end },
    };
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
