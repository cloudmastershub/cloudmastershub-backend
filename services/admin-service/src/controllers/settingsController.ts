import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { PlatformSettings } from '@cloudmastershub/types';
import logger from '../utils/logger';

// Mock settings data - in real implementation, this would come from a database
let mockSettings: PlatformSettings = {
  general: {
    siteName: 'CloudMastersHub',
    siteDescription: 'Premier cloud learning platform for AWS, Azure, and GCP',
    supportEmail: 'support@cloudmastershub.com',
    maintenanceMode: false,
    maintenanceMessage: '',
    defaultLanguage: 'en',
    timezone: 'UTC',
  },
  security: {
    passwordMinLength: 8,
    passwordRequireSpecialChars: true,
    sessionTimeout: 480, // 8 hours
    maxLoginAttempts: 5,
    lockoutDuration: 30, // 30 minutes
    twoFactorRequired: false,
  },
  payment: {
    currency: 'USD',
    taxRate: 0.08, // 8%
    refundWindow: 30, // 30 days
    stripeEnabled: true,
    paypalEnabled: false,
    trialPeriod: 14, // 14 days
  },
  content: {
    autoApproveContent: false,
    maxCourseSize: 5000, // 5GB in MB
    allowedVideoFormats: ['mp4', 'mov', 'avi'],
    maxVideoDuration: 180, // 3 hours
    requireCoursePreview: true,
    contentModerationEnabled: true,
  },
  email: {
    fromName: 'CloudMastersHub',
    fromEmail: 'noreply@cloudmastershub.com',
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
    smtpSecure: true,
    welcomeEmailEnabled: true,
    courseUpdateNotifications: true,
    paymentNotifications: true,
  },
  features: {
    labEnvironments: {
      enabled: true,
      description: 'Interactive cloud lab environments',
      lastModified: new Date('2024-12-01'),
      modifiedBy: 'admin@cloudmastershub.com',
    },
    learningPaths: {
      enabled: true,
      description: 'Curated learning pathways',
      lastModified: new Date('2024-12-01'),
      modifiedBy: 'admin@cloudmastershub.com',
    },
    aiRecommendations: {
      enabled: false,
      description: 'AI-powered course recommendations',
      lastModified: new Date('2024-11-15'),
      modifiedBy: 'admin@cloudmastershub.com',
    },
    socialLearning: {
      enabled: true,
      description: 'Community features and discussions',
      lastModified: new Date('2024-11-20'),
      modifiedBy: 'admin@cloudmastershub.com',
    },
    betaFeatures: {
      enabled: false,
      description: 'Access to beta features for testing',
      lastModified: new Date('2024-12-10'),
      modifiedBy: 'admin@cloudmastershub.com',
    },
  },
};

export const getSettings = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching platform settings', {
      adminId: req.adminId,
    });

    // In real implementation, fetch from database
    res.status(200).json({
      success: true,
      data: mockSettings,
    });
  } catch (error) {
    logger.error('Error in getSettings controller:', error);
    next(error);
  }
};

export const updateSettings = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updates = req.body;

    logger.info('Admin updating platform settings', {
      adminId: req.adminId,
      sectionsUpdated: Object.keys(updates),
    });

    // Validate and merge updates
    const updatedSettings = { ...mockSettings };

    if (updates.general) {
      updatedSettings.general = { ...updatedSettings.general, ...updates.general };
    }
    if (updates.security) {
      updatedSettings.security = { ...updatedSettings.security, ...updates.security };
    }
    if (updates.payment) {
      updatedSettings.payment = { ...updatedSettings.payment, ...updates.payment };
    }
    if (updates.content) {
      updatedSettings.content = { ...updatedSettings.content, ...updates.content };
    }
    if (updates.email) {
      updatedSettings.email = { ...updatedSettings.email, ...updates.email };
    }

    // Update mock data (in real implementation, save to database)
    mockSettings = updatedSettings;

    // Log the settings update
    logger.info('Platform settings updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      updatedSections: Object.keys(updates),
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: mockSettings,
    });
  } catch (error) {
    logger.error('Error in updateSettings controller:', error);
    next(error);
  }
};

export const getFeatureFlags = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching feature flags', {
      adminId: req.adminId,
    });

    res.status(200).json({
      success: true,
      data: mockSettings.features,
    });
  } catch (error) {
    logger.error('Error in getFeatureFlags controller:', error);
    next(error);
  }
};

