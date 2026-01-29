import mongoose, { Schema, Document } from 'mongoose';

export interface IAnswer extends Document {
  _id: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  isAccepted: boolean;
  upvotes: number;
  downvotes: number;
  voters: { oderId: string; vote: 1 | -1 }[];
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new Schema<IAnswer>({
  questionId: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true
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
  content: {
    type: String,
    required: true,
    maxlength: 30000
  },
  isAccepted: {
    type: Boolean,
    default: false
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
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'answers'
});

AnswerSchema.index({ questionId: 1, isAccepted: -1, upvotes: -1 });
AnswerSchema.index({ authorId: 1 });

AnswerSchema.virtual('score').get(function() {
  return this.upvotes - this.downvotes;
});

AnswerSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    ret.id = ret._id.toString();
    ret.questionId = ret.questionId.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.voters;
    return ret;
  }
});

export const Answer = mongoose.model<IAnswer>('Answer', AnswerSchema);
