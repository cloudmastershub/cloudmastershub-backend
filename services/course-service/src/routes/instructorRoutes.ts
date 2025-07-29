import { Router, Response, NextFunction } from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
} from '../controllers/courseController';
import { authenticate, AuthRequest } from '@cloudmastershub/middleware';
import { requirePremiumSubscription } from '@cloudmastershub/middleware';

const router = Router();

// All instructor routes require authentication
router.use(authenticate);

// Instructor course management endpoints
// These endpoints provide instructor-specific functionality for course management

// Get all courses created by the instructor
router.get('/courses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Add instructor filter to the request to only show courses created by this instructor
    req.query.instructor = req.userId;
    // Allow instructors to see all their courses regardless of status
    if (!req.query.status) {
      req.query.status = 'all';
    }
    await getAllCourses(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch instructor courses',
        details: error.message
      }
    });
  }
});

// Get specific course details (instructor must own the course)
router.get('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await getCourseById(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch course details',
        details: error.message
      }
    });
  }
});

// Create new course (requires premium subscription for instructors)
router.post('/courses', requirePremiumSubscription(), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Ensure the instructor field is set to the authenticated user
    req.body.instructor = req.userId;
    await createCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create course',
        details: error.message
      }
    });
  }
});

// Update course (instructor must own the course)
router.put('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await updateCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update course',
        details: error.message
      }
    });
  }
});

// Delete course (instructor must own the course)
router.delete('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete course',
        details: error.message
      }
    });
  }
});

// Publish course
router.post('/courses/:id/publish', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // This would typically set the course status to 'published' or 'under_review'
    // For now, we'll use the update course controller with status change
    req.body = { status: 'published' };
    await updateCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to publish course',
        details: error.message
      }
    });
  }
});

// Unpublish course
router.post('/courses/:id/unpublish', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Set course status to draft
    req.body = { status: 'draft' };
    await updateCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to unpublish course',
        details: error.message
      }
    });
  }
});

// Get instructor statistics/analytics (placeholder for now)
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // This would fetch instructor-specific statistics
    // For now, return mock data
    const stats = {
      totalCourses: 0,
      totalStudents: 0,
      totalRevenue: 0,
      averageRating: 0,
      coursesPublished: 0,
      coursesDraft: 0
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch instructor statistics',
        details: error.message
      }
    });
  }
});

export default router;