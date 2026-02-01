import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import logger from '../utils/logger';
import { AuditLog } from '../models/AuditLog';
import { PlatformSettings } from '../models/PlatformSettings';

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
 * Get security settings from database
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

    // Get security settings from PlatformSettings database
    const settings = await PlatformSettings.getSettings();
    const securitySettings = settings.security;

    // Transform to frontend-expected format
    const response: SecuritySettings = {
      twoFactorRequired: securitySettings.twoFactorRequired ?? false,
      passwordMinLength: securitySettings.passwordMinLength ?? 8,
      maxLoginAttempts: securitySettings.maxLoginAttempts ?? 5,
      sessionTimeout: securitySettings.sessionTimeout ?? 480,
      ipWhitelisting: securitySettings.ipWhitelisting ?? false,
      bruteForceProtection: securitySettings.bruteForceProtection ?? true,
      rateLimiting: securitySettings.rateLimiting ?? true,
      securityHeadersEnabled: securitySettings.securityHeadersEnabled ?? true,
      auditLogging: securitySettings.auditLogging ?? true,
      encryptionEnabled: securitySettings.encryptionEnabled ?? true,
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error in getSecuritySettings controller:', error);
    next(error);
  }
};

/**
 * Update security settings in database
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

    // Build update object for nested security fields
    const updateData: Record<string, any> = {};

    // Map and validate security settings
    const securityFields: Array<{ key: string; validator?: (val: any) => boolean }> = [
      { key: 'twoFactorRequired', validator: (v) => typeof v === 'boolean' },
      { key: 'passwordMinLength', validator: (v) => typeof v === 'number' && v >= 6 && v <= 32 },
      { key: 'maxLoginAttempts', validator: (v) => typeof v === 'number' && v >= 3 && v <= 10 },
      { key: 'sessionTimeout', validator: (v) => typeof v === 'number' && v >= 15 && v <= 1440 },
      { key: 'ipWhitelisting', validator: (v) => typeof v === 'boolean' },
      { key: 'bruteForceProtection', validator: (v) => typeof v === 'boolean' },
      { key: 'rateLimiting', validator: (v) => typeof v === 'boolean' },
      { key: 'securityHeadersEnabled', validator: (v) => typeof v === 'boolean' },
      { key: 'auditLogging', validator: (v) => typeof v === 'boolean' },
      { key: 'encryptionEnabled', validator: (v) => typeof v === 'boolean' },
    ];

    securityFields.forEach(({ key, validator }) => {
      if (updates[key] !== undefined) {
        if (!validator || validator(updates[key])) {
          updateData[`security.${key}`] = updates[key];
        } else {
          logger.warn(`Invalid value for security setting: ${key}`, { value: updates[key] });
        }
      }
    });

    updateData.updatedBy = req.adminEmail || req.adminId;

    // Update database
    const settings = await PlatformSettings.findOneAndUpdate(
      { settingsKey: 'platform_settings' },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    // Log the security settings update for audit trail
    logger.warn('Security settings updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      updatedFields: Object.keys(updates),
      timestamp: new Date().toISOString(),
    });

    // Create audit log entry for security settings change
    try {
      await AuditLog.create({
        timestamp: new Date(),
        event: 'Security settings updated',
        severity: 'medium',
        source: 'admin-service',
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        details: `Updated fields: ${Object.keys(updates).join(', ')}`,
        user: req.adminEmail,
        adminId: req.adminId,
        status: 'resolved'
      });
    } catch (auditError) {
      logger.error('Failed to create audit log for security settings update:', auditError);
    }

    // Return updated settings in frontend format
    const securitySettings = settings?.security || {};
    const response: SecuritySettings = {
      twoFactorRequired: securitySettings.twoFactorRequired ?? false,
      passwordMinLength: securitySettings.passwordMinLength ?? 8,
      maxLoginAttempts: securitySettings.maxLoginAttempts ?? 5,
      sessionTimeout: securitySettings.sessionTimeout ?? 480,
      ipWhitelisting: securitySettings.ipWhitelisting ?? false,
      bruteForceProtection: securitySettings.bruteForceProtection ?? true,
      rateLimiting: securitySettings.rateLimiting ?? true,
      securityHeadersEnabled: securitySettings.securityHeadersEnabled ?? true,
      auditLogging: securitySettings.auditLogging ?? true,
      encryptionEnabled: securitySettings.encryptionEnabled ?? true,
    };

    res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      data: response,
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
 * Run security scan - checks platform security configuration and recent threats
 */
