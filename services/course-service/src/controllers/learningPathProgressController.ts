import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { Certificate } from '../models/Certificate';
import { LearningPath, LearningPathProgress as LearningPathProgressModel } from '../models/LearningPath';

export const enrollInLearningPath = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const { enrollmentType = 'free', paymentId, subscriptionId } = req.body;

    logger.info('Enrolling user in learning path', { pathId: id, userId, enrollmentType });

    const learningPath = await LearningPath.findById(id);

    if (!learningPath) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: { code: 'PATH_NOT_FOUND', details: `No learning path exists with ID: ${id}` }
      });
      return;
    }

    // Check if user is already enrolled
    const existingProgress = await LearningPathProgressModel.findOne({ userId, pathId: id });

    if (existingProgress) {
      res.status(400).json({
        success: false,
        message: 'User is already enrolled in this learning path',
      });
      return;
    }

    // Validate enrollment type
    if (enrollmentType === 'purchased' && !paymentId) {
      res.status(400).json({ success: false, message: 'Payment ID is required for purchased enrollment' });
      return;
    }
    if (enrollmentType === 'subscription' && !subscriptionId) {
      res.status(400).json({ success: false, message: 'Subscription ID is required for subscription-based enrollment' });
      return;
    }
    if (enrollmentType === 'free' && !learningPath.isFree) {
      res.status(400).json({ success: false, message: 'This learning path requires payment or subscription' });
      return;
    }

    // Create progress record in MongoDB
    const progress = new LearningPathProgressModel({
      userId,
      pathId: id,
      enrolledAt: new Date(),
      enrollmentType,
      progress: 0,
      completedSteps: [],
      skippedSteps: [],
      totalTimeSpentMinutes: 0,
      lastAccessedAt: new Date(),
      isCompleted: false,
      strengths: [],
      weaknesses: [],
      recommendedNextPaths: [],
    });

    await progress.save();

    const progressId = (progress as any)._id.toString();
    logger.info('User enrolled in learning path', { pathId: id, userId, progressId });

    res.status(201).json({
      success: true,
      message: 'Successfully enrolled in learning path',
      data: {
        enrollment: {
          id: progressId,
          pathId: id,
          userId,
          enrollmentType,
          enrolledAt: progress.enrolledAt,
          isActive: true,
        },
        progress: {
          id: progressId,
          userId,
          pathId: id,
          progress: 0,
          completedSteps: [],
          totalTimeSpentMinutes: 0,
          isCompleted: false,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error enrolling in learning path:', error);
    next(error);
  }
};

export const updateStepProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, stepId } = req.params;
    const userId = (req as any).user?.userId;
    const { isCompleted, timeSpent = 0, score, notes, skipReason } = req.body;

    logger.info('Updating step progress', { pathId: id, stepId, userId, isCompleted, timeSpent });

    // Fetch the learning path to know total steps
    const learningPath = await LearningPath.findById(id);
    if (!learningPath) {
      res.status(404).json({ success: false, message: 'Learning path not found' });
      return;
    }

    // Find user's progress record
    const progress = await LearningPathProgressModel.findOne({ userId, pathId: id });
    if (!progress) {
      res.status(404).json({
        success: false,
        message: 'User is not enrolled in this learning path',
        error: { code: 'NOT_ENROLLED' }
      });
      return;
    }

    // Update step completion
    if (isCompleted && !progress.completedSteps.includes(stepId)) {
      progress.completedSteps.push(stepId);
    }
    if (skipReason && !progress.skippedSteps.includes(stepId)) {
      progress.skippedSteps.push(stepId);
    }

    // Update time spent
    progress.totalTimeSpentMinutes += timeSpent;
    progress.lastAccessedAt = new Date();

    // Recalculate overall progress
    const totalSteps = learningPath.pathway?.length || 1;
    const overallProgress = Math.round((progress.completedSteps.length / totalSteps) * 100 * 10) / 10;
    progress.progress = overallProgress;

    // Check if path is completed
    if (overallProgress >= 100) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
    }

    await progress.save();

    res.status(200).json({
      success: true,
      message: 'Step progress updated successfully',
      data: {
        stepProgress: {
          stepId,
          isCompleted,
          timeSpent,
          score,
          completedAt: isCompleted ? new Date() : undefined,
          notes,
          skipReason,
        },
        overallProgress,
        completedSteps: progress.completedSteps.length,
        totalSteps,
        isPathCompleted: progress.isCompleted,
      },
    });
  } catch (error: any) {
    logger.error('Error updating step progress:', error);
    next(error);
  }
};

