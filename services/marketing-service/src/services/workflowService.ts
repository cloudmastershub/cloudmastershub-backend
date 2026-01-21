import mongoose, { FilterQuery } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  IWorkflow,
  WorkflowStatus,
  WorkflowTriggerType,
  WorkflowNodeType,
  IWorkflowNode,
  IWorkflowTrigger,
} from '../models/Workflow';
import {
  WorkflowParticipant,
  IWorkflowParticipant,
  WorkflowParticipantStatus,
} from '../models/WorkflowParticipant';
import { Lead } from '../models/Lead';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Create workflow input
 */
interface CreateWorkflowInput {
  name: string;
  description?: string;
  trigger: IWorkflowTrigger;
  nodes?: IWorkflowNode[];
  edges?: { id: string; source: string; target: string; sourceHandle?: string; label?: string }[];
  settings?: Partial<IWorkflow['settings']>;
  folder?: string;
  tags?: string[];
  createdBy: string;
}

/**
 * Update workflow input
 */
interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  trigger?: IWorkflowTrigger;
  nodes?: IWorkflowNode[];
  edges?: { id: string; source: string; target: string; sourceHandle?: string; label?: string }[];
  settings?: Partial<IWorkflow['settings']>;
  folder?: string;
  tags?: string[];
  updatedBy: string;
}

/**
 * List workflows options
 */
