import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import logger from '../utils/logger';
import { AuditLog } from '../models/AuditLog';

// Security Metrics Interface
interface SecurityMetrics {
  totalIncidents: number;
  activeThreats: number;
  blockedAttacks: number;
  suspiciousLogins: number;
  securityScore: number;
  lastScanTime: string;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Security Settings Interface
interface SecuritySettings {
  twoFactorRequired: boolean;
  passwordMinLength: number;
  maxLoginAttempts: number;
  sessionTimeout: number;
  ipWhitelisting: boolean;
  bruteForceProtection: boolean;
  rateLimiting: boolean;
  securityHeadersEnabled: boolean;
  auditLogging: boolean;
  encryptionEnabled: boolean;
}

let mockSecuritySettings: SecuritySettings = {
  twoFactorRequired: false,
  passwordMinLength: 8,
  maxLoginAttempts: 5,
  sessionTimeout: 30,
  ipWhitelisting: false,
  bruteForceProtection: true,
  rateLimiting: true,
  securityHeadersEnabled: true,
  auditLogging: true,
  encryptionEnabled: true
};

/**
 * Get security overview and metrics
 */
export const getSecurityOverview = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching security overview', {
      adminId: req.adminId,
    });

    // Get real metrics from database
    const [
      totalIncidents,
      activeThreats,
      suspiciousLogins,
      severityCounts
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ status: { $in: ['open', 'investigating'] } }),
      AuditLog.countDocuments({
        event: { $regex: /login/i },
        severity: { $ne: 'low' }
      }),
      AuditLog.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ])
    ]);

    // Transform severity counts
    const vulnerabilities = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    severityCounts.forEach((item: { _id: string; count: number }) => {
      if (item._id in vulnerabilities) {
        vulnerabilities[item._id as keyof typeof vulnerabilities] = item.count;
      }
    });

    // Calculate security score (higher is better, based on resolved vs active threats)
    const resolvedCount = totalIncidents - activeThreats;
    const securityScore = totalIncidents > 0
      ? Math.round((resolvedCount / totalIncidents) * 100)
      : 100;

    const metrics: SecurityMetrics = {
      totalIncidents,
      activeThreats,
      blockedAttacks: vulnerabilities.critical + vulnerabilities.high,
      suspiciousLogins,
      securityScore,
      lastScanTime: new Date().toISOString(),
      vulnerabilities
    };

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Error in getSecurityOverview controller:', error);
    next(error);
  }
};

/**
 * Get security logs with filtering and pagination
 */
