import mongoose, { Document, Schema } from 'mongoose';

export interface ILab extends Document {
  title: string;
  description: string;
  provider: 'aws' | 'azure' | 'gcp' | 'multi-cloud';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // in minutes
  category: string;
  prerequisites: string[];
  objectives: string[];
  tags: string[];
  instructions: {
    step: number;
    title: string;
    content: string;
    hints?: string[];
    validation?: {
      type: string;
      expected: any;
    };
  }[];
  resources: {
    cpuLimit?: string;
    memoryLimit?: string;
    timeLimit?: number; // in minutes
    cloudResources?: {
      type: string;
      specifications: Record<string, any>;
    }[];
  };
  validation: {
    checkpoints: string[];
    autoGrading?: boolean;
    passingScore?: number;
  };
  courseId?: string;
  pathId?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LabSchema = new Schema<ILab>({
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['aws', 'azure', 'gcp', 'multi-cloud'],
    required: true,
    index: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true,
    index: true
  },
  estimatedTime: {
    type: Number,
    required: true,
    min: 5,
    max: 480 // 8 hours max
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  prerequisites: [{
    type: String,
    trim: true
  }],
  objectives: [{
    type: String,
    required: true,
    trim: true
  }],
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
    index: true
  }],
  instructions: [{
    step: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    hints: [String],
    validation: {
      type: {
        type: String
      },
      expected: Schema.Types.Mixed
    }
  }],
  resources: {
    cpuLimit: String,
    memoryLimit: String,
    timeLimit: Number,
    cloudResources: [{
      type: String,
      specifications: Schema.Types.Mixed
    }]
  },
  validation: {
    checkpoints: [String],
    autoGrading: {
      type: Boolean,
      default: false
    },
    passingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 70
    }
  },
  courseId: {
    type: String,
    index: true
  },
  pathId: {
    type: String,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true,
  collection: 'labs'
});

// Indexes for better query performance
LabSchema.index({ title: 'text', description: 'text', tags: 1 });
LabSchema.index({ provider: 1, difficulty: 1, category: 1 });
LabSchema.index({ courseId: 1, isActive: 1 });
LabSchema.index({ pathId: 1, isActive: 1 });

export default mongoose.model<ILab>('Lab', LabSchema);