export const updateFeatureFlag = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { flagName } = req.params;
    const { enabled, description } = req.body;

    logger.info('Admin updating feature flag', {
      adminId: req.adminId,
      flagName,
      enabled,
    });

    if (!mockSettings.features[flagName]) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Feature flag not found',
        },
      });
      return;
    }

    // Update the feature flag
    mockSettings.features[flagName] = {
      ...mockSettings.features[flagName],
      enabled,
      ...(description && { description }),
      lastModified: new Date(),
      modifiedBy: req.adminEmail || 'admin',
    };

    // Log the feature flag update
    logger.info('Feature flag updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      flagName,
      enabled,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Feature flag '${flagName}' updated successfully`,
      data: mockSettings.features[flagName],
    });
  } catch (error) {
    logger.error('Error in updateFeatureFlag controller:', error);
    next(error);
  }
};

export const createFeatureFlag = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { flagName, enabled = false, description } = req.body;

    if (!flagName || typeof flagName !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Valid flag name is required',
        },
      });
      return;
    }

    if (mockSettings.features[flagName]) {
      res.status(409).json({
        success: false,
        error: {
          message: 'Feature flag already exists',
        },
      });
      return;
    }

    logger.info('Admin creating feature flag', {
      adminId: req.adminId,
      flagName,
      enabled,
      description,
    });

    // Create the new feature flag
    mockSettings.features[flagName] = {
      enabled,
      description: description || `Feature flag: ${flagName}`,
      lastModified: new Date(),
      modifiedBy: req.adminEmail || 'admin',
    };

    // Log the feature flag creation
    logger.info('Feature flag created', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      flagName,
      enabled,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: `Feature flag '${flagName}' created successfully`,
      data: mockSettings.features[flagName],
    });
  } catch (error) {
    logger.error('Error in createFeatureFlag controller:', error);
    next(error);
  }
};

export const deleteFeatureFlag = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { flagName } = req.params;

    logger.info('Admin deleting feature flag', {
      adminId: req.adminId,
      flagName,
    });

    if (!mockSettings.features[flagName]) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Feature flag not found',
        },
      });
      return;
    }

    // Delete the feature flag
    delete mockSettings.features[flagName];

    // Log the feature flag deletion
    logger.info('Feature flag deleted', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      flagName,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Feature flag '${flagName}' deleted successfully`,
    });
  } catch (error) {
    logger.error('Error in deleteFeatureFlag controller:', error);
    next(error);
  }
};

export const getSystemConfiguration = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching system configuration', {
      adminId: req.adminId,
    });

    const systemConfig = {
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      deployment: {
        buildTime: process.env.BUILD_TIME || new Date().toISOString(),
        gitCommit: process.env.GIT_COMMIT || 'unknown',
        imageTag: process.env.IMAGE_TAG || 'latest',
      },
      services: {
        apiGateway: process.env.API_GATEWAY_URL || 'http://api-gateway:3000',
        userService: process.env.USER_SERVICE_URL || 'http://user-service:3001',
        courseService: process.env.COURSE_SERVICE_URL || 'http://course-service:3002',
        labService: process.env.LAB_SERVICE_URL || 'http://lab-service:3003',
        paymentService: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004',
      },
      database: {
        postgresql: {
          host: process.env.DB_HOST || 'postgres',
          port: process.env.DB_PORT || '5432',
          database: process.env.DB_NAME || 'cloudmastershub',
        },
        mongodb: {
          host: process.env.MONGO_HOST || 'mongodb',
          port: process.env.MONGO_PORT || '27017',
          database: process.env.MONGO_DB || 'cloudmastershub',
        },
        redis: {
          host: process.env.REDIS_HOST || 'redis',
          port: process.env.REDIS_PORT || '6379',
        },
      },
      features: mockSettings.features,
    };

    res.status(200).json({
      success: true,
      data: systemConfig,
    });
  } catch (error) {
    logger.error('Error in getSystemConfiguration controller:', error);
    next(error);
  }
};

export const maintenanceMode = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { enabled, message } = req.body;

    logger.info('Admin updating maintenance mode', {
      adminId: req.adminId,
      enabled,
      message: message ? 'provided' : 'none',
    });

    // Update maintenance mode settings
    mockSettings.general.maintenanceMode = enabled;
    if (message) {
      mockSettings.general.maintenanceMessage = message;
    }

    // Log the maintenance mode change
    logger.warn('Maintenance mode updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      enabled,
      message,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        maintenanceMode: mockSettings.general.maintenanceMode,
        maintenanceMessage: mockSettings.general.maintenanceMessage,
      },
    });
  } catch (error) {
    logger.error('Error in maintenanceMode controller:', error);
    next(error);
  }
};
