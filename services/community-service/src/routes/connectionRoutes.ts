import { Router } from 'express';
import { body } from 'express-validator';
import {
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  getActivityFeed,
  getUserProfile,
  getConnectionStats
} from '../controllers/connectionController';
import { authenticate } from '@cloudmastershub/middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// All connection routes require authentication
router.use(authenticate);

// User's own connections
router.get('/followers', getFollowers);
router.get('/following', getFollowing);
router.get('/feed', getActivityFeed);
router.get('/stats', getConnectionStats);

// Follow/unfollow actions
router.post(
  '/follow/:userId',
  [
    body('targetUserName').optional().isString(),
    body('targetUserAvatar').optional().isString()
  ],
  validateRequest,
  followUser
);

router.delete('/follow/:userId', unfollowUser);

// Block/unblock actions
router.post('/block/:userId', blockUser);
router.delete('/block/:userId', unblockUser);

// View other user's connections
router.get('/users/:userId/followers', getFollowers);
router.get('/users/:userId/following', getFollowing);

export default router;

// User profile routes (mounted at /users)
export const userProfileRouter = Router();

userProfileRouter.get('/:userId/profile', getUserProfile);
