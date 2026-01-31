import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  timestamp: Date;
  event: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  user?: string;
  adminId?: string;
  ip: string;
  userAgent: string;
  details: string;
  status: 'resolved' | 'investigating' | 'open';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  event: {
    type: String,
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },
  source: {
    type: String,
    default: 'Admin Panel'
  },
  user: {
    type: String
  },
  adminId: {
    type: String,
    index: true
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  details: {
    type: String
  },
  status: {
    type: String,
    enum: ['resolved', 'investigating', 'open'],
    default: 'resolved',
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for common query patterns
AuditLogSchema.index({ timestamp: -1, severity: 1 });
AuditLogSchema.index({ event: 'text', details: 'text' });

// TTL index to auto-delete logs older than 90 days (optional, can be removed if you want permanent logs)
// AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
