import { Router } from 'express';
import { body } from 'express-validator';
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
  getEventAttendees,
  markAttendance,
  submitFeedback,
  getUserEvents
} from '../controllers/eventController';
import { authenticate } from '@cloudmastershub/middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Public routes
router.get('/', getEvents);
router.get('/:id', getEventById);

// Protected routes
router.use(authenticate);

router.get('/user/my-events', getUserEvents);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('eventType').optional().isIn(['webinar', 'workshop', 'study_session', 'meetup', 'ama', 'hackathon', 'other']),
    body('coverImage').optional().isString(),
    body('coHosts').optional().isArray(),
    body('groupId').optional().isMongoId(),
    body('startTime').notEmpty().isISO8601().withMessage('Valid start time is required'),
    body('endTime').notEmpty().isISO8601().withMessage('Valid end time is required'),
    body('timezone').optional().isString(),
    body('location').optional().isString(),
    body('meetingUrl').optional().isURL(),
    body('maxAttendees').optional().isInt({ min: 1 }),
    body('isOnline').optional().isBoolean(),
    body('isFree').optional().isBoolean(),
    body('price').optional().isFloat({ min: 0 }),
    body('tags').optional().isArray(),
    body('courseId').optional().isString()
  ],
  validateRequest,
  createEvent
);

router.put(
  '/:id',
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('eventType').optional().isIn(['webinar', 'workshop', 'study_session', 'meetup', 'ama', 'hackathon', 'other']),
    body('status').optional().isIn(['draft', 'published', 'cancelled', 'completed']),
    body('coverImage').optional().isString(),
    body('coHosts').optional().isArray(),
    body('startTime').optional().isISO8601(),
    body('endTime').optional().isISO8601(),
    body('timezone').optional().isString(),
    body('location').optional().isString(),
    body('meetingUrl').optional().isURL(),
    body('maxAttendees').optional().isInt({ min: 1 }),
    body('isOnline').optional().isBoolean(),
    body('isFree').optional().isBoolean(),
    body('price').optional().isFloat({ min: 0 }),
    body('tags').optional().isArray(),
    body('recordingUrl').optional().isURL()
  ],
  validateRequest,
  updateEvent
);

router.delete('/:id', deleteEvent);

router.post('/:id/register', registerForEvent);
router.delete('/:id/register', unregisterFromEvent);

router.get('/:id/attendees', getEventAttendees);

router.post(
  '/:id/attendees/:registrationId/attendance',
  [
    body('attended').isBoolean().withMessage('Attendance status is required')
  ],
  validateRequest,
  markAttendance
);

router.post(
  '/:id/feedback',
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isString()
  ],
  validateRequest,
  submitFeedback
);

export default router;
