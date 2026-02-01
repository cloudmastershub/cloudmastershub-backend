import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformSettings extends Document {
  _id: mongoose.Types.ObjectId;
  // Use a singleton pattern - only one settings document with this key
  settingsKey: string;

  general: {
    siteName: string;
    siteDescription: string;
    supportEmail: string;
    adminEmail: string;
    maintenanceMode: boolean;
    maintenanceMessage?: string;
    registrationEnabled: boolean;
    emailVerificationRequired: boolean;
    defaultLanguage: string;
    timezone: string;
  };

  email: {
    provider: 'smtp' | 'sendgrid' | 'ses' | 'mailgun';
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    smtpSecure?: boolean;
    apiKey?: string;
    fromEmail: string;
    fromName: string;
    welcomeEmailEnabled: boolean;
    courseUpdateNotifications: boolean;
    paymentNotifications: boolean;
  };

  security: {
    passwordMinLength: number;
    passwordRequireSpecialChars: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireUppercase: boolean;
    maxLoginAttempts: number;
    lockoutDuration: number;
    sessionTimeout: number;
    twoFactorRequired: boolean;
    allowedDomains: string[];
    // Extended security settings
    ipWhitelisting: boolean;
    bruteForceProtection: boolean;
    rateLimiting: boolean;
    securityHeadersEnabled: boolean;
    auditLogging: boolean;
    encryptionEnabled: boolean;
  };

  payment: {
    currency: string;
    taxRate: number;
    trialPeriod: number;
    refundWindow: number;
    gracePeriodDays: number;
    stripeEnabled: boolean;
    paypalEnabled: boolean;
    allowDowngrades: boolean;
  };

  features: {
    referralProgram: boolean;
    videoStreaming: boolean;
    liveClasses: boolean;
    downloadableContent: boolean;
    certificates: boolean;
    discussions: boolean;
    labEnvironments: boolean;
    learningPaths: boolean;
    aiRecommendations: boolean;
    socialLearning: boolean;
    betaFeatures: boolean;
  };

  notifications: {
    newUserSignup: boolean;
    coursePublished: boolean;
    paymentReceived: boolean;
    systemAlerts: boolean;
    weeklyReports: boolean;
    instructorApplications: boolean;
    supportTickets: boolean;
  };

  content: {
    autoApproveContent: boolean;
    maxCourseSize: number;
    allowedVideoFormats: string[];
    maxVideoDuration: number;
    requireCoursePreview: boolean;
    contentModerationEnabled: boolean;
  };

  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>({
  settingsKey: {
    type: String,
    default: 'platform_settings',
    unique: true,
    required: true
  },

  general: {
    siteName: { type: String, default: 'CloudMastersHub' },
    siteDescription: { type: String, default: 'Premier cloud learning platform for AWS, Azure, and GCP' },
    supportEmail: { type: String, default: 'support@cloudmastershub.com' },
    adminEmail: { type: String, default: 'admin@cloudmastershub.com' },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: '' },
    registrationEnabled: { type: Boolean, default: true },
    emailVerificationRequired: { type: Boolean, default: true },
    defaultLanguage: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' }
  },

  email: {
    provider: { type: String, enum: ['smtp', 'sendgrid', 'ses', 'mailgun'], default: 'smtp' },
    smtpHost: { type: String, default: 'smtp.mailgun.org' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    smtpPassword: { type: String, default: '' },
    smtpSecure: { type: Boolean, default: true },
    apiKey: { type: String, default: '' },
    fromEmail: { type: String, default: 'noreply@cloudmastershub.com' },
    fromName: { type: String, default: 'CloudMastersHub' },
    welcomeEmailEnabled: { type: Boolean, default: true },
    courseUpdateNotifications: { type: Boolean, default: true },
    paymentNotifications: { type: Boolean, default: true }
  },

  security: {
    passwordMinLength: { type: Number, default: 8, min: 6, max: 32 },
    passwordRequireSpecialChars: { type: Boolean, default: true },
    passwordRequireNumbers: { type: Boolean, default: true },
    passwordRequireUppercase: { type: Boolean, default: true },
    maxLoginAttempts: { type: Number, default: 5, min: 3, max: 10 },
    lockoutDuration: { type: Number, default: 30 },
    sessionTimeout: { type: Number, default: 480 },
    twoFactorRequired: { type: Boolean, default: false },
    allowedDomains: { type: [String], default: [] },
    // Extended security settings
    ipWhitelisting: { type: Boolean, default: false },
    bruteForceProtection: { type: Boolean, default: true },
    rateLimiting: { type: Boolean, default: true },
    securityHeadersEnabled: { type: Boolean, default: true },
    auditLogging: { type: Boolean, default: true },
    encryptionEnabled: { type: Boolean, default: true }
  },

  payment: {
    currency: { type: String, default: 'USD' },
    taxRate: { type: Number, default: 0 },
    trialPeriod: { type: Number, default: 14 },
    refundWindow: { type: Number, default: 30 },
    gracePeriodDays: { type: Number, default: 3 },
    stripeEnabled: { type: Boolean, default: true },
    paypalEnabled: { type: Boolean, default: false },
    allowDowngrades: { type: Boolean, default: true }
  },

  features: {
    referralProgram: { type: Boolean, default: true },
    videoStreaming: { type: Boolean, default: true },
    liveClasses: { type: Boolean, default: false },
    downloadableContent: { type: Boolean, default: true },
    certificates: { type: Boolean, default: true },
    discussions: { type: Boolean, default: true },
    labEnvironments: { type: Boolean, default: true },
    learningPaths: { type: Boolean, default: true },
    aiRecommendations: { type: Boolean, default: false },
    socialLearning: { type: Boolean, default: true },
    betaFeatures: { type: Boolean, default: false }
  },

  notifications: {
    newUserSignup: { type: Boolean, default: true },
    coursePublished: { type: Boolean, default: true },
    paymentReceived: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
    weeklyReports: { type: Boolean, default: false },
    instructorApplications: { type: Boolean, default: true },
    supportTickets: { type: Boolean, default: true }
  },

  content: {
    autoApproveContent: { type: Boolean, default: false },
    maxCourseSize: { type: Number, default: 5000 },
    allowedVideoFormats: { type: [String], default: ['mp4', 'mov', 'avi', 'webm'] },
    maxVideoDuration: { type: Number, default: 180 },
    requireCoursePreview: { type: Boolean, default: true },
    contentModerationEnabled: { type: Boolean, default: true }
  },

  updatedBy: { type: String }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      // Remove sensitive data from responses
      if (ret.email?.smtpPassword) {
        ret.email.smtpPassword = '••••••••';
      }
      if (ret.email?.apiKey) {
        ret.email.apiKey = '••••••••';
      }
      return ret;
    }
  }
});

