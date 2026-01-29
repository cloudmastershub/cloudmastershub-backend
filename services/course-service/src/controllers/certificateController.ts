import { Request, Response, NextFunction } from 'express';
import { Certificate } from '../models/Certificate';
import { CourseProgress } from '../models/CourseProgress';
import { Course } from '../models/Course';
import { LearningPath, LearningPathProgress } from '../models/LearningPath';
import logger from '../utils/logger';

/**
 * Verify a certificate by its verification code (PUBLIC - no auth required)
 */
export const verifyCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code } = req.params;

    if (!code) {
      res.status(400).json({
        success: false,
        error: { message: 'Verification code is required', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    const certificate = await Certificate.findOne({
      verificationCode: code.toUpperCase()
    }).lean();

    if (!certificate) {
      res.status(404).json({
        success: false,
        verified: false,
        error: { message: 'Certificate not found', code: 'CERTIFICATE_NOT_FOUND' }
      });
      return;
    }

    if (certificate.status === 'revoked') {
      res.status(410).json({
        success: false,
        verified: false,
        error: {
          message: 'This certificate has been revoked',
          code: 'CERTIFICATE_REVOKED',
          revokedAt: certificate.revokedAt,
          reason: certificate.revokedReason
        }
      });
      return;
    }

    logger.info(`Certificate verified: ${code}`);

    res.json({
      success: true,
      verified: true,
      data: {
        certificateId: certificate.certificateId,
        verificationCode: certificate.verificationCode,
        recipientName: certificate.userName,
        type: certificate.type,
        title: certificate.courseTitle || certificate.pathTitle,
        skills: certificate.skills,
        issuedAt: certificate.issuedAt,
        completedAt: certificate.completedAt,
        finalScore: certificate.finalScore,
        creditsEarned: certificate.creditsEarned,
        issuer: 'CloudMastersHub',
        verificationUrl: `https://cloudmastershub.com/certificates/verify/${certificate.verificationCode}`
      }
    });
  } catch (error: any) {
    logger.error('Error verifying certificate:', error);
    next(error);
  }
};

/**
 * Get all certificates for the authenticated user
 */
export const getUserCertificates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    const certificates = await Certificate.find({ userId, status: 'issued' })
      .sort({ issuedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: certificates,
      count: certificates.length
    });
  } catch (error: any) {
    logger.error('Error fetching user certificates:', error);
    next(error);
  }
};

/**
 * Get a specific certificate by ID
 */
export const getCertificateById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({ certificateId }).lean();

    if (!certificate) {
      res.status(404).json({
        success: false,
        error: { message: 'Certificate not found', code: 'CERTIFICATE_NOT_FOUND' }
      });
      return;
    }

    // Non-owners can only see limited public info
    if (certificate.userId !== userId) {
      res.json({
        success: true,
        data: {
          certificateId: certificate.certificateId,
          verificationCode: certificate.verificationCode,
          recipientName: certificate.userName,
          type: certificate.type,
          title: certificate.courseTitle || certificate.pathTitle,
          issuedAt: certificate.issuedAt,
          status: certificate.status
        }
      });
      return;
    }

    res.json({
      success: true,
      data: certificate
    });
  } catch (error: any) {
    logger.error('Error fetching certificate:', error);
    next(error);
  }
};

/**
 * Generate a certificate for a completed course
 */
