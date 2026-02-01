import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { PlatformSettings } from '../models/PlatformSettings';
import { FeatureFlag } from '../models/FeatureFlag';
import logger from '../utils/logger';

/**
 * Get platform settings
 */
export const getSettings = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching platform settings', {
      adminId: req.adminId,
    });

    const settings = await PlatformSettings.getSettings();

    res.status(200).json({
      success: true,
      data: settings.toJSON(),
    });
  } catch (error) {
    logger.error('Error in getSettings controller:', error);
    next(error);
  }
};

/**
 * Update platform settings
 */
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

    // Build update object, preserving nested structure
    const updateData: Record<string, any> = {};

    // Handle each section separately to allow partial updates
    if (updates.general) {
      Object.keys(updates.general).forEach(key => {
        updateData[`general.${key}`] = updates.general[key];
      });
    }

    if (updates.email) {
      Object.keys(updates.email).forEach(key => {
        // Skip masked password fields
        if (key === 'smtpPassword' && updates.email[key] === '••••••••') return;
        if (key === 'apiKey' && updates.email[key] === '••••••••') return;
        updateData[`email.${key}`] = updates.email[key];
      });
    }

    if (updates.security) {
      Object.keys(updates.security).forEach(key => {
        updateData[`security.${key}`] = updates.security[key];
      });
    }

    if (updates.payment) {
      Object.keys(updates.payment).forEach(key => {
        updateData[`payment.${key}`] = updates.payment[key];
      });
    }

    if (updates.features) {
      Object.keys(updates.features).forEach(key => {
        updateData[`features.${key}`] = updates.features[key];
      });
    }

    if (updates.notifications) {
      Object.keys(updates.notifications).forEach(key => {
        updateData[`notifications.${key}`] = updates.notifications[key];
      });
    }

    if (updates.content) {
      Object.keys(updates.content).forEach(key => {
        updateData[`content.${key}`] = updates.content[key];
      });
    }

    updateData.updatedBy = req.adminEmail || req.adminId;

    const settings = await PlatformSettings.findOneAndUpdate(
      { settingsKey: 'platform_settings' },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    // Log the settings update for audit trail
    logger.warn('Platform settings updated', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      sectionsUpdated: Object.keys(updates),
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Platform settings updated successfully',
      data: settings?.toJSON(),
    });
  } catch (error) {
    logger.error('Error in updateSettings controller:', error);
    next(error);
  }
};

/**
 * Get all feature flags
 */
export const getFeatureFlags = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching feature flags', {
      adminId: req.adminId,
    });

    const flags = await FeatureFlag.find().sort({ category: 1, name: 1 });

    res.status(200).json({
      success: true,
      data: flags,
      total: flags.length,
    });
  } catch (error) {
    logger.error('Error in getFeatureFlags controller:', error);
    next(error);
  }
};

/**
 * Create a new feature flag
 */
export const createFeatureFlag = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      name,
      slug,
      description,
      enabled = false,
      enabledForRoles,
      enabledForUsers,
      enabledForSubscriptionTiers,
      rolloutPercentage,
      category,
      tags
    } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Valid flag name is required',
        },
      });
      return;
    }

    logger.info('Admin creating feature flag', {
      adminId: req.adminId,
      flagName: name,
      enabled,
    });

    // Generate slug if not provided
    const flagSlug = slug || name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    // Check if flag with same slug exists
    const existingFlag = await FeatureFlag.findOne({ slug: flagSlug });
    if (existingFlag) {
      res.status(400).json({
        success: false,
        error: {
          message: `Feature flag with slug '${flagSlug}' already exists`,
        },
      });
      return;
    }

    const flag = await FeatureFlag.create({
      name,
      slug: flagSlug,
      description: description || '',
      enabled,
      enabledForRoles: enabledForRoles || [],
      enabledForUsers: enabledForUsers || [],
      enabledForSubscriptionTiers: enabledForSubscriptionTiers || [],
      rolloutPercentage: rolloutPercentage ?? 100,
      category: category || 'general',
      tags: tags || [],
      createdBy: req.adminEmail || req.adminId || 'system',
    });

    logger.info('Feature flag created', {
      adminId: req.adminId,
      flagId: flag._id.toString(),
      flagSlug: flag.slug,
    });

    res.status(201).json({
      success: true,
      message: 'Feature flag created successfully',
      data: flag,
    });
  } catch (error) {
    logger.error('Error in createFeatureFlag controller:', error);
    next(error);
  }
};