export const getUserLearningPaths = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { status = 'all' } = req.query;

    logger.info('Fetching user learning paths', { userId, status });

    // Fetch all progress records for this user
    const progressRecords = await LearningPathProgressModel.find({ userId }).lean();

    if (progressRecords.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          paths: [],
          summary: { total: 0, completed: 0, inProgress: 0, enrolled: 0 },
        },
      });
      return;
    }

    // Fetch the associated learning paths
    const pathIds = progressRecords.map(p => p.pathId);
    const learningPaths = await LearningPath.find({ _id: { $in: pathIds } }).lean();
    const pathMap = new Map(learningPaths.map(p => [p._id.toString(), p]));

    // Build user paths with real data
    const userPaths = progressRecords.map(record => {
      const path = pathMap.get(record.pathId?.toString());
      const totalSteps = path?.pathway?.length || 0;

      return {
        pathId: record.pathId?.toString(),
        title: path?.title || 'Unknown Path',
        thumbnail: path?.thumbnail || '',
        enrollmentType: record.enrollmentType || 'free',
        enrolledAt: record.enrolledAt,
        progress: record.progress || 0,
        isCompleted: record.isCompleted || false,
        totalSteps,
        completedSteps: record.completedSteps?.length || 0,
        totalTimeSpentMinutes: record.totalTimeSpentMinutes || 0,
        lastAccessedAt: record.lastAccessedAt,
      };
    });

    // Filter based on status
    let filteredPaths = userPaths;
    if (status === 'completed') {
      filteredPaths = userPaths.filter(p => p.isCompleted);
    } else if (status === 'in_progress') {
      filteredPaths = userPaths.filter(p => !p.isCompleted && p.progress > 0);
    } else if (status === 'enrolled') {
      filteredPaths = userPaths.filter(p => p.progress === 0);
    }

    res.status(200).json({
      success: true,
      data: {
        paths: filteredPaths,
        summary: {
          total: userPaths.length,
          completed: userPaths.filter(p => p.isCompleted).length,
          inProgress: userPaths.filter(p => !p.isCompleted && p.progress > 0).length,
          enrolled: userPaths.filter(p => p.progress === 0).length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching user learning paths:', error);
    next(error);
  }
};

export const getLearningPathCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const { userName, userEmail } = req.body;

    logger.info('Fetching/generating learning path certificate', { pathId: id, userId });

    // Check if certificate already exists
    const existingCert = await Certificate.findOne({
      userId,
      pathId: id,
      type: 'learning_path',
      status: 'issued'
    });

    if (existingCert) {
      res.status(200).json({
        success: true,
        message: 'Certificate already exists',
        data: {
          id: existingCert.certificateId,
          pathId: id,
          userId,
          pathTitle: existingCert.pathTitle,
          userName: existingCert.userName,
          completedAt: existingCert.completedAt,
          issuedAt: existingCert.issuedAt,
          certificateUrl: `https://cloudmastershub.com/certificates/${existingCert.certificateId}`,
          verificationCode: existingCert.verificationCode,
          skills: existingCert.skills,
          finalScore: existingCert.finalScore,
          creditsEarned: existingCert.creditsEarned,
          linkedInShareUrl: existingCert.linkedInShareUrl
        },
      });
      return;
    }

    // Verify path completion
    const progress = await LearningPathProgressModel.findOne({ userId, pathId: id });

    if (!progress || !progress.isCompleted) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Learning path not completed. Complete all steps to earn a certificate.',
          code: 'PATH_NOT_COMPLETED',
          currentProgress: progress?.progress || 0
        }
      });
      return;
    }

    // Fetch learning path details
    const learningPath = await LearningPath.findById(id);

    if (!learningPath) {
      res.status(404).json({
        success: false,
        error: { message: 'Learning path not found', code: 'PATH_NOT_FOUND' }
      });
      return;
    }

    if (!userName) {
      res.status(400).json({
        success: false,
        error: { message: 'userName is required in request body for certificate generation', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Create certificate
    const certificate = new Certificate({
      userId,
      userName,
      userEmail,
      type: 'learning_path',
      pathId: id,
      pathTitle: learningPath.title,
      completedAt: progress.completedAt || new Date(),
      skills: learningPath.skills || [],
      finalScore: progress.progress || 100,
      creditsEarned: learningPath.estimatedDurationHours || Math.round((learningPath.pathway?.length || 0) * 2),
      metadata: {
        totalLessons: learningPath.pathway?.length || 0,
        totalWatchTime: (progress.totalTimeSpentMinutes || 0) * 60
      }
    });

    // Generate LinkedIn share URL
    const baseUrl = 'https://www.linkedin.com/profile/add';
    const params = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: certificate.pathTitle || 'CloudMastersHub Certificate',
      organizationName: 'CloudMastersHub',
      issueYear: certificate.issuedAt.getFullYear().toString(),
      issueMonth: (certificate.issuedAt.getMonth() + 1).toString(),
      certUrl: `https://cloudmastershub.com/certificates/verify/${certificate.verificationCode}`,
      certId: certificate.verificationCode
    });
    certificate.linkedInShareUrl = `${baseUrl}?${params.toString()}`;

    await certificate.save();

    logger.info(`Generated path certificate ${certificate.verificationCode} for user ${userId} path ${id}`);

    res.status(201).json({
      success: true,
      message: 'Certificate generated successfully',
      data: {
        id: certificate.certificateId,
        pathId: id,
        userId,
        pathTitle: certificate.pathTitle,
        userName: certificate.userName,
        completedAt: certificate.completedAt,
        issuedAt: certificate.issuedAt,
        certificateUrl: `https://cloudmastershub.com/certificates/${certificate.certificateId}`,
        verificationCode: certificate.verificationCode,
        skills: certificate.skills,
        finalScore: certificate.finalScore,
        creditsEarned: certificate.creditsEarned,
        linkedInShareUrl: certificate.linkedInShareUrl
      },
    });
  } catch (error: any) {
    logger.error('Error generating certificate:', error);
    next(error);
  }
};

