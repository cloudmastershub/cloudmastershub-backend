import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ICertificate extends Document {
  certificateId: string; // Public-facing unique ID
  verificationCode: string; // Short code for manual verification
  userId: string;
  userName: string;
  userEmail?: string;
  type: 'course' | 'learning_path';
  courseId?: string;
  courseTitle?: string;
  pathId?: string;
  pathTitle?: string;
  issuedAt: Date;
  completedAt: Date;
  skills: string[];
  finalScore?: number;
  creditsEarned?: number;
  certificateUrl?: string;
  linkedInShareUrl?: string;
  status: 'issued' | 'revoked';
  revokedAt?: Date;
  revokedReason?: string;
  metadata?: {
    totalLessons?: number;
    totalWatchTime?: number;
    totalQuizzes?: number;
    averageQuizScore?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Generate a short verification code (e.g., CMH-AWS-A1B2C3)
const generateVerificationCode = (prefix: string = 'CMH'): string => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
};

const CertificateSchema = new Schema<ICertificate>({
  certificateId: {
    type: String,
    required: true,
    unique: true,
    default: () => `cert-${uuidv4()}`
  },
  verificationCode: {
    type: String,
    required: true,
    unique: true,
    default: () => generateVerificationCode()
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String
  },
  type: {
    type: String,
    required: true,
    enum: ['course', 'learning_path']
  },
  courseId: {
    type: String,
    index: true
  },
  courseTitle: {
    type: String
  },
  pathId: {
    type: String,
    index: true
  },
  pathTitle: {
    type: String
  },
  issuedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  completedAt: {
    type: Date,
    required: true
  },
  skills: [{
    type: String
  }],
  finalScore: {
    type: Number,
    min: 0,
    max: 100
  },
  creditsEarned: {
    type: Number,
    min: 0
  },
  certificateUrl: {
    type: String
  },
  linkedInShareUrl: {
    type: String
  },
  status: {
    type: String,
    required: true,
    enum: ['issued', 'revoked'],
    default: 'issued'
  },
  revokedAt: {
    type: Date
  },
  revokedReason: {
    type: String
  },
  metadata: {
    totalLessons: Number,
    totalWatchTime: Number,
    totalQuizzes: Number,
    averageQuizScore: Number
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret.certificateId;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
CertificateSchema.index({ verificationCode: 1 }, { unique: true });
CertificateSchema.index({ certificateId: 1 }, { unique: true });
CertificateSchema.index({ userId: 1, type: 1 });
CertificateSchema.index({ userId: 1, courseId: 1 });
CertificateSchema.index({ userId: 1, pathId: 1 });

// Static methods
CertificateSchema.statics.findByVerificationCode = function(code: string) {
  return this.findOne({ verificationCode: code.toUpperCase(), status: 'issued' });
};

CertificateSchema.statics.findByCertificateId = function(certId: string) {
  return this.findOne({ certificateId: certId });
};

CertificateSchema.statics.findByUser = function(userId: string) {
  return this.find({ userId, status: 'issued' }).sort({ issuedAt: -1 });
};

CertificateSchema.statics.existsForCourse = function(userId: string, courseId: string) {
  return this.findOne({ userId, courseId, type: 'course', status: 'issued' });
};

CertificateSchema.statics.existsForPath = function(userId: string, pathId: string) {
  return this.findOne({ userId, pathId, type: 'learning_path', status: 'issued' });
};

// Instance methods
CertificateSchema.methods.revoke = function(reason: string) {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedReason = reason;
  return this.save();
};

CertificateSchema.methods.generateLinkedInShareUrl = function() {
  const baseUrl = 'https://www.linkedin.com/profile/add';
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: this.courseTitle || this.pathTitle || 'CloudMastersHub Certificate',
    organizationName: 'CloudMastersHub',
    issueYear: this.issuedAt.getFullYear().toString(),
    issueMonth: (this.issuedAt.getMonth() + 1).toString(),
    certUrl: `https://cloudmastershub.com/certificates/verify/${this.verificationCode}`,
    certId: this.verificationCode
  });

  this.linkedInShareUrl = `${baseUrl}?${params.toString()}`;
  return this.linkedInShareUrl;
};

const CertificateModel = mongoose.model<ICertificate>('Certificate', CertificateSchema);
export { CertificateModel as Certificate };
