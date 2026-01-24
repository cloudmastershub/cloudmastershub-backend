import { Request, Response, NextFunction } from 'express';
import { CourseProgress } from '../models/CourseProgress';
import logger from '../utils/logger';

export const getUserProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'User ID is required' }
      });
      return;
    }

    // Fetch all course progress records for this user
    const progressRecords = await CourseProgress.find({ userId })
      .sort({ lastAccessedAt: -1 })
      .lean();

    // Calculate aggregate stats
    const totalWatchTime = progressRecords.reduce((sum, p) => sum + (p.watchedTime || 0), 0);
    const completedCourses = progressRecords.filter(p => p.completedAt).length;
    const totalCourses = progressRecords.length;
    const overallProgress = totalCourses > 0
      ? Math.round(progressRecords.reduce((sum, p) => sum + (p.progress || 0), 0) / totalCourses)
      : 0;

    // Calculate streak (simplified - days with activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = progressRecords.filter(
      p => p.lastAccessedAt && new Date(p.lastAccessedAt) > thirtyDaysAgo
    );

    // Simple streak calculation based on recent activity
    const streak = recentActivity.length > 0 ? Math.min(recentActivity.length, 7) : 0;

    const progress = {
      userId,
      enrolledCourses: progressRecords.map(p => ({
        courseId: p.courseId,
        enrolledAt: p.enrolledAt,
        progress: p.progress || 0,
        lastAccessedAt: p.lastAccessedAt,
        completedLessons: p.completedLessons?.length || 0,
        currentLesson: p.currentLesson,
        completedAt: p.completedAt,
        watchedTime: p.watchedTime || 0
      })),
      totalWatchTime,
      overallProgress,
      coursesCompleted: completedCourses,
      coursesEnrolled: totalCourses,
      streak,
      certificationsEarned: progressRecords.filter(p => p.certificate).length,
      labsCompleted: 0, // TODO: Integrate with lab service
      pointsEarned: completedCourses * 100 + Math.floor(totalWatchTime / 3600) * 10
    };

    logger.info(`Fetched progress for user ${userId}: ${totalCourses} courses, ${overallProgress}% overall`);

    res.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    logger.error('Error fetching user progress:', error);
    next(error);
  }
};

export const updateProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, courseId, lessonId, watchTime, completed } = req.body;

    // TODO: Update progress in database

    logger.info(`Updating progress for user ${userId} in course ${courseId}`);

    res.json({
      success: true,
      data: {
        userId,
        courseId,
        lessonId,
        watchTime,
        completed,
        updatedAt: new Date(),
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCourseProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, userId } = req.params;

    // TODO: Fetch specific course progress

    const courseProgress = {
      userId,
      courseId,
      enrolledAt: new Date('2024-01-01'),
      progress: 65,
      lastAccessedAt: new Date('2024-01-15'),
      completedLessons: ['lesson1', 'lesson2', 'lesson3'],
      currentLesson: 'lesson4',
      watchedTime: 2400, // seconds
      estimatedTimeToComplete: 1800, // seconds
      certificate: null,
    };

    res.json({
      success: true,
      data: courseProgress,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCompletedCourses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // TODO: Use userId from req.params to fetch completed courses from database
    // const { userId } = req.params;

    const completedCourses = [
      {
        courseId: 'aws-basics',
        completedAt: new Date('2023-12-20'),
        certificateId: 'cert-123',
        finalGrade: 92,
      },
    ];

    res.json({
      success: true,
      data: completedCourses,
    });
  } catch (error: any) {
    next(error);
  }
};
