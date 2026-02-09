import { Router, Request, Response } from 'express';
import { getUserById } from '../services/userService';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /internal/users/:id
 * Internal service-to-service endpoint (no auth).
 * Returns minimal user data for cross-service enrichment.
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  const serviceHeader = req.headers['x-internal-service'];
  if (!serviceHeader) {
    return res.status(403).json({ error: 'Forbidden: missing x-internal-service header' });
  }

  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      subscriptionPlan: user.subscriptionPlan || null,
    });
  } catch (error: any) {
    logger.error('Internal user lookup failed', { userId: req.params.id, error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