export const getRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { limit = 5 } = req.query;

    logger.info('Generating learning path recommendations', { userId });

    // Get user's enrolled/completed path IDs
    const userProgress = await LearningPathProgressModel.find({ userId }).select('pathId').lean();
    const enrolledPathIds = userProgress.map(p => p.pathId?.toString()).filter(Boolean);

    // Recommend paths the user hasn't enrolled in, sorted by popularity
    const recommendations = await LearningPath.find({
      _id: { $nin: enrolledPathIds },
      status: { $in: ['published', 'active'] },
    })
      .sort({ enrollmentCount: -1, rating: -1 })
      .limit(Number(limit))
      .select('title category level estimatedDurationHours skills enrollmentCount rating thumbnail')
      .lean();

    res.status(200).json({
      success: true,
      data: {
        recommendations: recommendations.map(path => ({
          pathId: path._id.toString(),
          title: path.title,
          category: path.category || 'general',
          level: path.level || 'beginner',
          estimatedDuration: path.estimatedDurationHours ? `${path.estimatedDurationHours} hours` : null,
          skills: path.skills || [],
          enrollmentCount: path.enrollmentCount || 0,
          rating: path.rating || 0,
          thumbnail: path.thumbnail || '',
        })),
        generatedAt: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Error generating recommendations:', error);
    next(error);
  }
};

export const getLearningAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { timeframe = '30d' } = req.query;

    logger.info('Fetching learning analytics', { userId, timeframe });

    // Aggregate real user learning data from MongoDB
    const progressRecords = await LearningPathProgressModel.find({ userId }).lean();
    const certificates = await Certificate.find({ userId, type: 'learning_path', status: 'issued' }).lean();

    const totalPathsEnrolled = progressRecords.length;
    const totalPathsCompleted = progressRecords.filter(p => p.isCompleted).length;
    const totalLearningMinutes = progressRecords.reduce((sum, p) => sum + (p.totalTimeSpentMinutes || 0), 0);
    const totalLearningHours = Math.round(totalLearningMinutes / 60 * 10) / 10;

    // Calculate average progress across all paths
    const avgProgress = totalPathsEnrolled > 0
      ? Math.round(progressRecords.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPathsEnrolled * 10) / 10
      : 0;

    const analytics = {
      summary: {
        totalPathsEnrolled,
        totalPathsCompleted,
        totalLearningHours,
        certificatesEarned: certificates.length,
        averageProgress: avgProgress,
      },
      paths: progressRecords.map(record => ({
        pathId: record.pathId?.toString(),
        progress: record.progress || 0,
        isCompleted: record.isCompleted || false,
        completedSteps: record.completedSteps?.length || 0,
        timeSpentMinutes: record.totalTimeSpentMinutes || 0,
        enrolledAt: record.enrolledAt,
        lastAccessedAt: record.lastAccessedAt,
      })),
    };

    res.status(200).json({
      success: true,
      data: analytics,
      timeframe,
      generatedAt: new Date(),
    });
  } catch (error: any) {
    logger.error('Error fetching learning analytics:', error);
    next(error);
  }
};
