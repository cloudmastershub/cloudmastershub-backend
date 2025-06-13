export interface Lab {
  id: string;
  courseId?: string;
  title: string;
  description: string;
  provider: CloudProvider;
  difficulty: DifficultyLevel;
  estimatedTime: number; // minutes
  prerequisites: string[];
  objectives: string[];
  instructions: Instruction[];
  resources: LabResources;
  validation: LabValidation;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum CloudProvider {
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp',
}

export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export interface Instruction {
  step: number;
  title: string;
  content: string;
  hints?: string[];
  codeSnippets?: CodeSnippet[];
  images?: string[];
}

export interface CodeSnippet {
  language: string;
  code: string;
  filename?: string;
}

export interface LabResources {
  cpuLimit: string;
  memoryLimit: string;
  timeLimit: number; // minutes
  estimatedCost: number;
  requiredServices: string[];
}

export interface LabValidation {
  checkpoints: string[];
  autoGrade: boolean;
  validationScript?: string;
}

export interface LabSession {
  id: string;
  labId: string;
  userId: string;
  status: SessionStatus;
  startedAt: Date;
  endedAt?: Date;
  environment: LabEnvironment;
  timeRemaining: number; // seconds
  cost: number;
  logs: SessionLog[];
}

export enum SessionStatus {
  PROVISIONING = 'provisioning',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  TIMEOUT = 'timeout',
}

export interface LabEnvironment {
  provider: CloudProvider;
  region: string;
  consoleUrl: string;
  credentials: LabCredentials;
  resources: ProvisionedResource[];
}

export interface LabCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  username?: string;
  password?: string;
  sshKey?: string;
}

export interface ProvisionedResource {
  type: string;
  id: string;
  name: string;
  status: string;
  metadata?: Record<string, any>;
}

export interface SessionLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: any;
}

export interface LabSubmission {
  sessionId: string;
  userId: string;
  labId: string;
  submittedAt: Date;
  solution: any;
  result: LabResult;
}

export interface LabResult {
  passed: boolean;
  score: number;
  feedback: {
    checkpoints: CheckpointResult[];
    suggestions: string[];
  };
  completedAt: Date;
}

export interface CheckpointResult {
  name: string;
  passed: boolean;
  message?: string;
}