/**
 * Update a feature flag
 */
export const updateFeatureFlag = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { flagName } = req.params;
    const updates = req.body;

    logger.info('Admin updating feature flag', {
      adminId: req.adminId,
      flagName,
      updates: Object.keys(updates),
    });

    // Find flag by slug or name
    const flag = await FeatureFlag.findOneAndUpdate(
      { $or: [{ slug: flagName }, { name: flagName }] },
      {
        $set: {
          ...updates,
          updatedBy: req.adminEmail || req.adminId,
        }
      },
      { new: true, runValidators: true }
    );

    if (!flag) {
      res.status(404).json({
        success: false,
        error: {
          message: `Feature flag '${flagName}' not found`,
        },
      });
      return;
    }

    logger.info('Feature flag updated', {
      adminId: req.adminId,
      flagId: flag._id.toString(),
      flagSlug: flag.slug,
      enabled: flag.enabled,
    });

    res.status(200).json({
      success: true,
      message: 'Feature flag updated successfully',
      data: flag,
    });
  } catch (error) {
    logger.error('Error in updateFeatureFlag controller:', error);
    next(error);
  }
};

/**
 * Delete a feature flag
 */
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

    const flag = await FeatureFlag.findOneAndDelete({
      $or: [{ slug: flagName }, { name: flagName }]
    });

    if (!flag) {
      res.status(404).json({
        success: false,
        error: {
          message: `Feature flag '${flagName}' not found`,
        },
      });
      return;
    }

    logger.warn('Feature flag deleted', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      flagId: flag._id.toString(),
      flagSlug: flag.slug,
    });

    res.status(200).json({
      success: true,
      message: 'Feature flag deleted successfully',
    });
  } catch (error) {
    logger.error('Error in deleteFeatureFlag controller:', error);
    next(error);
  }
};

/**
 * Get system configuration
 */
export const getSystemConfiguration = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching system configuration', {
      adminId: req.adminId,
    });

    // Get platform settings for feature flags
    const platformSettings = await PlatformSettings.getSettings();

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
        adminService: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005',
        marketingService: process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006',
      },
      database: {
        mongodb: {
          connected: true,
          host: process.env.MONGO_HOST || 'mongodb',
          database: process.env.MONGO_DB || 'cloudmastershub',
        },
        redis: {
          host: process.env.REDIS_HOST || 'redis',
          port: process.env.REDIS_PORT || '6379',
        },
      },
      features: platformSettings.features,
      maintenanceMode: platformSettings.general.maintenanceMode,
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

/**
 * Toggle maintenance mode
 */
export const maintenanceMode = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { enabled, message } = req.body;

    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        error: {
          message: 'enabled field must be a boolean',
        },
      });
      return;
    }

    logger.info('Admin updating maintenance mode', {
      adminId: req.adminId,
      enabled,
      message: message ? 'provided' : 'none',
    });

    const settings = await PlatformSettings.findOneAndUpdate(
      { settingsKey: 'platform_settings' },
      {
        $set: {
          'general.maintenanceMode': enabled,
          'general.maintenanceMessage': message || '',
          updatedBy: req.adminEmail || req.adminId,
        }
      },
      { new: true, upsert: true }
    );

    // Log maintenance mode change with high priority
    logger.warn('Maintenance mode changed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      enabled,
      message,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
      data: {
        maintenanceMode: settings?.general.maintenanceMode,
        maintenanceMessage: settings?.general.maintenanceMessage,
      },
    });
  } catch (error) {
    logger.error('Error in maintenanceMode controller:', error);
    next(error);
  }
};
