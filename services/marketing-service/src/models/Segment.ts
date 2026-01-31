import mongoose, { Schema, Document, Model, FilterQuery } from 'mongoose';

/**
 * Segment Rule - A single filter condition
 */
export interface ISegmentRule {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' |
            'greater_than' | 'less_than' | 'greater_than_or_equals' | 'less_than_or_equals' |
            'in' | 'not_in' | 'exists' | 'not_exists' | 'before' | 'after' |
            'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty';
  value: any;
}

/**
 * Segment Group - A group of rules with AND/OR logic
 */
export interface ISegmentGroup {
  id: string;
  operator: 'and' | 'or';
  rules: ISegmentRule[];
  groups?: ISegmentGroup[];  // Nested groups for complex queries
}

/**
 * Segment Interface
 */
export interface ISegment extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'static' | 'dynamic';

  // For dynamic segments - rule-based filtering
  rootGroup?: ISegmentGroup;

  // For static segments - manually selected leads
  leadIds?: string[];

  // Computed/cached values
  estimatedSize: number;
  lastCalculatedAt?: Date;

  // Metadata
  tags?: string[];
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Segment Model Interface (static methods)
 */
export interface ISegmentModel extends Model<ISegment> {
  findByName(name: string): Promise<ISegment | null>;
  getPublicSegments(): Promise<ISegment[]>;
}

/**
 * Segment Rule Schema
 */
const SegmentRuleSchema = new Schema<ISegmentRule>({
  id: { type: String, required: true },
  field: { type: String, required: true },
  operator: {
    type: String,
    required: true,
    enum: [
      'equals', 'not_equals', 'contains', 'not_contains',
      'greater_than', 'less_than', 'greater_than_or_equals', 'less_than_or_equals',
      'in', 'not_in', 'exists', 'not_exists', 'before', 'after',
      'starts_with', 'ends_with', 'is_empty', 'is_not_empty'
    ],
  },
  value: { type: Schema.Types.Mixed },
}, { _id: false });

/**
 * Segment Group Schema (recursive)
 */
const SegmentGroupSchema = new Schema<ISegmentGroup>({
  id: { type: String, required: true },
  operator: {
    type: String,
    required: true,
    enum: ['and', 'or'],
    default: 'and',
  },
  rules: { type: [SegmentRuleSchema], default: [] },
  groups: { type: [Schema.Types.Mixed], default: [] },  // Recursive reference
}, { _id: false });

/**
 * Segment Schema
 */
const SegmentSchema = new Schema<ISegment>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  type: {
    type: String,
    required: true,
    enum: ['static', 'dynamic'],
    default: 'dynamic',
    index: true,
  },
  rootGroup: {
    type: SegmentGroupSchema,
  },
  leadIds: {
    type: [String],
    default: undefined,  // Only set for static segments
  },
  estimatedSize: {
    type: Number,
    default: 0,
    index: true,
  },
  lastCalculatedAt: {
    type: Date,
  },
  tags: {
    type: [String],
    default: [],
    index: true,
  },
  createdBy: {
    type: String,
    required: true,
    index: true,
  },
  updatedBy: {
    type: String,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes
SegmentSchema.index({ createdAt: -1 });
SegmentSchema.index({ name: 'text', description: 'text' });

// Static methods
SegmentSchema.statics.findByName = function(name: string) {
  return this.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
};

SegmentSchema.statics.getPublicSegments = function() {
  return this.find({ type: 'dynamic' }).sort({ name: 1 });
};

// Validation
SegmentSchema.pre('save', function(next) {
  // Validate that dynamic segments have rootGroup
  if (this.type === 'dynamic' && !this.rootGroup) {
    return next(new Error('Dynamic segments must have a rootGroup'));
  }

  // Validate that static segments have leadIds
  if (this.type === 'static' && (!this.leadIds || this.leadIds.length === 0)) {
    // Allow empty static segments during creation
    this.leadIds = this.leadIds || [];
  }

  next();
});

const SegmentModel = mongoose.model<ISegment, ISegmentModel>('Segment', SegmentSchema);

export { SegmentModel as Segment };
export default SegmentModel;

/**
 * Available segment fields for Lead model
 */
export const SEGMENT_FIELDS = [
  { value: 'email', label: 'Email', type: 'string' },
  { value: 'firstName', label: 'First Name', type: 'string' },
  { value: 'lastName', label: 'Last Name', type: 'string' },
  { value: 'phone', label: 'Phone', type: 'string' },
  { value: 'company', label: 'Company', type: 'string' },
  { value: 'jobTitle', label: 'Job Title', type: 'string' },
  { value: 'status', label: 'Status', type: 'select', options: ['new', 'engaged', 'qualified', 'converted', 'unsubscribed', 'bounced', 'inactive'] },
  { value: 'score', label: 'Lead Score', type: 'number' },
  { value: 'scoreLevel', label: 'Score Level', type: 'select', options: ['cold', 'warm', 'hot', 'very_hot'] },
  { value: 'tags', label: 'Tags', type: 'tags' },
  { value: 'source.type', label: 'Lead Source', type: 'select', options: ['funnel', 'landing_page', 'popup', 'referral', 'organic', 'paid_ad', 'social', 'email', 'webinar', 'challenge', 'direct', 'api'] },
  { value: 'source.utmSource', label: 'UTM Source', type: 'string' },
  { value: 'source.utmMedium', label: 'UTM Medium', type: 'string' },
  { value: 'source.utmCampaign', label: 'UTM Campaign', type: 'string' },
  { value: 'emailConsent', label: 'Email Consent', type: 'boolean' },
  { value: 'capturedAt', label: 'Captured Date', type: 'date' },
  { value: 'lastActivityAt', label: 'Last Activity', type: 'date' },
  { value: 'email_engagement.openRate', label: 'Email Open Rate', type: 'number' },
  { value: 'email_engagement.clickRate', label: 'Email Click Rate', type: 'number' },
  { value: 'email_engagement.emailsReceived', label: 'Emails Received', type: 'number' },
  { value: 'email_engagement.emailsOpened', label: 'Emails Opened', type: 'number' },
  { value: 'conversion.convertedAt', label: 'Converted Date', type: 'date' },
  { value: 'conversion.totalSpent', label: 'Total Spent', type: 'number' },
  { value: 'country', label: 'Country', type: 'string' },
  { value: 'city', label: 'City', type: 'string' },
  { value: 'timezone', label: 'Timezone', type: 'string' },
];

/**
 * Operators available for each field type
 */
export const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'greater_than_or_equals', label: 'Greater than or equals' },
    { value: 'less_than_or_equals', label: 'Less than or equals' },
  ],
  select: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'in', label: 'Is one of' },
    { value: 'not_in', label: 'Is not one of' },
  ],
  tags: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'in', label: 'Contains any of' },
    { value: 'is_empty', label: 'Has no tags' },
    { value: 'is_not_empty', label: 'Has any tags' },
  ],
  boolean: [
    { value: 'equals', label: 'Is' },
  ],
  date: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'equals', label: 'On' },
    { value: 'exists', label: 'Is set' },
    { value: 'not_exists', label: 'Is not set' },
  ],
};