// Ensure only one settings document exists
PlatformSettingsSchema.index({ settingsKey: 1 }, { unique: true });

// Static method to get or create settings
PlatformSettingsSchema.statics.getSettings = async function(): Promise<IPlatformSettings> {
  let settings = await this.findOne({ settingsKey: 'platform_settings' });
  if (!settings) {
    settings = await this.create({ settingsKey: 'platform_settings' });
  }
  return settings;
};

// Static method to update settings
PlatformSettingsSchema.statics.updateSettings = async function(
  updates: Partial<IPlatformSettings>,
  adminId?: string
): Promise<IPlatformSettings> {
  const settings = await this.findOneAndUpdate(
    { settingsKey: 'platform_settings' },
    {
      $set: {
        ...updates,
        updatedBy: adminId
      }
    },
    {
      new: true,
      upsert: true,
      runValidators: true
    }
  );
  return settings;
};

export interface IPlatformSettingsModel extends mongoose.Model<IPlatformSettings> {
  getSettings(): Promise<IPlatformSettings>;
  updateSettings(updates: Partial<IPlatformSettings>, adminId?: string): Promise<IPlatformSettings>;
}

export const PlatformSettings = mongoose.model<IPlatformSettings, IPlatformSettingsModel>(
  'PlatformSettings',
  PlatformSettingsSchema
);

export default PlatformSettings;