export const getSecurityLogs = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      severity = '',
      status = '',
      search = ''
    } = req.query as any;

    logger.info('Admin fetching security logs', {
      adminId: req.adminId,
      page,
      limit,
      severity,
      status,
      search,
    });

    // Build query based on filters
    const query: Record<string, any> = {};

    if (severity && severity !== 'all') {
      query.severity = severity;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { event: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { user: { $regex: search, $options: 'i' } },
        { ip: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Query database
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    const response = {
      logs: logs.map(log => ({
        id: log._id.toString(),
        timestamp: log.timestamp.toISOString(),
        event: log.event,
        severity: log.severity,
        source: log.source,
        user: log.user,
        ip: log.ip,
        userAgent: log.userAgent,
        details: log.details,
        status: log.status
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error in getSecurityLogs controller:', error);
    next(error);
  }
};

/**
 * Get security settings
 */
export const getSecuritySettings = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching security settings', {
      adminId: req.adminId,
    });

    res.status(200).json({
      success: true,
      data: mockSecuritySettings,
    });
  } catch (error) {
    logger.error('Error in getSecuritySettings controller:', error);
    next(error);
  }
};

/**
 * Update security settings
 */
export const updateSecuritySettings = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updates = req.body;

    logger.info('Admin updating security settings', {
      adminId: req.adminId,
      updates: Object.keys(updates),
    });

    // Validate and update settings
    const updatedSettings = { ...mockSecuritySettings };

    // Update individual settings if provided
    if (typeof updates.twoFactorRequired === 'boolean') {
      updatedSettings.twoFactorRequired = updates.twoFactorRequired;
    }
    if (typeof updates.passwordMinLength === 'number' && updates.passwordMinLength >= 6 && updates.passwordMinLength <= 20) {
      updatedSettings.passwordMinLength = updates.passwordMinLength;
    }
    if (typeof updates.maxLoginAttempts === 'number' && updates.maxLoginAttempts >= 3 && updates.maxLoginAttempts <= 10) {
      updatedSettings.maxLoginAttempts = updates.maxLoginAttempts;
    }
    if (typeof updates.sessionTimeout === 'number' && updates.sessionTimeout >= 15 && updates.sessionTimeout <= 1440) {
      updatedSettings.sessionTimeout = updates.sessionTimeout;
    }
    if (typeof updates.ipWhitelisting === 'boolean') {
      updatedSettings.ipWhitelisting = updates.ipWhitelisting;
    }
    if (typeof updates.bruteForceProtection === 'boolean') {
      updatedSettings.bruteForceProtection = updates.bruteForceProtection;
    }
    if (typeof updates.rateLimiting === 'boolean') {
      updatedSettings.rateLimiting = updates.rateLimiting;
    }
    if (typeof updates.securityHeadersEnabled === 'boolean') {
      updatedSettings.securityHeadersEnabled = updates.securityHeadersEnabled;
    }
    if (typeof updates.auditLogging === 'boolean') {
      updatedSettings.auditLogging = updates.auditLogging;
    }
    if (typeof updates.encryptionEnabled === 'boolean') {
      updatedSettings.encryptionEnabled = updates.encryptionEnabled;
    }

    // Update mock data (in real implementation, save to database)
    mockSecuritySettings = updatedSettings;

    // Log the security settings update
    logger.warn('Security settings updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      updatedSettings: Object.keys(updates),
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      data: mockSecuritySettings,
    });
  } catch (error) {
    logger.error('Error in updateSecuritySettings controller:', error);
    next(error);
  }
};

/**
 * Create a new security log entry
 */
export const createSecurityLog = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { event, severity, source, ip, userAgent, details, user } = req.body;

    // Validate required fields
    if (!event || !severity || !source || !ip || !details) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields: event, severity, source, ip, details',
        },
      });
      return;
    }

    logger.info('Creating new security log entry', {
      adminId: req.adminId,
      event,
      severity,
      source,
    });

    // Save to database
    const newLog = await AuditLog.create({
      timestamp: new Date(),
      event,
      severity,
      source,
      ip,
      userAgent: userAgent || 'Unknown',
      details,
      user: user || undefined,
      adminId: req.adminId,
      status: 'open'
    });

    // Log the security event creation
    logger.warn('Security log entry created', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      logId: newLog._id.toString(),
      event,
      severity,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'Security log entry created successfully',
      data: {
        id: newLog._id.toString(),
        timestamp: newLog.timestamp.toISOString(),
        event: newLog.event,
        severity: newLog.severity,
        source: newLog.source,
        ip: newLog.ip,
        userAgent: newLog.userAgent,
        details: newLog.details,
        user: newLog.user,
        status: newLog.status
      },
    });
  } catch (error) {
    logger.error('Error in createSecurityLog controller:', error);
    next(error);
  }
};

/**
 * Update security log status
 */
export const updateSecurityLogStatus = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { logId } = req.params;
    const { status } = req.body;

    if (!['open', 'investigating', 'resolved'].includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid status. Must be one of: open, investigating, resolved',
        },
      });
      return;
    }

    logger.info('Admin updating security log status', {
      adminId: req.adminId,
      logId,
      status,
    });

    // Find and update the log in database
    const updatedLog = await AuditLog.findByIdAndUpdate(
      logId,
      { status },
      { new: true }
    ).lean();

    if (!updatedLog) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Security log not found',
        },
      });
      return;
    }

    // Log the status update
    logger.info('Security log status updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      logId,
      status,
      event: updatedLog.event,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Security log status updated successfully',
      data: {
        id: updatedLog._id.toString(),
        timestamp: updatedLog.timestamp.toISOString(),
        event: updatedLog.event,
        severity: updatedLog.severity,
        source: updatedLog.source,
        ip: updatedLog.ip,
        userAgent: updatedLog.userAgent,
        details: updatedLog.details,
        user: updatedLog.user,
        status: updatedLog.status
      },
    });
  } catch (error) {
    logger.error('Error in updateSecurityLogStatus controller:', error);
    next(error);
  }
};

