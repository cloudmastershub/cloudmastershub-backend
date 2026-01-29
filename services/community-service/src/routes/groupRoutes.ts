import { Router } from 'express';
import { body } from 'express-validator';
import {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  updateMember,
  getGroupPosts,
  getUserGroups
} from '../controllers/groupController';
import { authenticate } from '@cloudmastershub/middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Public routes
router.get('/', getGroups);
router.get('/:id', getGroupById);
router.get('/:id/posts', getGroupPosts);

// Protected routes
router.use(authenticate);

router.get('/user/my-groups', getUserGroups);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').optional().isIn(['study', 'project', 'certification', 'networking', 'mentorship', 'other']),
    body('privacy').optional().isIn(['public', 'private', 'hidden']),
    body('coverImage').optional().isString(),
    body('icon').optional().isString(),
    body('tags').optional().isArray(),
    body('rules').optional().isArray(),
    body('maxMembers').optional().isInt({ min: 2, max: 10000 }),
    body('courseId').optional().isString()
  ],
  validateRequest,
  createGroup
);

router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('category').optional().isIn(['study', 'project', 'certification', 'networking', 'mentorship', 'other']),
    body('privacy').optional().isIn(['public', 'private', 'hidden']),
    body('coverImage').optional().isString(),
    body('icon').optional().isString(),
    body('tags').optional().isArray(),
    body('rules').optional().isArray(),
    body('maxMembers').optional().isInt({ min: 2, max: 10000 })
  ],
  validateRequest,
  updateGroup
);

router.delete('/:id', deleteGroup);

router.post('/:id/join', joinGroup);
router.post('/:id/leave', leaveGroup);

router.get('/:id/members', getGroupMembers);

router.put(
  '/:id/members/:memberId',
  [
    body('role').optional().isIn(['member', 'moderator', 'admin']),
    body('status').optional().isIn(['active', 'pending', 'banned']),
    body('banReason').optional().isString()
  ],
  validateRequest,
  updateMember
);

export default router;
