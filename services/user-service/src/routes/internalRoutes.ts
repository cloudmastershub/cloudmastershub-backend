import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { getUserById } from '../services/userService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /internal/users/:id
 * Internal service-to-service endpoint (no auth).
 * Returns minimal user data for cross-service enrichment.
 * Checks MongoDB first (Google OAuth users), then PostgreSQL.
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  const serviceHeader = req.headers['x-internal-service'];
  if (!serviceHeader) {
    return res.status(403).json({ error: 'Forbidden: missing x-internal-service header' });
  }

  const userId = req.params.id;

  try {
    // Try MongoDB first (Google OAuth users use ObjectId)
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const mongoUser = await User.findById(userId);
      if (mongoUser) {
        return res.json({
          id: mongoUser._id.toString(),
          email: mongoUser.email,
          firstName: mongoUser.firstName,
          lastName: mongoUser.lastName,
          subscriptionPlan: mongoUser.subscription || null,
        });
      }
    }

    // Fall back to PostgreSQL (UUID-based users)
    const pgUser = await getUserById(userId);
    if (pgUser) {
      return res.json({
        id: pgUser.id,
        email: pgUser.email,
        firstName: pgUser.firstName,
        lastName: pgUser.lastName,
        subscriptionPlan: pgUser.subscriptionPlan || null,
      });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (error: any) {
    logger.error('Internal user lookup failed', { userId, error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
