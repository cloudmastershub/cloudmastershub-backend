import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  IWorkflow,
  WorkflowStatus,
  WorkflowNodeType,
  IWorkflowNode,
  ConditionOperator,
} from '../models/Workflow';
import {
  WorkflowParticipant,
  IWorkflowParticipant,
  WorkflowParticipantStatus,
  IWorkflowLogEntry,
} from '../models/WorkflowParticipant';
import { Lead, ILead, LeadScoreLevel } from '../models/Lead';
import { EmailTemplate } from '../models/EmailTemplate';
import { emailService } from './emailService';
import logger from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';

/**
 * Workflow Execution Engine
 * Processes workflow nodes and moves participants through workflows
 */
class WorkflowEngine {
  /**
   * Execute the next node for a participant
   */
  async executeNextNode(participantId: string): Promise<void> {
    const participant = await WorkflowParticipant.findById(participantId)
      .populate('leadId');

    if (!participant) {
      throw ApiError.notFound('Participant not found');
    }

    if (participant.status !== WorkflowParticipantStatus.ACTIVE) {
      logger.debug(`Participant ${participantId} is not active, skipping execution`);
      return;
    }

    const workflow = await Workflow.findById(participant.workflowId);
    if (!workflow) {
      throw ApiError.notFound('Workflow not found');
    }

    if (workflow.status !== WorkflowStatus.ACTIVE) {
      logger.debug(`Workflow ${workflow.id} is not active, skipping execution`);
      return;
    }

    const lead = await Lead.findById(participant.leadId);
    if (!lead) {
      await this.failParticipant(participant, 'Lead not found');
      return;
    }

    // Find current node
    const currentNode = workflow.nodes.find(n => n.id === participant.currentNodeId);
    if (!currentNode) {
      await this.failParticipant(participant, 'Current node not found');
      return;
    }

    try {
      // Execute current node
      const result = await this.executeNode(currentNode, lead, participant, workflow);

      // Log execution
      participant.log.push({
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeName: currentNode.name,
        action: 'executed',
        result: result.message,
        timestamp: new Date(),
        metadata: result.metadata,
      });

      // Handle node result
      if (result.wait) {
        // Set participant to waiting
        participant.status = WorkflowParticipantStatus.WAITING;
        participant.waitingUntil = result.waitUntil;
        await participant.save();
        return;
      }

      if (result.exit) {
        // Exit workflow
        await this.exitParticipant(participant, result.exitReason || 'Workflow completed');
        return;
      }

      // Find next node(s)
      const nextNodeId = result.nextNodeId || this.getNextNodeId(workflow, currentNode.id, result.branchLabel);

      if (!nextNodeId) {
        // No more nodes - workflow complete
        await this.completeParticipant(participant);
        return;
      }

      // Move to next node
      participant.currentNodeId = nextNodeId;
      if (result.branchLabel) {
        participant.branchPath = participant.branchPath || [];
        participant.branchPath.push(result.branchLabel);
      }
      await participant.save();

      // Process next node immediately (recursive)
      await this.executeNextNode(participantId);
    } catch (error) {
      logger.error(`Error executing node ${currentNode.id} for participant ${participantId}:`, error);
      await this.failParticipant(participant, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Execute a single workflow node
   */
  private async executeNode(
    node: IWorkflowNode,
    lead: ILead,
    participant: IWorkflowParticipant,
    workflow: IWorkflow
  ): Promise<NodeExecutionResult> {
    switch (node.type) {
      case WorkflowNodeType.TRIGGER:
        // Trigger node is just entry point, move to next
        return { message: 'Trigger executed' };

      case WorkflowNodeType.SEND_EMAIL:
        return this.executeSendEmail(node, lead);

      case WorkflowNodeType.ADD_TAG:
        return this.executeAddTag(node, lead);

      case WorkflowNodeType.REMOVE_TAG:
        return this.executeRemoveTag(node, lead);

      case WorkflowNodeType.UPDATE_SCORE:
        return this.executeUpdateScore(node, lead);

      case WorkflowNodeType.UPDATE_FIELD:
        return this.executeUpdateField(node, lead);

      case WorkflowNodeType.ENROLL_SEQUENCE:
        return this.executeEnrollSequence(node, lead);

      case WorkflowNodeType.SEND_WEBHOOK:
        return this.executeSendWebhook(node, lead);

      case WorkflowNodeType.SEND_NOTIFICATION:
        return this.executeSendNotification(node, lead, workflow);

      case WorkflowNodeType.WAIT:
        return this.executeWait(node);

      case WorkflowNodeType.WAIT_UNTIL:
        return this.executeWaitUntil(node);

      case WorkflowNodeType.CONDITION:
        return this.executeCondition(node, lead);

      case WorkflowNodeType.SPLIT:
        return this.executeSplit(node, participant);

      case WorkflowNodeType.GOAL:
        return this.executeGoal(node, lead, participant);

      case WorkflowNodeType.EXIT:
        return { message: 'Exit node reached', exit: true, exitReason: 'Exit node reached' };

      default:
        logger.warn(`Unknown node type: ${node.type}`);
        return { message: `Skipped unknown node type: ${node.type}` };
    }
  }

  /**
   * Send email action
   */
  private async executeSendEmail(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { templateId, subject } = node.config;

    if (!templateId) {
      return { message: 'No template configured, skipping' };
    }

    const template = await EmailTemplate.findById(templateId);
    if (!template) {
      return { message: `Template ${templateId} not found, skipping` };
    }

    try {
      // Send email via email service
      await emailService.sendEmail({
        to: lead.email,
        subject: subject || template.subject,
        html: this.personalize(template.htmlContent, lead),
        text: template.textContent ? this.personalize(template.textContent, lead) : undefined,
        tags: ['workflow'],
        metadata: {
          workflowNode: node.id,
          leadId: lead._id.toString(),
        },
      });

      return {
        message: `Email sent: ${template.name}`,
        metadata: { templateId, templateName: template.name },
      };
    } catch (error) {
      logger.error(`Failed to send email for node ${node.id}:`, error);
      return { message: `Email send failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Add tag action
   */
  private async executeAddTag(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { tags } = node.config;

    if (!tags || tags.length === 0) {
      return { message: 'No tags configured' };
    }

    const currentTags = lead.tags || [];
    const newTags = tags.filter((tag: string) => !currentTags.includes(tag));

    if (newTags.length > 0) {
      lead.tags = [...currentTags, ...newTags];
      await lead.save();
    }

    return {
      message: `Added tags: ${newTags.join(', ')}`,
      metadata: { addedTags: newTags },
    };
  }

  /**
   * Remove tag action
   */
  private async executeRemoveTag(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { tags } = node.config;

    if (!tags || tags.length === 0) {
      return { message: 'No tags configured' };
    }

    const currentTags = lead.tags || [];
    const removedTags = tags.filter((tag: string) => currentTags.includes(tag));
    lead.tags = currentTags.filter((tag: string) => !tags.includes(tag));
    await lead.save();

    return {
      message: `Removed tags: ${removedTags.join(', ')}`,
      metadata: { removedTags },
    };
  }

  /**
   * Update score action
   */
  private async executeUpdateScore(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { scoreChange, scoreAction } = node.config;

    if (scoreChange === undefined) {
      return { message: 'No score change configured' };
    }

    const oldScore = lead.score || 0;
    let newScore: number;

    switch (scoreAction) {
      case 'set':
        newScore = scoreChange;
        break;
      case 'subtract':
        newScore = Math.max(0, oldScore - scoreChange);
        break;
      case 'add':
      default:
        newScore = Math.min(100, oldScore + scoreChange);
        break;
    }

    lead.score = newScore;

    // Update score level
    if (newScore <= 25) lead.scoreLevel = LeadScoreLevel.COLD;
    else if (newScore <= 50) lead.scoreLevel = LeadScoreLevel.WARM;
    else if (newScore <= 75) lead.scoreLevel = LeadScoreLevel.HOT;
    else lead.scoreLevel = LeadScoreLevel.VERY_HOT;

    await lead.save();

    return {
      message: `Score ${scoreAction || 'add'}: ${oldScore} → ${newScore}`,
      metadata: { oldScore, newScore, action: scoreAction || 'add' },
    };
  }

  /**
   * Update field action
   */
  private async executeUpdateField(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { fieldName, fieldValue } = node.config;

    if (!fieldName) {
      return { message: 'No field name configured' };
    }

    if (fieldValue === undefined) {
      return { message: 'No field value configured' };
    }

    // Update custom field
    if (!lead.customFields) {
      lead.customFields = {};
    }
    lead.customFields[fieldName] = fieldValue;
    await lead.save();

    return {
      message: `Updated field ${fieldName}`,
      metadata: { fieldName, fieldValue },
    };
  }

  /**
   * Enroll in sequence action
   */
  private async executeEnrollSequence(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { sequenceId } = node.config;

    if (!sequenceId) {
      return { message: 'No sequence configured' };
    }

    // This would call the sequence enrollment service
    // For now, just log the action
    logger.info(`Would enroll lead ${lead.email} in sequence ${sequenceId}`);

    return {
      message: `Enrolled in sequence ${sequenceId}`,
      metadata: { sequenceId },
    };
  }

  /**
   * Send webhook action
   */
  private async executeSendWebhook(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { webhookUrl, webhookMethod, webhookHeaders, webhookBody } = node.config;

    if (!webhookUrl) {
      return { message: 'No webhook URL configured' };
    }

    try {
      const body = webhookBody ? this.personalizeObject(webhookBody, lead) : { lead: this.getLeadData(lead) };

      const response = await fetch(webhookUrl, {
        method: webhookMethod || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhookHeaders || {}),
        },
        body: JSON.stringify(body),
      });

      return {
        message: `Webhook sent: ${response.status}`,
        metadata: { url: webhookUrl, status: response.status },
      };
    } catch (error) {
      logger.error(`Webhook failed for node ${node.id}:`, error);
      return { message: `Webhook failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Send notification action
   */
  private async executeSendNotification(
    node: IWorkflowNode,
    lead: ILead,
    workflow: IWorkflow
  ): Promise<NodeExecutionResult> {
    const { notificationType, notificationRecipient, notificationMessage } = node.config;

    const message = notificationMessage
      ? this.personalize(notificationMessage, lead)
      : `Lead ${lead.email} reached node "${node.name}" in workflow "${workflow.name}"`;

    // For now, just log internal notifications
    logger.info(`[NOTIFICATION] ${notificationType || 'internal'} to ${notificationRecipient || 'admin'}: ${message}`);

    return {
      message: `Notification sent`,
      metadata: { type: notificationType, recipient: notificationRecipient },
    };
  }

  /**
   * Wait node
   */
  private async executeWait(node: IWorkflowNode): Promise<NodeExecutionResult> {
    const { waitDuration, waitUnit } = node.config;

    if (!waitDuration) {
      return { message: 'No wait duration configured' };
    }

    let milliseconds: number;
    switch (waitUnit) {
      case 'minutes':
        milliseconds = waitDuration * 60 * 1000;
        break;
      case 'hours':
        milliseconds = waitDuration * 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds = waitDuration * 24 * 60 * 60 * 1000;
        break;
      default:
        milliseconds = waitDuration * 60 * 1000; // default to minutes
    }

    const waitUntil = new Date(Date.now() + milliseconds);

    return {
      wait: true,
      waitUntil,
      message: `Waiting ${waitDuration} ${waitUnit}`,
    };
  }

  /**
   * Wait until node
   */
  private async executeWaitUntil(node: IWorkflowNode): Promise<NodeExecutionResult> {
    const { waitUntilTime, waitUntilDay } = node.config;

    if (!waitUntilTime) {
      return { message: 'No wait time configured' };
    }

    // Parse time (HH:MM)
    const [hours, minutes] = waitUntilTime.split(':').map(Number);

    let waitUntil = new Date();
    waitUntil.setHours(hours, minutes, 0, 0);

    // If time already passed today, set to tomorrow
    if (waitUntil <= new Date()) {
      waitUntil.setDate(waitUntil.getDate() + 1);
    }

    // If specific day is set, adjust to next occurrence
    if (waitUntilDay) {
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const targetDay = dayMap[waitUntilDay.toLowerCase()];
      const currentDay = waitUntil.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7;
      if (daysUntil > 0) {
        waitUntil.setDate(waitUntil.getDate() + daysUntil);
      }
    }

    return {
      wait: true,
      waitUntil,
      message: `Waiting until ${waitUntilTime}${waitUntilDay ? ` on ${waitUntilDay}` : ''}`,
    };
  }

  /**
   * Condition node
   */
  private async executeCondition(node: IWorkflowNode, lead: ILead): Promise<NodeExecutionResult> {
    const { conditionField, conditionOperator, conditionValue } = node.config;

    if (!conditionField || !conditionOperator) {
      return {
        message: 'Condition not fully configured, taking "no" branch',
        branchLabel: 'no',
      };
    }

    // Get field value from lead
    let fieldValue: any;
    if (conditionField.startsWith('customFields.')) {
      const customFieldName = conditionField.replace('customFields.', '');
      fieldValue = lead.customFields?.[customFieldName];
    } else if (conditionField === 'tags') {
      fieldValue = lead.tags;
    } else {
      fieldValue = (lead as any)[conditionField];
    }

    // Evaluate condition
    const result = this.evaluateCondition(fieldValue, conditionOperator as ConditionOperator, conditionValue);

    return {
      message: `Condition "${conditionField} ${conditionOperator} ${conditionValue}": ${result ? 'yes' : 'no'}`,
      branchLabel: result ? 'yes' : 'no',
    };
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(fieldValue: any, operator: ConditionOperator, compareValue: any): boolean {
    switch (operator) {
      case ConditionOperator.EQUALS:
        return fieldValue === compareValue;
      case ConditionOperator.NOT_EQUALS:
        return fieldValue !== compareValue;
      case ConditionOperator.CONTAINS:
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(compareValue);
        }
        return String(fieldValue).includes(String(compareValue));
      case ConditionOperator.NOT_CONTAINS:
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(compareValue);
        }
        return !String(fieldValue).includes(String(compareValue));
      case ConditionOperator.GREATER_THAN:
        return Number(fieldValue) > Number(compareValue);
      case ConditionOperator.LESS_THAN:
        return Number(fieldValue) < Number(compareValue);
      case ConditionOperator.GREATER_OR_EQUAL:
        return Number(fieldValue) >= Number(compareValue);
      case ConditionOperator.LESS_OR_EQUAL:
        return Number(fieldValue) <= Number(compareValue);
      case ConditionOperator.IS_SET:
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      case ConditionOperator.IS_NOT_SET:
        return fieldValue === undefined || fieldValue === null || fieldValue === '';
      case ConditionOperator.IN_LIST:
        const list = Array.isArray(compareValue) ? compareValue : String(compareValue).split(',');
        return list.includes(fieldValue);
      case ConditionOperator.NOT_IN_LIST:
        const notList = Array.isArray(compareValue) ? compareValue : String(compareValue).split(',');
        return !notList.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Split (A/B test) node
   */
  private async executeSplit(node: IWorkflowNode, participant: IWorkflowParticipant): Promise<NodeExecutionResult> {
    const { splitVariants } = node.config;

    if (!splitVariants || splitVariants.length === 0) {
      return { message: 'No split variants configured' };
    }

    // Random selection based on weights
    const totalWeight = splitVariants.reduce((sum: number, v: any) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const variant of splitVariants) {
      random -= variant.weight;
      if (random <= 0) {
        participant.splitVariantId = variant.id;
        return {
          message: `Split: selected variant "${variant.name}"`,
          branchLabel: variant.id,
          metadata: { variantId: variant.id, variantName: variant.name },
        };
      }
    }

    // Fallback to first variant
    const fallback = splitVariants[0];
    participant.splitVariantId = fallback.id;
    return {
      message: `Split: selected variant "${fallback.name}"`,
      branchLabel: fallback.id,
      metadata: { variantId: fallback.id, variantName: fallback.name },
    };
  }

  /**
   * Goal node
   */
  private async executeGoal(
    node: IWorkflowNode,
    lead: ILead,
    participant: IWorkflowParticipant
  ): Promise<NodeExecutionResult> {
    const { goalType, goalConfig } = node.config;

    // Check if goal is achieved
    let goalAchieved = false;

    switch (goalType) {
      case 'tag_added':
        if (goalConfig?.tagName && lead.tags?.includes(goalConfig.tagName)) {
          goalAchieved = true;
        }
        break;
      case 'purchase_made':
        // Would check purchase history
        break;
      case 'page_visited':
        // Would check page visit tracking
        break;
      case 'custom_event':
        // Would check event log
        break;
    }

    if (goalAchieved) {
      participant.goalAchieved = true;
      participant.goalAchievedAt = new Date();

      return {
        exit: true,
        exitReason: 'Goal achieved',
        message: `Goal achieved: ${goalType}`,
        metadata: { goalType, goalConfig },
      };
    }

    return {
      message: `Goal not yet achieved: ${goalType}`,
      metadata: { goalType },
    };
  }

  /**
   * Get the next node ID from edges
   */
  private getNextNodeId(workflow: IWorkflow, currentNodeId: string, branchLabel?: string): string | null {
    let edges = workflow.edges.filter(e => e.source === currentNodeId);

    if (branchLabel && edges.length > 1) {
      // Filter by branch label for condition/split nodes
      const labeledEdge = edges.find(e => e.sourceHandle === branchLabel || e.label === branchLabel);
      if (labeledEdge) {
        return labeledEdge.target;
      }
    }

    // Return first edge target
    return edges.length > 0 ? edges[0].target : null;
  }

  /**
   * Complete participant
   */
  private async completeParticipant(participant: IWorkflowParticipant): Promise<void> {
    participant.status = WorkflowParticipantStatus.COMPLETED;
    participant.completedAt = new Date();
    participant.currentNodeId = undefined;
    participant.log.push({
      nodeId: 'end',
      nodeType: 'end',
      nodeName: 'Workflow Complete',
      action: 'completed',
      timestamp: new Date(),
    });
    await participant.save();

    // Update workflow metrics
    await Workflow.findByIdAndUpdate(participant.workflowId, {
      $inc: { 'metrics.currentlyActive': -1, 'metrics.completed': 1 },
    });

    logger.info(`Participant ${participant.id} completed workflow`);
  }

  /**
   * Exit participant from workflow
   */
  private async exitParticipant(participant: IWorkflowParticipant, reason: string): Promise<void> {
    participant.status = WorkflowParticipantStatus.EXITED;
    participant.exitedAt = new Date();
    participant.exitReason = reason;
    participant.currentNodeId = undefined;
    participant.log.push({
      nodeId: 'exit',
      nodeType: 'exit',
      nodeName: 'Exit',
      action: 'completed',
      result: reason,
      timestamp: new Date(),
    });
    await participant.save();

    // Update workflow metrics
    const updateOp: any = { $inc: { 'metrics.currentlyActive': -1, 'metrics.exited': 1 } };
    if (participant.goalAchieved) {
      updateOp.$inc['metrics.goalAchieved'] = 1;
    }
    await Workflow.findByIdAndUpdate(participant.workflowId, updateOp);

    logger.info(`Participant ${participant.id} exited workflow: ${reason}`);
  }

  /**
   * Mark participant as failed
   */
  private async failParticipant(participant: IWorkflowParticipant, error: string): Promise<void> {
    participant.status = WorkflowParticipantStatus.FAILED;
    participant.exitedAt = new Date();
    participant.exitReason = `Error: ${error}`;
    participant.log.push({
      nodeId: participant.currentNodeId || 'unknown',
      nodeType: 'error',
      nodeName: 'Error',
      action: 'failed',
      error,
      timestamp: new Date(),
    });
    await participant.save();

    // Update workflow metrics
    await Workflow.findByIdAndUpdate(participant.workflowId, {
      $inc: { 'metrics.currentlyActive': -1 },
    });

    logger.error(`Participant ${participant.id} failed: ${error}`);
  }

  /**
   * Process waiting participants
   */
  async processWaitingParticipants(): Promise<number> {
    const now = new Date();

    const waitingParticipants = await WorkflowParticipant.find({
      status: WorkflowParticipantStatus.WAITING,
      waitingUntil: { $lte: now },
    });

    logger.info(`Processing ${waitingParticipants.length} waiting participants`);

    let processed = 0;
    for (const participant of waitingParticipants) {
      try {
        // Move to active and continue execution
        participant.status = WorkflowParticipantStatus.ACTIVE;
        participant.waitingUntil = undefined;
        await participant.save();

        // Get next node and continue
        const workflow = await Workflow.findById(participant.workflowId);
        if (workflow && workflow.status === WorkflowStatus.ACTIVE) {
          const nextNodeId = this.getNextNodeId(workflow, participant.currentNodeId!);
          if (nextNodeId) {
            participant.currentNodeId = nextNodeId;
            await participant.save();
            await this.executeNextNode(participant.id);
          } else {
            await this.completeParticipant(participant);
          }
        }
        processed++;
      } catch (error) {
        logger.error(`Error processing waiting participant ${participant.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Personalize text with lead data
   */
  private personalize(text: string, lead: ILead): string {
    return text
      .replace(/\{\{firstName\}\}/g, lead.firstName || '')
      .replace(/\{\{lastName\}\}/g, lead.lastName || '')
      .replace(/\{\{email\}\}/g, lead.email)
      .replace(/\{\{company\}\}/g, lead.company || '')
      .replace(/\{\{phone\}\}/g, lead.phone || '')
      .replace(/\{\{score\}\}/g, String(lead.score || 0));
  }

  /**
   * Personalize object with lead data
   */
  private personalizeObject(obj: Record<string, any>, lead: ILead): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.personalize(value, lead);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.personalizeObject(value, lead);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Get lead data for webhooks
   */
  private getLeadData(lead: ILead): Record<string, any> {
    return {
      id: lead._id.toString(),
      email: lead.email,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      phone: lead.phone,
      score: lead.score,
      tags: lead.tags,
      status: lead.status,
      createdAt: lead.createdAt,
    };
  }
}

/**
 * Node execution result
 */
interface NodeExecutionResult {
  message: string;
  metadata?: Record<string, any>;
  wait?: boolean;
  waitUntil?: Date;
  exit?: boolean;
  exitReason?: string;
  nextNodeId?: string;
  branchLabel?: string;
}

export const workflowEngine = new WorkflowEngine();
export default workflowEngine;
