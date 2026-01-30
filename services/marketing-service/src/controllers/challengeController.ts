import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import challengeService from '../services/challengeService';
import { ChallengeStatus, ParticipantStatus } from '../models';
import logger from '../utils/logger';

/**
 * Challenge Controller - HTTP request handlers for the Challenge System
 */

// ==========================================
// Challenge Management (Admin)
// ==========================================

/**
 * Create a new challenge
 * POST /admin/challenges
 */
export const createChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const {
      name,
      slug,
      description,
      tagline,
      totalDays,
      deliveryMode,
      registration,
      community,
      gamification,
    } = req.body;

    const challenge = await challengeService.create({
      name,
      slug,
      description,
      tagline,
      totalDays,
      deliveryMode,
      registration,
      community,
      gamification,
      createdBy: req.userId || 'system',
    });

    res.status(201).json({
      success: true,
      data: challenge,
      message: 'Challenge created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get challenge by ID
 * GET /admin/challenges/:id
 */
export const getChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const challenge = await challengeService.getById(id);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get challenge by slug
 * GET /admin/challenges/slug/:slug
 */
export const getChallengeBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    const challenge = await challengeService.getBySlug(slug);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List challenges with pagination
 * GET /admin/challenges
 */
export const listChallenges = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await challengeService.list({
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      status: status as ChallengeStatus,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      createdBy: req.query.createdBy as string,
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update challenge
 * PUT /admin/challenges/:id
 */
export const updateChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { id } = req.params;
    const {
      name,
      slug,
      description,
      tagline,
      totalDays,
      deliveryMode,
      registration,
      community,
      gamification,
      emails,
    } = req.body;

    const challenge = await challengeService.update(id, {
      name,
      slug,
      description,
      tagline,
      totalDays,
      deliveryMode,
      registration,
      community,
      gamification,
      emails,
      updatedBy: req.userId || 'system',
    });

    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
      message: 'Challenge updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete challenge
 * DELETE /admin/challenges/:id
 */
export const deleteChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await challengeService.delete(id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Challenge deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publish challenge
 * POST /admin/challenges/:id/publish
 */
export const publishChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const challenge = await challengeService.publish(id, req.userId || 'system');
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
      message: 'Challenge published successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause challenge
 * POST /admin/challenges/:id/pause
 */
export const pauseChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const challenge = await challengeService.pause(id, req.userId || 'system');
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
      message: 'Challenge paused successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Challenge Day Management (Admin)
// ==========================================

/**
 * Add or update a challenge day
 * PUT /admin/challenges/:id/days/:dayNumber
 */
export const upsertDay = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { id, dayNumber } = req.params;
    const {
      title,
      description,
      landingPageId,
      emailTemplateId,
      content,
      unlockAfterHours,
      estimatedDuration,
      completionCriteria,
    } = req.body;

    const challenge = await challengeService.upsertDay(
      id,
      {
        dayNumber: parseInt(dayNumber, 10),
        title,
        description,
        landingPageId,
        emailTemplateId,
        content,
        unlockAfterHours,
        estimatedDuration,
        completionCriteria,
      },
      req.userId || 'system'
    );

    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
      message: `Day ${dayNumber} saved successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a challenge day
 * DELETE /admin/challenges/:id/days/:dayNumber
 */
export const removeDay = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, dayNumber } = req.params;

    const challenge = await challengeService.removeDay(
      id,
      parseInt(dayNumber, 10),
      req.userId || 'system'
    );

    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
      message: `Day ${dayNumber} removed successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set pitch day (sales page)
 * PUT /admin/challenges/:id/pitch-day
 */
export const setPitchDay = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { id } = req.params;
    const { title, landingPageId, emailTemplateId, offerDetails } = req.body;

    const challenge = await challengeService.setPitchDay(
      id,
      { title, landingPageId, emailTemplateId, offerDetails },
      req.userId || 'system'
    );

    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: challenge,
      message: 'Pitch day configured successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Participant Management (Admin)
// ==========================================

/**
 * Get challenge participants
 * GET /admin/challenges/:id/participants
 */
export const getParticipants = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      page = '1',
      limit = '20',
      status,
      sortBy = 'registeredAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await challengeService.getParticipants(id, {
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 100),
      status: status as ParticipantStatus,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get challenge statistics
 * GET /admin/challenges/:id/stats
 */
export const getChallengeStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const stats = await challengeService.getStats(id);
    if (!stats) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get challenge leaderboard
 * GET /admin/challenges/:id/leaderboard
 */
export const getLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { limit = '10' } = req.query;

    const leaderboard = await challengeService.getLeaderboard(
      id,
      Math.min(parseInt(limit as string, 10), 50)
    );

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// Public Challenge Routes
// ==========================================

/**
 * List published challenges (public)
 * GET /challenge/list
 */
export const listPublicChallenges = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const result = await challengeService.listPublished({
      page: parseInt(page as string, 10),
      limit: Math.min(parseInt(limit as string, 10), 50),
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get published challenge by slug (public)
 * GET /challenge/:slug
 */
export const getPublicChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;

    const challenge = await challengeService.getPublishedBySlug(slug);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found or not published' },
      });
      return;
    }

    // Return limited public data
    res.json({
      success: true,
      data: {
        id: challenge.id,
        name: challenge.name,
        slug: challenge.slug,
        description: challenge.description,
        tagline: challenge.tagline,
        totalDays: challenge.totalDays,
        deliveryMode: challenge.deliveryMode,
        registration: {
          isOpen: challenge.registration.isOpen,
          startDate: challenge.registration.startDate,
          endDate: challenge.registration.endDate,
          requiresEmail: challenge.registration.requiresEmail,
          requiresName: challenge.registration.requiresName,
          customFields: challenge.registration.customFields,
        },
        community: {
          showParticipantCount: challenge.community.showParticipantCount,
          showLeaderboard: challenge.community.showLeaderboard,
        },
        gamification: {
          enabled: challenge.gamification.enabled,
        },
        metrics: {
          totalRegistrations: challenge.community.showParticipantCount
            ? challenge.metrics.totalRegistrations
            : undefined,
        },
        days: challenge.days.map(day => ({
          dayNumber: day.dayNumber,
          title: day.title,
          description: day.description,
          estimatedDuration: day.estimatedDuration,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register for a challenge (public)
 * POST /challenge/:slug/register
 */
export const registerForChallenge = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() },
      });
      return;
    }

    const { slug } = req.params;
    const {
      email,
      firstName,
      lastName,
      customFieldResponses,
      source,
    } = req.body;

    // Get challenge by slug
    const challenge = await challengeService.getPublishedBySlug(slug);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found or not published' },
      });
      return;
    }

    const participant = await challengeService.registerParticipant(
      challenge.id,
      {
        email,
        firstName,
        lastName,
        customFieldResponses,
        source,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timezone: req.get('X-Timezone'),
      }
    );

    res.status(201).json({
      success: true,
      data: {
        participantId: participant.id,
        currentDay: participant.currentDay,
        registeredAt: participant.registeredAt,
      },
      message: 'Successfully registered for the challenge!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get participant progress (public - authenticated by email token)
 * GET /challenge/:slug/progress
 */
export const getProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const { email, token } = req.query;

    if (!email) {
      res.status(400).json({
        success: false,
        error: { message: 'Email is required' },
      });
      return;
    }

    // Get challenge by slug
    const challenge = await challengeService.getBySlug(slug);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    const progress = await challengeService.getParticipantProgress(
      challenge.id,
      email as string
    );

    if (!progress) {
      res.status(404).json({
        success: false,
        error: { message: 'Not registered for this challenge' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        participant: {
          currentDay: progress.participant.currentDay,
          completedDays: progress.participant.completedDays,
          dayProgress: progress.participant.dayProgress,
          engagement: progress.participant.engagement,
          points: progress.participant.points,
          badges: progress.participant.badges,
          status: progress.participant.status,
        },
        challenge: {
          name: progress.challenge.name,
          totalDays: progress.challenge.totalDays,
          deliveryMode: progress.challenge.deliveryMode,
        },
        currentDayContent: progress.currentDayContent,
        nextUnlock: progress.nextUnlock,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark day as complete (public - authenticated by email token)
 * POST /challenge/:slug/days/:dayNumber/complete
 */
export const completeDay = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug, dayNumber } = req.params;
    const {
      email,
      videoWatchPercent,
      exercisesCompleted,
      quizScore,
      timeSpentMinutes,
    } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: { message: 'Email is required' },
      });
      return;
    }

    // Get challenge by slug
    const challenge = await challengeService.getBySlug(slug);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found' },
      });
      return;
    }

    const participant = await challengeService.completeDay(
      challenge.id,
      email,
      parseInt(dayNumber, 10),
      {
        videoWatchPercent,
        exercisesCompleted,
        quizScore,
        timeSpentMinutes,
      }
    );

    if (!participant) {
      res.status(404).json({
        success: false,
        error: { message: 'Not registered for this challenge' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        currentDay: participant.currentDay,
        completedDays: participant.completedDays,
        points: participant.points,
        badges: participant.badges,
        status: participant.status,
      },
      message: `Day ${dayNumber} completed successfully!`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public leaderboard
 * GET /challenge/:slug/leaderboard
 */
export const getPublicLeaderboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { slug } = req.params;
    const { limit = '10' } = req.query;

    // Get challenge by slug
    const challenge = await challengeService.getPublishedBySlug(slug);
    if (!challenge) {
      res.status(404).json({
        success: false,
        error: { message: 'Challenge not found or not published' },
      });
      return;
    }

    // Check if leaderboard is enabled
    if (!challenge.community.showLeaderboard) {
      res.status(403).json({
        success: false,
        error: { message: 'Leaderboard is not enabled for this challenge' },
      });
      return;
    }

    const leaderboard = await challengeService.getLeaderboard(
      challenge.id,
      Math.min(parseInt(limit as string, 10), 50)
    );

    // Return limited data for public leaderboard
    res.json({
      success: true,
      data: leaderboard.map((p, index) => ({
        rank: index + 1,
        firstName: p.firstName,
        lastName: p.lastName ? p.lastName[0] + '.' : undefined, // Privacy: show only initial
        points: p.points,
        completedDays: p.completedDays.length,
        badges: p.badges,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export default {
  // Admin endpoints
  createChallenge,
  getChallenge,
  getChallengeBySlug,
  listChallenges,
  updateChallenge,
  deleteChallenge,
  publishChallenge,
  pauseChallenge,
  upsertDay,
  removeDay,
  setPitchDay,
  getParticipants,
  getChallengeStats,
  getLeaderboard,
  // Public endpoints
  getPublicChallenge,
  registerForChallenge,
  getProgress,
  completeDay,
  getPublicLeaderboard,
};
