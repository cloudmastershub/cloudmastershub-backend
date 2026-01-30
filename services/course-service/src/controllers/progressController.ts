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
    const { userId, courseId, lessonId, watchTime = 0, completed = false, currentLesson } = req.body;

    if (!userId || !courseId) {
      res.status(400).json({
        success: false,
        error: { message: 'userId and courseId are required', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Find or create progress record
    let progress = await CourseProgress.findOne({ userId, courseId });

    if (!progress) {
      progress = new CourseProgress({
        userId,
        courseId,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessedAt: new Date(),
        completedLessons: [],
        watchedTime: 0,
      });
    }

    // Update watch time
    if (watchTime > 0) {
      progress.watchedTime = (progress.watchedTime || 0) + watchTime;
    }

    // Mark lesson as completed if provided
    if (lessonId && completed) {
      if (!progress.completedLessons.includes(lessonId)) {
        progress.completedLessons.push(lessonId);
      }
    }

    // Update current lesson
    if (currentLesson) {
      progress.currentLesson = currentLesson;
    }

    progress.lastAccessedAt = new Date();

    await progress.save();

    logger.info(`Updated progress for user ${userId} in course ${courseId}`);

    res.json({
      success: true,
      data: {
        userId,
        courseId,
        lessonId,
        watchTime: progress.watchedTime,
        completed,
        completedLessons: progress.completedLessons.length,
        progress: progress.progress,
        updatedAt: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Error updating progress:', error);
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

    if (!courseId || !userId) {
      res.status(400).json({
        success: false,
        error: { message: 'courseId and userId are required', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Fetch progress from MongoDB
    const progress = await CourseProgress.findOne({ userId, courseId }).lean();

    if (!progress) {
      res.status(404).json({
        success: false,
        error: { message: 'No progress found for this user and course', code: 'PROGRESS_NOT_FOUND' }
      });
      return;
    }

    // Calculate estimated time to complete (rough estimate)
    const remainingProgress = 100 - (progress.progress || 0);
    const avgTimePerPercent = progress.watchedTime && progress.progress
      ? progress.watchedTime / progress.progress
      : 60; // Default 60 seconds per percent
    const estimatedTimeToComplete = Math.round(remainingProgress * avgTimePerPercent);

    const courseProgress = {
      userId: progress.userId,
      courseId: progress.courseId,
      enrolledAt: progress.enrolledAt,
      progress: progress.progress || 0,
      lastAccessedAt: progress.lastAccessedAt,
      completedLessons: progress.completedLessons || [],
      currentLesson: progress.currentLesson,
      watchedTime: progress.watchedTime || 0,
      estimatedTimeToComplete,
      completedAt: progress.completedAt,
      certificate: progress.certificate || null,
    };

    logger.info(`Fetched progress for user ${userId} in course ${courseId}: ${courseProgress.progress}%`);

    res.json({
      success: true,
      data: courseProgress,
    });
  } catch (error: any) {
    logger.error('Error fetching course progress:', error);
    next(error);
  }
};

export const getUserStreaks = async (
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

    // Calculate current streak (consecutive days with activity)
    let currentStreak = 0;
    let longestStreak = 0;
    let lastActivityDate: Date | null = null;

    if (progressRecords.length > 0) {
      // Get most recent activity date
      const sortedByActivity = [...progressRecords]
        .filter(p => p.lastAccessedAt)
        .sort((a, b) => new Date(b.lastAccessedAt!).getTime() - new Date(a.lastAccessedAt!).getTime());

      if (sortedByActivity.length > 0) {
        lastActivityDate = new Date(sortedByActivity[0].lastAccessedAt!);
      }

      // Get unique dates of activity (normalized to midnight)
      const activityDates = new Set<string>();
      progressRecords.forEach(p => {
        if (p.lastAccessedAt) {
          const date = new Date(p.lastAccessedAt);
          activityDates.add(date.toISOString().split('T')[0]);
        }
        if (p.enrolledAt) {
          const date = new Date(p.enrolledAt);
          activityDates.add(date.toISOString().split('T')[0]);
        }
      });

      const sortedDates = Array.from(activityDates).sort().reverse();
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Calculate current streak (must include today or yesterday to be "active")
      if (sortedDates.length > 0 && (sortedDates[0] === today || sortedDates[0] === yesterday)) {
        currentStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const currentDate = new Date(sortedDates[i - 1]);
          const prevDate = new Date(sortedDates[i]);
          const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / 86400000);

          if (diffDays === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      // Calculate longest streak from all activity
      let tempStreak = 1;
      longestStreak = 1;
      const allSortedDates = Array.from(activityDates).sort();

      for (let i = 1; i < allSortedDates.length; i++) {
        const prevDate = new Date(allSortedDates[i - 1]);
        const currentDate = new Date(allSortedDates[i]);
        const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / 86400000);

        if (diffDays === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }
    }

    logger.info(`Fetched streaks for user ${userId}: current=${currentStreak}, longest=${longestStreak}`);

    res.json({
      success: true,
      data: {
        currentStreak,
        longestStreak,
        lastActivityDate: lastActivityDate?.toISOString() || null
      },
    });
  } catch (error: any) {
    logger.error('Error fetching user streaks:', error);
    next(error);
  }
};

export const getCompletedCourses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'userId is required', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Fetch completed courses from MongoDB
    const completedProgress = await CourseProgress.find({
      userId,
      completedAt: { $exists: true, $ne: null }
    })
    .sort({ completedAt: -1 })
    .lean();

    const completedCourses = completedProgress.map(p => ({
      courseId: p.courseId,
      completedAt: p.completedAt,
      certificateId: p.certificate?.id || null,
      verificationCode: p.certificate?.verificationCode || null,
      finalGrade: p.progress || 100,
      watchedTime: p.watchedTime || 0,
      lessonsCompleted: p.completedLessons?.length || 0,
    }));

    logger.info(`Fetched ${completedCourses.length} completed courses for user ${userId}`);

    res.json({
      success: true,
      data: completedCourses,
    });
  } catch (error: any) {
    logger.error('Error fetching completed courses:', error);
    next(error);
  }
};