export const runSecurityScan = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();

    logger.info('Admin initiating security scan', {
      adminId: req.adminId,
    });

    // Get current security settings from database
    const settings = await PlatformSettings.getSettings();
    const securitySettings = settings.security;

    // Get recent security incidents
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentIncidents, criticalIncidents, unresolvedIncidents] = await Promise.all([
      AuditLog.countDocuments({ timestamp: { $gte: thirtyDaysAgo } }),
      AuditLog.countDocuments({ timestamp: { $gte: thirtyDaysAgo }, severity: 'critical' }),
      AuditLog.countDocuments({ status: { $in: ['open', 'investigating'] } }),
    ]);

    // Analyze security configuration and generate findings
    const findings: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      category: string;
      description: string;
      recommendation: string;
    }> = [];

    const recommendations: string[] = [];
    const vulnerabilities = { critical: 0, high: 0, medium: 0, low: 0 };

    // Check password policy
    if (securitySettings.passwordMinLength < 10) {
      findings.push({
        severity: securitySettings.passwordMinLength < 8 ? 'high' : 'medium',
        category: 'Authentication',
        description: `Password minimum length is ${securitySettings.passwordMinLength} characters`,
        recommendation: 'Increase minimum password length to at least 12 characters for better security',
      });
      vulnerabilities[securitySettings.passwordMinLength < 8 ? 'high' : 'medium']++;
    }

    // Check 2FA
    if (!securitySettings.twoFactorRequired) {
      findings.push({
        severity: 'medium',
        category: 'Authentication',
        description: 'Two-factor authentication is not required',
        recommendation: 'Enable mandatory two-factor authentication for admin users',
      });
      vulnerabilities.medium++;
      recommendations.push('Enable two-factor authentication for all admin users');
    }

    // Check brute force protection
    if (!securitySettings.bruteForceProtection) {
      findings.push({
        severity: 'high',
        category: 'Authentication',
        description: 'Brute force protection is disabled',
        recommendation: 'Enable brute force protection to prevent password guessing attacks',
      });
      vulnerabilities.high++;
    }

    // Check rate limiting
    if (!securitySettings.rateLimiting) {
      findings.push({
        severity: 'medium',
        category: 'Network',
        description: 'API rate limiting is disabled',
        recommendation: 'Enable rate limiting to prevent API abuse and DDoS attacks',
      });
      vulnerabilities.medium++;
    }

    // Check security headers
    if (!securitySettings.securityHeadersEnabled) {
      findings.push({
        severity: 'medium',
        category: 'Headers',
        description: 'Security headers are not enabled',
        recommendation: 'Enable security headers (HSTS, CSP, X-Frame-Options) for all responses',
      });
      vulnerabilities.medium++;
    }

    // Check audit logging
    if (!securitySettings.auditLogging) {
      findings.push({
        severity: 'high',
        category: 'Compliance',
        description: 'Audit logging is disabled',
        recommendation: 'Enable audit logging for compliance and security monitoring',
      });
      vulnerabilities.high++;
    }

    // Check encryption
    if (!securitySettings.encryptionEnabled) {
      findings.push({
        severity: 'critical',
        category: 'Data Protection',
        description: 'Data encryption is disabled',
        recommendation: 'Enable encryption for sensitive data at rest',
      });
      vulnerabilities.critical++;
    }

    // Check session timeout (very long sessions are a risk)
    if (securitySettings.sessionTimeout > 720) {
      findings.push({
        severity: 'low',
        category: 'Session Management',
        description: `Session timeout is ${securitySettings.sessionTimeout} minutes (12+ hours)`,
        recommendation: 'Consider reducing session timeout to 8 hours or less for better security',
      });
      vulnerabilities.low++;
    }

    // Check max login attempts
    if (securitySettings.maxLoginAttempts > 5) {
      findings.push({
        severity: 'low',
        category: 'Authentication',
        description: `Maximum login attempts is set to ${securitySettings.maxLoginAttempts}`,
        recommendation: 'Consider reducing maximum login attempts to 5 or fewer',
      });
      vulnerabilities.low++;
    }

    // Check for unresolved security incidents
    if (unresolvedIncidents > 0) {
      findings.push({
        severity: unresolvedIncidents > 10 ? 'high' : 'medium',
        category: 'Incident Response',
        description: `${unresolvedIncidents} unresolved security incident(s)`,
        recommendation: 'Review and resolve pending security incidents',
      });
      vulnerabilities[unresolvedIncidents > 10 ? 'high' : 'medium']++;
      recommendations.push(`Investigate and resolve ${unresolvedIncidents} pending security incident(s)`);
    }

    // Check for critical incidents
    if (criticalIncidents > 0) {
      findings.push({
        severity: 'high',
        category: 'Threat Detection',
        description: `${criticalIncidents} critical security incident(s) in the last 30 days`,
        recommendation: 'Review critical incidents and implement additional security measures',
      });
      recommendations.push('Review root cause of critical security incidents');
    }

    // Add general recommendations based on configuration
    if (!securitySettings.ipWhitelisting) {
      recommendations.push('Consider implementing IP whitelisting for admin access');
    }
    recommendations.push('Conduct regular security awareness training for staff');
    recommendations.push('Review and update security policies periodically');

    // Calculate scan duration
    const duration = Date.now() - startTime;

    // Calculate security score based on findings
    const totalVulns = vulnerabilities.critical * 10 + vulnerabilities.high * 5 + vulnerabilities.medium * 2 + vulnerabilities.low;
    const securityScore = Math.max(0, Math.min(100, 100 - totalVulns * 3));

    const scanResults = {
      scanId: `scan-${Date.now()}`,
      startTime: new Date(startTime).toISOString(),
      completedTime: new Date().toISOString(),
      status: 'completed',
      duration: `${duration}ms`,
      securityScore,
      vulnerabilities,
      findings,
      recommendations: recommendations.slice(0, 10), // Limit to top 10 recommendations
      statistics: {
        recentIncidents,
        criticalIncidents,
        unresolvedIncidents,
        checksPerformed: 10,
      },
    };

    // Log the security scan to audit trail
    try {
      await AuditLog.create({
        timestamp: new Date(),
        event: 'Security scan completed',
        severity: vulnerabilities.critical > 0 ? 'high' : vulnerabilities.high > 0 ? 'medium' : 'low',
        source: 'admin-service',
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        details: `Scan found ${findings.length} issues. Security score: ${securityScore}/100`,
        user: req.adminEmail,
        adminId: req.adminId,
        status: 'resolved'
      });
    } catch (auditError) {
      logger.error('Failed to create audit log for security scan:', auditError);
    }

    // Log the security scan
    logger.info('Security scan completed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      scanId: scanResults.scanId,
      securityScore,
      vulnerabilities,
      findingsCount: findings.length,
      duration: `${duration}ms`,
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