export const generateCourseCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { courseId } = req.params;
    const { userName, userEmail } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    if (!userName) {
      res.status(400).json({
        success: false,
        error: { message: 'userName is required for certificate generation', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Check if certificate already exists
    const existingCert = await Certificate.findOne({
      userId,
      courseId,
      type: 'course',
      status: 'issued'
    });

    if (existingCert) {
      res.json({
        success: true,
        message: 'Certificate already exists',
        data: existingCert
      });
      return;
    }

    // Verify course completion
    const progress = await CourseProgress.findOne({ userId, courseId });

    if (!progress || progress.progress < 100 || !progress.completedAt) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Course not completed. Complete all lessons to earn a certificate.',
          code: 'COURSE_NOT_COMPLETED',
          currentProgress: progress?.progress || 0
        }
      });
      return;
    }

    // Fetch course details
    let course = await Course.findOne({ slug: courseId });
    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course) {
      res.status(404).json({
        success: false,
        error: { message: 'Course not found', code: 'COURSE_NOT_FOUND' }
      });
      return;
    }

    // Extract skills from course
    const skills = course.tags || [];
    if (course.category) skills.unshift(course.category);

    // Calculate final score and credits
    const totalLessons = course.curriculum?.reduce((sum: number, section: any) =>
      sum + (section.lessons?.length || 0), 0) || 0;
    const creditsEarned = Math.round(course.duration / 60) || 1; // 1 credit per hour

    // Create certificate
    const certificate = new Certificate({
      userId,
      userName,
      userEmail,
      type: 'course',
      courseId: course.slug,
      courseTitle: course.title,
      completedAt: progress.completedAt,
      skills,
      finalScore: progress.progress,
      creditsEarned,
      metadata: {
        totalLessons,
        totalWatchTime: progress.watchedTime,
        totalQuizzes: 0, // TODO: implement quiz tracking
        averageQuizScore: 0
      }
    });

    // Generate LinkedIn share URL
    certificate.generateLinkedInShareUrl();

    await certificate.save();

    // Update course progress with certificate reference
    progress.certificate = {
      id: certificate.certificateId,
      userId,
      courseId: course.slug,
      issuedAt: certificate.issuedAt,
      certificateUrl: `https://cloudmastershub.com/certificates/${certificate.certificateId}`,
      verificationCode: certificate.verificationCode
    };
    await progress.save();

    logger.info(`Generated certificate ${certificate.verificationCode} for user ${userId} course ${courseId}`);

    res.status(201).json({
      success: true,
      message: 'Certificate generated successfully',
      data: certificate
    });
  } catch (error: any) {
    logger.error('Error generating course certificate:', error);
    next(error);
  }
};

/**
 * Generate a certificate for a completed learning path
 */
export const generatePathCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { pathId } = req.params;
    const { userName, userEmail } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    if (!userName) {
      res.status(400).json({
        success: false,
        error: { message: 'userName is required for certificate generation', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Check if certificate already exists
    const existingCert = await Certificate.findOne({
      userId,
      pathId,
      type: 'learning_path',
      status: 'issued'
    });

    if (existingCert) {
      res.json({
        success: true,
        message: 'Certificate already exists',
        data: existingCert
      });
      return;
    }

    // Verify learning path completion
    const progress = await LearningPathProgress.findOne({ userId, pathId });

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
    const learningPath = await LearningPath.findById(pathId);

    if (!learningPath) {
      res.status(404).json({
        success: false,
        error: { message: 'Learning path not found', code: 'PATH_NOT_FOUND' }
      });
      return;
    }

    // Extract skills from learning path
    const skills = learningPath.skills || [];

    // Create certificate
    const certificate = new Certificate({
      userId,
      userName,
      userEmail,
      type: 'learning_path',
      pathId,
      pathTitle: learningPath.title,
      completedAt: progress.completedAt || new Date(),
      skills,
      finalScore: progress.progress,
      creditsEarned: learningPath.estimatedHours || 0,
      metadata: {
        totalLessons: learningPath.steps?.length || 0,
        totalWatchTime: progress.totalTimeSpentMinutes * 60
      }
    });

    // Generate LinkedIn share URL
    certificate.generateLinkedInShareUrl();

    await certificate.save();

    logger.info(`Generated path certificate ${certificate.verificationCode} for user ${userId} path ${pathId}`);

    res.status(201).json({
      success: true,
      message: 'Certificate generated successfully',
      data: certificate
    });
  } catch (error: any) {
    logger.error('Error generating path certificate:', error);
    next(error);
  }
};

/**
 * Get LinkedIn share URL for a certificate
 */
export const getLinkedInShareUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({ certificateId, userId });

    if (!certificate) {
      res.status(404).json({
        success: false,
        error: { message: 'Certificate not found', code: 'CERTIFICATE_NOT_FOUND' }
      });
      return;
    }

    // Generate URL if not exists
    if (!certificate.linkedInShareUrl) {
      certificate.generateLinkedInShareUrl();
      await certificate.save();
    }

    res.json({
      success: true,
      data: {
        linkedInShareUrl: certificate.linkedInShareUrl,
        verificationCode: certificate.verificationCode,
        title: certificate.courseTitle || certificate.pathTitle
      }
    });
  } catch (error: any) {
    logger.error('Error getting LinkedIn share URL:', error);
    next(error);
  }
};
