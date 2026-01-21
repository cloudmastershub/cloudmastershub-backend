// Export all models
export { Funnel, FunnelType, FunnelStatus, FunnelStepType, DeliveryMode } from './Funnel';
export type { IFunnel, IFunnelStep, IFunnelMetrics } from './Funnel';

export { FunnelParticipant, FunnelParticipantStatus } from './FunnelParticipant';
export type { IFunnelParticipant, IStepProgress } from './FunnelParticipant';

export { Challenge, ChallengeStatus } from './Challenge';
export type { IChallenge, IChallengeDay, IChallengeDayContent, IChallengePitchDay } from './Challenge';

export { ChallengeParticipant, ParticipantStatus } from './ChallengeParticipant';
export type { IChallengeParticipant, IDayProgress } from './ChallengeParticipant';

export { EmailSequence, EmailSequenceStatus, SequenceTrigger, SendTimeOption } from './EmailSequence';
export type { IEmailSequence, ISequenceEmail } from './EmailSequence';

export { EmailTemplate, EmailTemplateCategory, EmailTemplateStatus } from './EmailTemplate';
export type { IEmailTemplate, ITemplateVariable } from './EmailTemplate';

export { Lead, LeadSource, LeadStatus, LeadScoreLevel } from './Lead';
export type { ILead, ILeadActivity, ILeadModel } from './Lead';

export { ConversionEvent, ConversionEventType } from './ConversionEvent';
export type { IConversionEvent } from './ConversionEvent';

export { EmailQueueJob, EmailJobStatus, EmailJobType } from './EmailQueueJob';
export type { IEmailQueueJob, IEmailQueueJobModel } from './EmailQueueJob';

export { EmailCampaign, CampaignStatus, CampaignType } from './EmailCampaign';
export type { IEmailCampaign, ISegmentCondition, ICampaignVariant } from './EmailCampaign';

export { Workflow, WorkflowStatus, WorkflowTriggerType, WorkflowNodeType, ConditionOperator } from './Workflow';
export type { IWorkflow, IWorkflowTrigger, IWorkflowNode, IWorkflowEdge, IWorkflowNodeConfig, IWorkflowSettings, IWorkflowMetrics } from './Workflow';

export { WorkflowParticipant, WorkflowParticipantStatus } from './WorkflowParticipant';
export type { IWorkflowParticipant, IWorkflowLogEntry } from './WorkflowParticipant';
