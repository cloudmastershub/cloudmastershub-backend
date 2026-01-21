import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as workflowController from '../controllers/workflowController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';
import { WorkflowTriggerType, WorkflowNodeType } from '../models/Workflow';

const router = Router();

// ==========================================
// Validation Schemas
// ==========================================

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid workflow ID'),
];

const leadIdParamValidation = [
  param('leadId')
    .isMongoId()
    .withMessage('Invalid lead ID'),
];

const createWorkflowValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('trigger')
    .notEmpty()
    .withMessage('Trigger is required'),
  body('trigger.type')
    .isIn(Object.values(WorkflowTriggerType))
    .withMessage('Invalid trigger type'),
  body('nodes')
    .optional()
    .isArray()
    .withMessage('Nodes must be an array'),
  body('nodes.*.id')
    .optional()
    .isString()
    .withMessage('Node ID must be a string'),
  body('nodes.*.type')
    .optional()
    .isIn(Object.values(WorkflowNodeType))
    .withMessage('Invalid node type'),
  body('nodes.*.name')
    .optional()
    .isString()
    .withMessage('Node name must be a string'),
  body('edges')
    .optional()
    .isArray()
    .withMessage('Edges must be an array'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  body('folder')
    .optional()
    .isString()
    .withMessage('Folder must be a string'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const updateWorkflowValidation = [
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('trigger')
    .optional(),
  body('trigger.type')
    .optional()
    .isIn(Object.values(WorkflowTriggerType))
    .withMessage('Invalid trigger type'),
  body('nodes')
    .optional()
    .isArray()
    .withMessage('Nodes must be an array'),
  body('edges')
    .optional()
    .isArray()
    .withMessage('Edges must be an array'),
  body('settings')
    .optional()
    .isObject()
    .withMessage('Settings must be an object'),
  body('folder')
    .optional()
    .isString()
    .withMessage('Folder must be a string'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const enrollLeadValidation = [
  body('leadId')
    .notEmpty()
    .withMessage('Lead ID is required')
    .isMongoId()
    .withMessage('Invalid lead ID'),
  body('triggerData')
    .optional()
    .isObject()
    .withMessage('Trigger data must be an object'),
];

const listQueryValidation = [
  query('status')
    .optional()
    .isIn(['draft', 'active', 'paused', 'archived'])
    .withMessage('Invalid status'),
  query('triggerType')
    .optional()
    .isIn(Object.values(WorkflowTriggerType))
    .withMessage('Invalid trigger type'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

// ==========================================
// Routes
// ==========================================

// List workflows
router.get(
  '/',
  authenticate,
  requireAdmin,
  listQueryValidation,
  workflowController.listWorkflows
);

// Create workflow
router.post(
  '/',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_WORKFLOW'),
  createWorkflowValidation,
  workflowController.createWorkflow
);

// Get workflow by ID
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  workflowController.getWorkflow
);

// Update workflow
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_WORKFLOW'),
  idParamValidation,
  updateWorkflowValidation,
  workflowController.updateWorkflow
);

// Delete workflow
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_WORKFLOW'),
  idParamValidation,
  workflowController.deleteWorkflow
);

// Activate workflow
router.post(
  '/:id/activate',
  authenticate,
  requireAdmin,
  logAdminAction('ACTIVATE_WORKFLOW'),
  idParamValidation,
  workflowController.activateWorkflow
);

// Pause workflow
router.post(
  '/:id/pause',
  authenticate,
  requireAdmin,
  logAdminAction('PAUSE_WORKFLOW'),
  idParamValidation,
  workflowController.pauseWorkflow
);

// Archive workflow
router.post(
  '/:id/archive',
  authenticate,
  requireAdmin,
  logAdminAction('ARCHIVE_WORKFLOW'),
  idParamValidation,
  workflowController.archiveWorkflow
);

// Duplicate workflow
router.post(
  '/:id/duplicate',
  authenticate,
  requireAdmin,
  logAdminAction('DUPLICATE_WORKFLOW'),
  idParamValidation,
  workflowController.duplicateWorkflow
);

// Get workflow statistics
router.get(
  '/:id/stats',
  authenticate,
  requireAdmin,
  idParamValidation,
  workflowController.getWorkflowStats
);

// Get workflow participants
router.get(
  '/:id/participants',
  authenticate,
  requireAdmin,
  idParamValidation,
  workflowController.getWorkflowParticipants
);

// Manually enroll lead in workflow
router.post(
  '/:id/enroll',
  authenticate,
  requireAdmin,
  logAdminAction('ENROLL_LEAD_WORKFLOW'),
  idParamValidation,
  enrollLeadValidation,
  workflowController.enrollLead
);

// Remove lead from workflow
router.delete(
  '/:id/participants/:leadId',
  authenticate,
  requireAdmin,
  logAdminAction('REMOVE_LEAD_WORKFLOW'),
  idParamValidation,
  leadIdParamValidation,
  workflowController.removeLead
);

export default router;
