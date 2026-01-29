import { Request, Response, NextFunction } from 'express';
import { Bookmark } from '../models/Bookmark';
import { Course } from '../models/Course';
import logger from '../utils/logger';

/**
 * Get all bookmarks for a user (optionally filtered by course)
 */
export const getUserBookmarks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId || req.params.userId;
    const { courseId } = req.query;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'User ID is required', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    const query: any = { userId };
    if (courseId) {
      query.courseId = courseId;
    }

    const bookmarks = await Bookmark.find(query)
      .sort({ createdAt: -1 })
      .lean();

    logger.info(`Fetched ${bookmarks.length} bookmarks for user ${userId}`);

    res.json({
      success: true,
      data: bookmarks,
      count: bookmarks.length
    });
  } catch (error: any) {
    logger.error('Error fetching user bookmarks:', error);
    next(error);
  }
};

/**
 * Get bookmarks for a specific lesson
 */
export const getLessonBookmarks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { courseId, lessonId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    const bookmarks = await Bookmark.find({ userId, courseId, lessonId })
      .sort({ timestamp: 1 })
      .lean();

    res.json({
      success: true,
      data: bookmarks,
      count: bookmarks.length
    });
  } catch (error: any) {
    logger.error('Error fetching lesson bookmarks:', error);
    next(error);
  }
};

/**
 * Create a new bookmark
 */
export const createBookmark = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { courseId, lessonId } = req.params;
    const { timestamp, note, title } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    if (timestamp === undefined || timestamp < 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Valid timestamp is required', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Verify course and lesson exist
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

    // Verify lesson exists in course
    let lessonExists = false;
    if (course.curriculum) {
      for (const section of course.curriculum) {
        if (section.lessons?.some((l: any) => l.id === lessonId)) {
          lessonExists = true;
          break;
        }
      }
    }

    if (!lessonExists) {
      res.status(404).json({
        success: false,
        error: { message: 'Lesson not found', code: 'LESSON_NOT_FOUND' }
      });
      return;
    }

    const bookmark = new Bookmark({
      userId,
      courseId: course.slug,
      lessonId,
      timestamp,
      note,
      title
    });

    await bookmark.save();

    logger.info(`Created bookmark for user ${userId} at ${timestamp}s in lesson ${lessonId}`);

    res.status(201).json({
      success: true,
      data: bookmark,
      message: 'Bookmark created successfully'
    });
  } catch (error: any) {
    logger.error('Error creating bookmark:', error);
    next(error);
  }
};

/**
 * Update a bookmark
 */
export const updateBookmark = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { bookmarkId } = req.params;
    const { timestamp, note, title } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    const bookmark = await Bookmark.findOne({ _id: bookmarkId, userId });

    if (!bookmark) {
      res.status(404).json({
        success: false,
        error: { message: 'Bookmark not found', code: 'BOOKMARK_NOT_FOUND' }
      });
      return;
    }

    // Update allowed fields
    if (timestamp !== undefined && timestamp >= 0) {
      bookmark.timestamp = timestamp;
    }
    if (note !== undefined) {
      bookmark.note = note;
    }
    if (title !== undefined) {
      bookmark.title = title;
    }

    await bookmark.save();

    logger.info(`Updated bookmark ${bookmarkId} for user ${userId}`);

    res.json({
      success: true,
      data: bookmark,
      message: 'Bookmark updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating bookmark:', error);
    next(error);
  }
};

/**
 * Delete a bookmark
 */
export const deleteBookmark = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { bookmarkId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    const bookmark = await Bookmark.findOneAndDelete({ _id: bookmarkId, userId });

    if (!bookmark) {
      res.status(404).json({
        success: false,
        error: { message: 'Bookmark not found', code: 'BOOKMARK_NOT_FOUND' }
      });
      return;
    }

    logger.info(`Deleted bookmark ${bookmarkId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Bookmark deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting bookmark:', error);
    next(error);
  }
};

/**
 * Get the last saved position (most recent bookmark) for a lesson
 * Useful for "resume playback" feature
 */
export const getLastPosition = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { courseId, lessonId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
      return;
    }

    // Find the most recent bookmark for this lesson (serves as last position)
    const lastBookmark = await Bookmark.findOne({ userId, courseId, lessonId })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        hasPosition: !!lastBookmark,
        timestamp: lastBookmark?.timestamp || 0,
        bookmarkId: lastBookmark?._id?.toString() || null
      }
    });
  } catch (error: any) {
    logger.error('Error fetching last position:', error);
    next(error);
  }
};
