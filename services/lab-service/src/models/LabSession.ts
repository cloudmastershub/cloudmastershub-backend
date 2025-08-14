import mongoose, { Document, Schema } from 'mongoose';

export interface ILabSession extends Document {
  labId: string;
  userId: string;
  sessionId: string;
  status: 'pending' | 'provisioning' | 'active' | 'completed' | 'failed' | 'terminated';
  startTime: Date;
  endTime?: Date;
  lastActivityTime?: Date;
  environment: {
    provider: string;
    region: string;
    instanceId?: string;
    publicIp?: string;
    privateIp?: string;
    connectionDetails?: {
      type: string; // ssh, rdp, web
      url?: string;
      credentials?: {
        username?: string;
        password?: string;
        keyFile?: string;
      };
    };
  };
  resources: {
    type: string;
    id: string;
    status: string;
    metadata?: Record<string, any>;
  }[];
  progress: {
    completedSteps: number[];
    currentStep: number;
    checkpointsCompleted: string[];
    score?: number;
  };
  costs: {
    estimatedCost: number;
    actualCost?: number;
    currency: string;
  };
  logs: {
    timestamp: Date;
    level: 'info' | 'warning' | 'error';
    message: string;
    metadata?: Record<string, any>;
  }[];
  submission?: {
    submittedAt: Date;
    solution: Record<string, any>;
    validationResults?: {
      passed: boolean;
      score: number;
      feedback: string[];
      details: Record<string, any>;
    };
  };
  terminationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LabSessionSchema = new Schema<ILabSession>({
  labId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'provisioning', 'active', 'completed', 'failed', 'terminated'],
    default: 'pending',
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  endTime: Date,
  lastActivityTime: Date,
  environment: {
    provider: {
      type: String,
      required: true
    },
    region: {
      type: String,
      required: true
    },
    instanceId: String,
    publicIp: String,
    privateIp: String,
    connectionDetails: {
      type: String,
      url: String,
      credentials: {
        username: String,
        password: String,
        keyFile: String
      }
    }
  },
  resources: [{
    type: String,
    id: String,
    status: String,
    metadata: Schema.Types.Mixed
  }],
  progress: {
    completedSteps: [Number],
    currentStep: {
      type: Number,
      default: 1
    },
    checkpointsCompleted: [String],
    score: Number
  },
  costs: {
    estimatedCost: {
      type: Number,
      default: 0
    },
    actualCost: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    level: {
      type: String,
      enum: ['info', 'warning', 'error']
    },
    message: String,
    metadata: Schema.Types.Mixed
  }],
  submission: {
    submittedAt: Date,
    solution: Schema.Types.Mixed,
    validationResults: {
      passed: Boolean,
      score: Number,
      feedback: [String],
      details: Schema.Types.Mixed
    }
  },
  terminationReason: String
}, {
  timestamps: true,
  collection: 'lab_sessions'
});

// Indexes for better query performance
LabSessionSchema.index({ userId: 1, status: 1, startTime: -1 });
LabSessionSchema.index({ labId: 1, status: 1 });
LabSessionSchema.index({ sessionId: 1, status: 1 });
LabSessionSchema.index({ startTime: -1 });

// TTL index to automatically clean up old terminated sessions after 30 days
LabSessionSchema.index(
  { updatedAt: 1 },
  { 
    expireAfterSeconds: 2592000, // 30 days
    partialFilterExpression: { status: { $in: ['completed', 'failed', 'terminated'] } }
  }
);

export default mongoose.model<ILabSession>('LabSession', LabSessionSchema);