interface ListWorkflowsOptions {
  status?: WorkflowStatus;
  triggerType?: WorkflowTriggerType;
  folder?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Workflow Service - Handles workflow automation management
 */
class WorkflowService {
  /**
   * Create a new workflow
   */
  async createWorkflow(input: CreateWorkflowInput): Promise<IWorkflow> {
    // Create default trigger node if no nodes provided
    const triggerNode: IWorkflowNode = {
      id: uuidv4(),
      type: WorkflowNodeType.TRIGGER,
      name: this.getTriggerName(input.trigger.type),
      position: { x: 250, y: 50 },
      config: {},
    };

    const workflow = new Workflow({
      name: input.name,
      description: input.description,
      status: WorkflowStatus.DRAFT,
      trigger: input.trigger,
      nodes: input.nodes || [triggerNode],
      edges: input.edges || [],
      settings: {
        timezone: input.settings?.timezone || 'America/New_York',
        allowReentry: input.settings?.allowReentry || false,
        exitOnGoal: input.settings?.exitOnGoal ?? true,
        businessHoursOnly: input.settings?.businessHoursOnly || false,
        ...input.settings,
      },
      metrics: {
        totalEntered: 0,
        currentlyActive: 0,
        completed: 0,
        exited: 0,
        goalAchieved: 0,
      },
      folder: input.folder,
      tags: input.tags,
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    });

    await workflow.save();
    logger.info(`Workflow created: ${workflow.name} (${workflow.id})`);
    return workflow;
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id: string): Promise<IWorkflow | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }
    return Workflow.findById(id);
  }

  /**
   * Update workflow
   */
  async updateWorkflow(id: string, input: UpdateWorkflowInput): Promise<IWorkflow | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const workflow = await Workflow.findById(id);
    if (!workflow) {
      return null;
    }

    // Only allow updates to draft or paused workflows
    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw ApiError.badRequest('Cannot update an active workflow. Pause it first.');
    }

    // Build update object
    const updateData: any = { updatedBy: input.updatedBy };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.trigger !== undefined) updateData.trigger = input.trigger;
    if (input.nodes !== undefined) updateData.nodes = input.nodes;
    if (input.edges !== undefined) updateData.edges = input.edges;
    if (input.settings !== undefined) {
      updateData.settings = { ...workflow.settings, ...input.settings };
    }
    if (input.folder !== undefined) updateData.folder = input.folder;
    if (input.tags !== undefined) updateData.tags = input.tags;

    const updated = await Workflow.findByIdAndUpdate(id, updateData, { new: true });

    if (updated) {
      logger.info(`Workflow updated: ${updated.name} (${updated.id})`);
    }
    return updated;
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const workflow = await Workflow.findById(id);
    if (!workflow) {
      return false;
    }

    // Only allow deletion of draft or archived workflows
    if (workflow.status === WorkflowStatus.ACTIVE || workflow.status === WorkflowStatus.PAUSED) {
      throw ApiError.badRequest('Cannot delete an active or paused workflow. Archive it first.');
    }

    // Delete all participants
    await WorkflowParticipant.deleteMany({ workflowId: id });

    await Workflow.findByIdAndDelete(id);
    logger.info(`Workflow deleted: ${workflow.name} (${id})`);
    return true;
  }

  /**
   * List workflows with filtering and pagination
   */
  async listWorkflows(options: ListWorkflowsOptions = {}): Promise<{ data: IWorkflow[]; total: number }> {
    const {
      status,
      triggerType,
      folder,
      tags,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const query: FilterQuery<IWorkflow> = {};

    if (status) query.status = status;
    if (triggerType) query['trigger.type'] = triggerType;
    if (folder) query.folder = folder;
    if (tags && tags.length > 0) query.tags = { $in: tags };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortOptions: any = { [sortBy]: sortDirection };

    const [rawData, total] = await Promise.all([
      Workflow.find(query)
        .sort(sortOptions)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Workflow.countDocuments(query),
    ]);

    // Transform _id to id for lean results
    const data = rawData.map((workflow: any) => ({
      ...workflow,
      id: workflow._id.toString(),
    }));

    return { data: data as IWorkflow[], total };
  }

  /**
   * Activate workflow
   */
  async activateWorkflow(id: string, updatedBy: string): Promise<IWorkflow> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const workflow = await Workflow.findById(id);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    if (workflow.status === WorkflowStatus.ACTIVE) {
      throw ApiError.badRequest('Workflow is already active');
    }

    // Validate workflow has required structure
    this.validateWorkflow(workflow);

    workflow.status = WorkflowStatus.ACTIVE;
    workflow.activatedAt = new Date();
    workflow.updatedBy = updatedBy;
    await workflow.save();

    logger.info(`Workflow activated: ${workflow.name} (${workflow.id})`);
    return workflow;
  }

  /**
   * Pause workflow
   */
  async pauseWorkflow(id: string, updatedBy: string): Promise<IWorkflow> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const workflow = await Workflow.findById(id);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    if (workflow.status !== WorkflowStatus.ACTIVE) {
      throw ApiError.badRequest('Only active workflows can be paused');
    }

    workflow.status = WorkflowStatus.PAUSED;
    workflow.updatedBy = updatedBy;
    await workflow.save();

    logger.info(`Workflow paused: ${workflow.name} (${workflow.id})`);
    return workflow;
  }

  /**
   * Archive workflow
   */
  async archiveWorkflow(id: string, updatedBy: string): Promise<IWorkflow> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const workflow = await Workflow.findById(id);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    // Exit all active participants
    await WorkflowParticipant.updateMany(
      {
        workflowId: id,
        status: { $in: [WorkflowParticipantStatus.ACTIVE, WorkflowParticipantStatus.WAITING] },
      },
      {
        $set: {
          status: WorkflowParticipantStatus.EXITED,
          exitedAt: new Date(),
          exitReason: 'Workflow archived',
        },
      }
    );

    workflow.status = WorkflowStatus.ARCHIVED;
    workflow.updatedBy = updatedBy;
    await workflow.save();

    logger.info(`Workflow archived: ${workflow.name} (${workflow.id})`);
    return workflow;
  }

  /**
   * Duplicate workflow
   */
  async duplicateWorkflow(id: string, createdBy: string): Promise<IWorkflow> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const original = await Workflow.findById(id);
    if (!original) {
      throw ApiError.notFound('Workflow not found');
    }

    const duplicate = new Workflow({
      name: `${original.name} (Copy)`,
      description: original.description,
      status: WorkflowStatus.DRAFT,
      trigger: original.trigger,
      nodes: original.nodes.map(node => ({ ...node, id: uuidv4() })),
      edges: original.edges,
      settings: original.settings,
      folder: original.folder,
      tags: original.tags,
      metrics: {
        totalEntered: 0,
        currentlyActive: 0,
        completed: 0,
        exited: 0,
        goalAchieved: 0,
      },
      createdBy,
      updatedBy: createdBy,
    });

    // Update edge references to new node IDs
    const nodeIdMap = new Map<string, string>();
    original.nodes.forEach((oldNode, index) => {
      nodeIdMap.set(oldNode.id, duplicate.nodes[index].id);
    });

    duplicate.edges = duplicate.edges.map(edge => ({
      ...edge,
      id: uuidv4(),
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target,
    }));

    await duplicate.save();
    logger.info(`Workflow duplicated: ${duplicate.name} (${duplicate.id}) from ${id}`);
    return duplicate;
  }

  /**
   * Enroll lead in workflow
   */
  async enrollLead(
    workflowId: string,
    leadId: string,
    triggerData?: Record<string, any>
  ): Promise<IWorkflowParticipant> {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw ApiError.badRequest('Invalid lead ID');
    }

    const workflow = await Workflow.findById(workflowId);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    if (workflow.status !== WorkflowStatus.ACTIVE) {
      throw ApiError.badRequest('Workflow is not active');
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw ApiError.notFound('Lead not found');
    }

    // Check if lead is already in workflow
    const existingParticipant = await WorkflowParticipant.findOne({
      workflowId,
      leadId,
      status: { $in: [WorkflowParticipantStatus.ACTIVE, WorkflowParticipantStatus.WAITING] },
    });

    if (existingParticipant) {
      if (!workflow.settings.allowReentry) {
        throw ApiError.badRequest('Lead is already enrolled in this workflow');
      }

      // Check re-entry delay
      if (workflow.settings.reentryDelay) {
        const lastEntry = await WorkflowParticipant.findOne({
          workflowId,
          leadId,
        }).sort({ enteredAt: -1 });

        if (lastEntry) {
          const daysSinceLastEntry = (Date.now() - lastEntry.enteredAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastEntry < workflow.settings.reentryDelay) {
            throw ApiError.badRequest(
              `Lead must wait ${workflow.settings.reentryDelay} days before re-entering`
            );
          }
        }
      }

      // Check max enrollments
      if (workflow.settings.maxEnrollments) {
        const enrollmentCount = await WorkflowParticipant.countDocuments({ workflowId, leadId });
        if (enrollmentCount >= workflow.settings.maxEnrollments) {
          throw ApiError.badRequest('Lead has reached maximum enrollments for this workflow');
        }
      }
    }

    // Find the trigger node (entry point)
    const triggerNode = workflow.nodes.find(n => n.type === WorkflowNodeType.TRIGGER);
    if (!triggerNode) {
      throw ApiError.badRequest('Workflow has no trigger node');
    }

    // Create participant
    const participant = new WorkflowParticipant({
      workflowId,
      leadId,
      status: WorkflowParticipantStatus.ACTIVE,
      currentNodeId: triggerNode.id,
      enteredAt: new Date(),
      triggerData,
      enrollmentCount: existingParticipant ? (await WorkflowParticipant.countDocuments({ workflowId, leadId })) + 1 : 1,
      log: [{
        nodeId: triggerNode.id,
        nodeType: triggerNode.type,
        nodeName: triggerNode.name,
        action: 'entered',
        timestamp: new Date(),
        metadata: triggerData,
      }],
    });

    await participant.save();

    // Update workflow metrics
    await Workflow.findByIdAndUpdate(workflowId, {
      $inc: { 'metrics.totalEntered': 1, 'metrics.currentlyActive': 1 },
    });

    logger.info(`Lead enrolled in workflow: ${lead.email} -> ${workflow.name}`);
    return participant;
  }

  /**
   * Remove lead from workflow
   */
  async removeLead(workflowId: string, leadId: string, reason: string = 'Manually removed'): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw ApiError.badRequest('Invalid lead ID');
    }

    const participant = await WorkflowParticipant.findOne({
      workflowId,
      leadId,
      status: { $in: [WorkflowParticipantStatus.ACTIVE, WorkflowParticipantStatus.WAITING] },
    });

    if (!participant) {
      return false;
    }

    participant.status = WorkflowParticipantStatus.EXITED;
    participant.exitedAt = new Date();
    participant.exitReason = reason;
    participant.log.push({
      nodeId: participant.currentNodeId || 'unknown',
      nodeType: 'exit',
      nodeName: 'Manual Exit',
      action: 'completed',
      result: `Exited: ${reason}`,
      timestamp: new Date(),
    });
    await participant.save();

    // Update workflow metrics
    await Workflow.findByIdAndUpdate(workflowId, {
      $inc: { 'metrics.currentlyActive': -1, 'metrics.exited': 1 },
    });

    logger.info(`Lead removed from workflow: ${leadId} from ${workflowId}`);
    return true;
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(id: string): Promise<{
    workflow: IWorkflow;
    stats: {
      totalEntered: number;
      currentlyActive: number;
      completed: number;
      exited: number;
      goalAchieved: number;
      avgTimeToComplete?: number;
    };
    nodeStats: Array<{ nodeId: string; nodeName: string; entered: number; exited: number }>;
  }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const workflow = await Workflow.findById(id);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    // Get participant stats by status
    const statusStats = await WorkflowParticipant.aggregate([
      { $match: { workflowId: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = {
      active: 0,
      waiting: 0,
      completed: 0,
      exited: 0,
      failed: 0,
      goalAchieved: 0,
    };

    for (const stat of statusStats) {
      if (stat._id in stats) {
        stats[stat._id as keyof typeof stats] = stat.count;
      }
    }

    // Count goal achieved separately
    const goalCount = await WorkflowParticipant.countDocuments({
      workflowId: id,
      goalAchieved: true,
    });
    stats.goalAchieved = goalCount;

    // Get per-node stats
    const nodeStats = await WorkflowParticipant.aggregate([
      { $match: { workflowId: new mongoose.Types.ObjectId(id) } },
      { $unwind: '$log' },
      {
        $group: {
          _id: '$log.nodeId',
          nodeName: { $first: '$log.nodeName' },
          entered: {
            $sum: { $cond: [{ $eq: ['$log.action', 'entered'] }, 1, 0] },
          },
          exited: {
            $sum: { $cond: [{ $in: ['$log.action', ['completed', 'exited', 'failed']] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      workflow,
      stats: {
        totalEntered: workflow.metrics.totalEntered,
        currentlyActive: stats.active + stats.waiting,
        completed: stats.completed,
        exited: stats.exited + stats.failed,
        goalAchieved: stats.goalAchieved,
        avgTimeToComplete: workflow.metrics.avgTimeToComplete,
      },
      nodeStats: nodeStats.map(n => ({
        nodeId: n._id,
        nodeName: n.nodeName,
        entered: n.entered,
        exited: n.exited,
      })),
    };
  }

  /**
   * Get workflow participants
   */
  async getWorkflowParticipants(
    workflowId: string,
    options: { status?: WorkflowParticipantStatus; page?: number; limit?: number } = {}
  ): Promise<{ data: IWorkflowParticipant[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
      throw ApiError.badRequest('Invalid workflow ID');
    }

    const { status, page = 1, limit = 20 } = options;

    const query: FilterQuery<IWorkflowParticipant> = { workflowId };
    if (status) query.status = status;

    const [rawData, total] = await Promise.all([
      WorkflowParticipant.find(query)
        .populate('leadId', 'email firstName lastName')
        .sort({ enteredAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WorkflowParticipant.countDocuments(query),
    ]);

    // Transform _id to id
    const data = rawData.map((p: any) => ({
      ...p,
      id: p._id.toString(),
      workflowId: p.workflowId.toString(),
      leadId: p.leadId._id ? p.leadId._id.toString() : p.leadId.toString(),
      lead: p.leadId._id ? p.leadId : undefined,
    }));

    return { data: data as IWorkflowParticipant[], total };
  }

  /**
   * Get workflows triggered by a specific event
   */
  async getWorkflowsByTrigger(triggerType: WorkflowTriggerType, config?: Record<string, any>): Promise<IWorkflow[]> {
    const query: FilterQuery<IWorkflow> = {
      'trigger.type': triggerType,
      status: WorkflowStatus.ACTIVE,
    };

    // Add config-specific filters
    if (config) {
      if (config.tagName) query['trigger.config.tagName'] = config.tagName;
      if (config.funnelId) query['trigger.config.funnelId'] = config.funnelId;
      if (config.challengeId) query['trigger.config.challengeId'] = config.challengeId;
      if (config.eventName) query['trigger.config.eventName'] = config.eventName;
    }

    return Workflow.find(query);
  }

  /**
   * Validate workflow structure
   */
  private validateWorkflow(workflow: IWorkflow): void {
    // Must have at least a trigger node
    const triggerNode = workflow.nodes.find(n => n.type === WorkflowNodeType.TRIGGER);
    if (!triggerNode) {
      throw ApiError.badRequest('Workflow must have a trigger node');
    }

    // Must have at least one action or control node after trigger
    if (workflow.nodes.length < 2) {
      throw ApiError.badRequest('Workflow must have at least one action after the trigger');
    }

    // All non-exit nodes should have outgoing edges
    const nodeIds = new Set(workflow.nodes.map(n => n.id));
    const nodesWithOutgoing = new Set(workflow.edges.map(e => e.source));

    for (const node of workflow.nodes) {
      if (node.type !== WorkflowNodeType.EXIT && !nodesWithOutgoing.has(node.id)) {
        // Allow nodes without outgoing edges only if they're the last node
        const hasIncoming = workflow.edges.some(e => e.target === node.id);
        if (!hasIncoming && node.type !== WorkflowNodeType.TRIGGER) {
          throw ApiError.badRequest(`Node "${node.name}" is not connected to the workflow`);
        }
      }
    }

    // All edge targets must exist
    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.target)) {
        throw ApiError.badRequest(`Edge points to non-existent node: ${edge.target}`);
      }
      if (!nodeIds.has(edge.source)) {
        throw ApiError.badRequest(`Edge originates from non-existent node: ${edge.source}`);
      }
    }
  }

  /**
   * Get human-readable trigger name
   */
  private getTriggerName(type: WorkflowTriggerType): string {
    const names: Record<WorkflowTriggerType, string> = {
      [WorkflowTriggerType.LEAD_CREATED]: 'When lead is created',
      [WorkflowTriggerType.TAG_ADDED]: 'When tag is added',
      [WorkflowTriggerType.TAG_REMOVED]: 'When tag is removed',
      [WorkflowTriggerType.SCORE_CHANGED]: 'When score changes',
      [WorkflowTriggerType.EMAIL_OPENED]: 'When email is opened',
      [WorkflowTriggerType.EMAIL_CLICKED]: 'When email link is clicked',
      [WorkflowTriggerType.PAGE_VISITED]: 'When page is visited',
      [WorkflowTriggerType.FORM_SUBMITTED]: 'When form is submitted',
      [WorkflowTriggerType.PURCHASE_MADE]: 'When purchase is made',
      [WorkflowTriggerType.FUNNEL_STEP_COMPLETED]: 'When funnel step is completed',
      [WorkflowTriggerType.CHALLENGE_DAY_COMPLETED]: 'When challenge day is completed',
      [WorkflowTriggerType.CUSTOM_EVENT]: 'When custom event occurs',
      [WorkflowTriggerType.SCHEDULED]: 'On schedule',
      [WorkflowTriggerType.WEBHOOK]: 'When webhook is received',
      [WorkflowTriggerType.MANUAL]: 'Manual trigger',
    };
    return names[type] || 'Trigger';
  }
}

export const workflowService = new WorkflowService();
export default workflowService;
