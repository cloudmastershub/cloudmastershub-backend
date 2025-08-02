import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import logger from '../utils/logger';

// Security Log Interface
interface SecurityLog {
  id: string;
  timestamp: string;
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  user?: string;
  ip: string;
  userAgent: string;
  details: string;
  status: 'resolved' | 'investigating' | 'open';
}

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

// Mock security data - in real implementation, this would come from databases and security services
let mockSecurityLogs: SecurityLog[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    event: 'Failed login attempt',
    severity: 'medium',
    source: 'Authentication',
    user: 'unknown@example.com',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    details: 'Multiple failed password attempts detected',
    status: 'investigating'
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    event: 'Suspicious API activity',
    severity: 'high',
    source: 'API Gateway',
    ip: '203.0.113.45',
    userAgent: 'curl/7.68.0',
    details: 'Unusual rate of API requests detected',
    status: 'open'
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    event: 'Blocked malicious request',
    severity: 'critical',
    source: 'WAF',
    ip: '198.51.100.75',
    userAgent: 'sqlmap/1.4.9',
    details: 'SQL injection attempt blocked',
    status: 'resolved'
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    event: 'Admin login',
    severity: 'low',
    source: 'Authentication',
    user: 'admin@cloudmastershub.com',
    ip: '10.0.0.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    details: 'Successful admin authentication',
    status: 'resolved'
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    event: 'Unauthorized access attempt',
    severity: 'high',
    source: 'Authorization',
    user: 'user@example.com',
    ip: '172.16.0.50',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    details: 'Attempt to access admin panel without proper permissions',
    status: 'resolved'
  }
];

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

    const metrics: SecurityMetrics = {
      totalIncidents: mockSecurityLogs.length,
      activeThreats: mockSecurityLogs.filter(log => log.status === 'open' || log.status === 'investigating').length,
      blockedAttacks: 156,
      suspiciousLogins: mockSecurityLogs.filter(log => log.event.includes('login') && log.severity !== 'low').length,
      securityScore: 85,
      lastScanTime: new Date().toISOString(),
      vulnerabilities: {
        critical: 0,
        high: 1,
        medium: 3,
        low: 7
      }
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

    // Filter logs based on query parameters
    let filteredLogs = [...mockSecurityLogs];

    if (severity) {
      filteredLogs = filteredLogs.filter(log => log.severity === severity);
    }

    if (status) {
      filteredLogs = filteredLogs.filter(log => log.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.event.toLowerCase().includes(searchLower) ||
        log.source.toLowerCase().includes(searchLower) ||
        log.details.toLowerCase().includes(searchLower) ||
        log.user?.toLowerCase().includes(searchLower) ||
        log.ip.includes(search)
      );
    }

    // Sort by timestamp (most recent first)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    const response = {
      logs: paginatedLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: filteredLogs.length,
        totalPages: Math.ceil(filteredLogs.length / Number(limit))
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

    const newLog: SecurityLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      event,
      severity,
      source,
      ip,
      userAgent: userAgent || 'Unknown',
      details,
      user: user || undefined,
      status: 'open'
    };

    // Add to mock data (in real implementation, save to database)
    mockSecurityLogs.unshift(newLog);

    // Log the security event creation
    logger.warn('Security log entry created', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      logId: newLog.id,
      event,
      severity,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'Security log entry created successfully',
      data: newLog,
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

    // Find and update the log
    const logIndex = mockSecurityLogs.findIndex(log => log.id === logId);
    if (logIndex === -1) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Security log not found',
        },
      });
      return;
    }

    mockSecurityLogs[logIndex].status = status;

    // Log the status update
    logger.info('Security log status updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      logId,
      status,
      event: mockSecurityLogs[logIndex].event,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Security log status updated successfully',
      data: mockSecurityLogs[logIndex],
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

    // Generate analytics based on timeframe
    const analytics = {
      timeframe,
      generatedAt: new Date().toISOString(),
      summary: {
        totalEvents: mockSecurityLogs.length,
        criticalEvents: mockSecurityLogs.filter(log => log.severity === 'critical').length,
        highEvents: mockSecurityLogs.filter(log => log.severity === 'high').length,
        resolvedEvents: mockSecurityLogs.filter(log => log.status === 'resolved').length,
        averageResolutionTime: '2.3 hours', // Mock data
      },
      trends: {
        dailyEvents: [12, 8, 15, 22, 18, 9, 14], // Last 7 days
        eventsBySource: {
          'Authentication': 15,
          'API Gateway': 8,
          'WAF': 12,
          'Authorization': 6,
          'Database': 2
        },
        eventsBySeverity: {
          'low': 20,
          'medium': 12,
          'high': 8,
          'critical': 3
        }
      },
      topThreats: [
        {
          type: 'Failed login attempts',
          count: 15,
          lastSeen: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        },
        {
          type: 'SQL injection attempts',
          count: 8,
          lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
        },
        {
          type: 'Unauthorized access',
          count: 6,
          lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
        }
      ]
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