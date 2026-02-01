import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityLog extends Document {
  _id: mongoose.Types.ObjectId;
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  user?: string;
  userId?: string;
  ip: string;
  userAgent: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SecurityLogSchema = new Schema<ISecurityLog>({
  event: {
    type: String,
    required: true,
    trim: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: String,
    trim: true
  },
  userId: {
    type: String,
    trim: true
  },
  ip: {
    type: String,
    required: true,
    trim: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  details: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['open', 'investigating', 'resolved'],
    default: 'open'
  },
  resolvedBy: {
    type: String
  },
  resolvedAt: {
    type: Date
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.timestamp = ret.createdAt;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for efficient querying
SecurityLogSchema.index({ createdAt: -1 });
SecurityLogSchema.index({ severity: 1 });
SecurityLogSchema.index({ status: 1 });
SecurityLogSchema.index({ source: 1 });
SecurityLogSchema.index({ userId: 1 });
SecurityLogSchema.index({ ip: 1 });

// Static methods
SecurityLogSchema.statics.logEvent = async function(
  event: string,
  options: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    user?: string;
    userId?: string;
    ip: string;
    userAgent?: string;
    details?: string;
    metadata?: Record<string, any>;
  }
): Promise<ISecurityLog> {
  return this.create({
    event,
    severity: options.severity || 'low',
    source: options.source,
    user: options.user,
    userId: options.userId,
    ip: options.ip,
    userAgent: options.userAgent || '',
    details: options.details || '',
    metadata: options.metadata || {},
    status: 'open'
  });
};

SecurityLogSchema.statics.getMetrics = async function(timeframeDays: number = 30) {
  const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

  const [metrics, vulnerabilities] = await Promise.all([
    this.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalIncidents: { $sum: 1 },
          activeThreats: {
            $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] }
          },
          blockedAttacks: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$event', regex: /blocked|prevented|denied/i } },
                1,
                0
              ]
            }
          },
          suspiciousLogins: {
            $sum: {
              $cond: [
                { $regexMatch: { input: '$event', regex: /login|auth|failed/i } },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    this.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'resolved' }
        }
      },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const metricsResult = metrics[0] || {
    totalIncidents: 0,
    activeThreats: 0,
    blockedAttacks: 0,
    suspiciousLogins: 0
  };

  const vulnMap: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  vulnerabilities.forEach((v: any) => {
    if (v._id && vulnMap.hasOwnProperty(v._id)) {
      vulnMap[v._id] = v.count;
    }
  });

  // Calculate security score (100 - weighted vulnerabilities)
  const totalVulns = vulnMap.critical * 10 + vulnMap.high * 5 + vulnMap.medium * 2 + vulnMap.low;
  const maxScore = 100;
  const securityScore = Math.max(0, Math.min(maxScore, maxScore - Math.round(totalVulns * 2)));

  return {
    ...metricsResult,
    securityScore,
    vulnerabilities: vulnMap
  };
};

export interface ISecurityLogModel extends mongoose.Model<ISecurityLog> {
  logEvent(
    event: string,
    options: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      source: string;
      user?: string;
      userId?: string;
      ip: string;
      userAgent?: string;
      details?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ISecurityLog>;
  getMetrics(timeframeDays?: number): Promise<{
    totalIncidents: number;
    activeThreats: number;
    blockedAttacks: number;
    suspiciousLogins: number;
    securityScore: number;
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  }>;
}

export const SecurityLog = mongoose.model<ISecurityLog, ISecurityLogModel>(
  'SecurityLog',
  SecurityLogSchema
);

export default SecurityLog;
