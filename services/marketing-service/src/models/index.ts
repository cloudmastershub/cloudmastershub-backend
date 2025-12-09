// Export all models
export { Funnel, FunnelType, FunnelStatus, FunnelStepType, DeliveryMode } from './Funnel';
export type { IFunnel, IFunnelStep, IFunnelMetrics } from './Funnel';

export { Challenge, ChallengeStatus } from './Challenge';
export type { IChallenge, IChallengeDay, IChallengeDayContent, IChallengePitchDay } from './Challenge';

export { ChallengeParticipant, ParticipantStatus } from './ChallengeParticipant';
export type { IChallengeParticipant, IDayProgress } from './ChallengeParticipant';

export { EmailSequence, EmailSequenceStatus, SequenceTrigger, SendTimeOption } from './EmailSequence';
export type { IEmailSequence, ISequenceEmail } from './EmailSequence';

export { EmailTemplate, EmailTemplateCategory, EmailTemplateStatus } from './EmailTemplate';
export type { IEmailTemplate, ITemplateVariable } from './EmailTemplate';

export { Lead, LeadSource, LeadStatus, LeadScoreLevel } from './Lead';
export type { ILead, ILeadActivity } from './Lead';

export { ConversionEvent, ConversionEventType } from './ConversionEvent';
export type { IConversionEvent } from './ConversionEvent';