/**
 * Get security analytics and trends
 */
export const getSecurityAnalytics = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching security analytics', {
      adminId: req.adminId,
      timeframe,
    });

    // Parse timeframe to get date range
    const days = parseInt(timeframe.replace('d', '')) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get analytics from database
    const [
      totalEvents,
      criticalEvents,
      highEvents,
      resolvedEvents,
      eventsBySource,
      eventsBySeverity,
      dailyEvents,
      topThreats
    ] = await Promise.all([
      AuditLog.countDocuments({ timestamp: { $gte: startDate } }),
      AuditLog.countDocuments({ timestamp: { $gte: startDate }, severity: 'critical' }),
      AuditLog.countDocuments({ timestamp: { $gte: startDate }, severity: 'high' }),
      AuditLog.countDocuments({ timestamp: { $gte: startDate }, status: 'resolved' }),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 7 }
      ]),
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate }, severity: { $in: ['high', 'critical'] } } },
        {
          $group: {
            _id: '$event',
            count: { $sum: 1 },
            lastSeen: { $max: '$timestamp' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);

    // Transform aggregation results
    const sourceMap: Record<string, number> = {};
    eventsBySource.forEach((item: { _id: string; count: number }) => {
      sourceMap[item._id || 'Unknown'] = item.count;
    });

    const severityMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    eventsBySeverity.forEach((item: { _id: string; count: number }) => {
      if (item._id) severityMap[item._id] = item.count;
    });

    const analytics = {
      timeframe,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEvents,
        criticalEvents,
        highEvents,
        resolvedEvents,
        averageResolutionTime: 'N/A',
      },
      trends: {
        dailyEvents: dailyEvents.map((d: { count: number }) => d.count),
        eventsBySource: sourceMap,
        eventsBySeverity: severityMap
      },
      topThreats: topThreats.map((t: { _id: string; count: number; lastSeen: Date }) => ({
        type: t._id,
        count: t.count,
        lastSeen: t.lastSeen.toISOString()
      }))
    };

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Error in getSecurityAnalytics controller:', error);
    next(error);
  }
};

/**
 * Run security scan
 */
export const runSecurityScan = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin initiating security scan', {
      adminId: req.adminId,
    });

    // Mock security scan results
    const scanResults = {
      scanId: Date.now().toString(),
      startTime: new Date().toISOString(),
      status: 'completed',
      duration: '45 seconds',
      vulnerabilities: {
        critical: 0,
        high: 1,
        medium: 3,
        low: 7
      },
      findings: [
        {
          severity: 'high',
          category: 'Authentication',
          description: 'Weak password policy detected',
          recommendation: 'Increase minimum password length to 12 characters'
        },
        {
          severity: 'medium',
          category: 'Network',
          description: 'Some endpoints missing rate limiting',
          recommendation: 'Implement rate limiting on all public endpoints'
        },
        {
          severity: 'medium',
          category: 'Headers',
          description: 'Missing security headers on some responses',
          recommendation: 'Ensure all responses include security headers'
        }
      ],
      recommendations: [
        'Enable two-factor authentication for all admin users',
        'Implement IP whitelisting for admin access',
        'Review and update security policies',
        'Conduct regular security training for staff'
      ]
    };

    // Log the security scan
    logger.info('Security scan completed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      scanId: scanResults.scanId,
      vulnerabilities: scanResults.vulnerabilities,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Security scan completed successfully',
      data: scanResults,
    });
  } catch (error) {
    logger.error('Error in runSecurityScan controller:', error);
    next(error);
  }
};