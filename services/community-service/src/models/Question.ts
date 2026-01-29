import mongoose, { Schema, Document } from 'mongoose';

export type QuestionStatus = 'open' | 'answered' | 'closed';

export interface IQuestion extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  tags: string[];
  category?: string;
  courseId?: string;
  status: QuestionStatus;
  acceptedAnswerId?: mongoose.Types.ObjectId;
  viewCount: number;
  answerCount: number;
  upvotes: number;
  downvotes: number;
  voters: { oderId: string; vote: 1 | -1 }[];
  bountyPoints?: number;
  bountyExpiresAt?: Date;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 30000
  },
  authorId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorAvatar: {
    type: String
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  category: {
    type: String,
    trim: true
  },
  courseId: {
    type: String
  },
  status: {
    type: String,
    enum: ['open', 'answered', 'closed'],
    default: 'open'
  },
  acceptedAnswerId: {
    type: Schema.Types.ObjectId,
    ref: 'Answer'
  },
  viewCount: {
    type: Number,
    default: 0
  },
  answerCount: {
    type: Number,
    default: 0
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  voters: [{
    oderId: { type: String, required: true },
    vote: { type: Number, enum: [1, -1], required: true }
  }],
  bountyPoints: {
    type: Number
  },
  bountyExpiresAt: {
    type: Date
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'questions'
});

QuestionSchema.index({ slug: 1 });
QuestionSchema.index({ status: 1, createdAt: -1 });
QuestionSchema.index({ authorId: 1 });
QuestionSchema.index({ tags: 1 });
QuestionSchema.index({ courseId: 1 });
QuestionSchema.index({ upvotes: -1, answerCount: -1 });

QuestionSchema.virtual('score').get(function() {
  return this.upvotes - this.downvotes;
});

QuestionSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    if (ret.acceptedAnswerId) ret.acceptedAnswerId = ret.acceptedAnswerId.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.voters;
    return ret;
  }
});

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema);
