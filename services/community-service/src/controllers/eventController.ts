import { Response, NextFunction } from 'express';
import { AuthRequest } from '@cloudmastershub/middleware';
import { Event, EventRegistration, Group, GroupMember } from '../models';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export const getEvents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const eventType = req.query.eventType as string;
    const status = req.query.status as string;
    const upcoming = req.query.upcoming === 'true';
    const past = req.query.past === 'true';
    const tag = req.query.tag as string;

    let query: any = { status: { $ne: 'draft' } };

    if (eventType) {
      query.eventType = eventType;
    }
    if (status) {
      query.status = status;
    }
    if (tag) {
      query.tags = tag;
    }
    if (upcoming) {
      query.startTime = { $gte: new Date() };
      query.status = 'published';
    }
    if (past) {
      query.endTime = { $lt: new Date() };
    }

    const [events, total] = await Promise.all([
      Event.find(query)
        .sort({ startTime: upcoming ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching events:', error);
    next(error);
  }
};

export const getEventById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.status === 'draft' && event.hostId !== userId) {
      throw new NotFoundError('Event not found');
    }

    let registration = null;
    if (userId) {
      registration = await EventRegistration.findOne({
        eventId: id,
        userId,
        status: { $in: ['registered', 'attended'] }
      });
    }

    res.json({
      success: true,
      data: {
        ...event.toJSON(),
        isRegistered: !!registration,
        registration
      }
    });
  } catch (error) {
    logger.error('Error fetching event:', error);
    next(error);
  }
};

export const createEvent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      title,
      description,
      eventType,
      coverImage,
      coHosts,
      groupId,
      startTime,
      endTime,
      timezone,
      location,
      meetingUrl,
      maxAttendees,
      isOnline,
      isFree,
      price,
      tags,
      courseId
    } = req.body;

    if (!title || !description || !startTime || !endTime) {
      throw new BadRequestError('Title, description, start time, and end time are required');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      throw new BadRequestError('End time must be after start time');
    }

    if (start < new Date()) {
      throw new BadRequestError('Start time must be in the future');
    }

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group || !group.isActive) {
        throw new NotFoundError('Group not found');
      }

      const membership = await GroupMember.findOne({
        groupId,
        userId,
        status: 'active',
        role: { $in: ['admin', 'owner', 'moderator'] }
      });

      if (!membership && group.ownerId !== userId) {
        throw new ForbiddenError('Only group admins can create group events');
      }
    }

    const slug = `${generateSlug(title)}-${Date.now().toString(36)}`;

    const event = new Event({
      title,
      slug,
      description,
      eventType: eventType || 'webinar',
      status: 'draft',
      coverImage,
      hostId: userId,
      hostName: req.user?.email?.split('@')[0] || 'User',
      coHosts: coHosts || [],
      groupId,
      startTime: start,
      endTime: end,
      timezone: timezone || 'UTC',
      location,
      meetingUrl,
      maxAttendees,
      isOnline: isOnline !== false,
      isFree: isFree !== false,
      price,
      tags: tags || [],
      courseId
    });

    await event.save();

    logger.info(`Event created: ${event.title} by ${userId}`);

    res.status(201).json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Error creating event:', error);
    next(error);
  }
};

export const updateEvent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const isHost = event.hostId === userId;
    const isCoHost = event.coHosts.some(h => h.userId === userId);

    if (!isHost && !isCoHost) {
      throw new ForbiddenError('Only hosts can update events');
    }

    const {
      title,
      description,
      eventType,
      status,
      coverImage,
      coHosts,
      startTime,
      endTime,
      timezone,
      location,
      meetingUrl,
      maxAttendees,
      isOnline,
      isFree,
      price,
      tags,
      recordingUrl
    } = req.body;

    if (title !== undefined) {
      event.title = title;
      event.slug = `${generateSlug(title)}-${Date.now().toString(36)}`;
    }
    if (description !== undefined) event.description = description;
    if (eventType !== undefined) event.eventType = eventType;
    if (status !== undefined) event.status = status;
    if (coverImage !== undefined) event.coverImage = coverImage;
    if (coHosts !== undefined) event.coHosts = coHosts;
    if (startTime !== undefined) event.startTime = new Date(startTime);
    if (endTime !== undefined) event.endTime = new Date(endTime);
    if (timezone !== undefined) event.timezone = timezone;
    if (location !== undefined) event.location = location;
    if (meetingUrl !== undefined) event.meetingUrl = meetingUrl;
    if (maxAttendees !== undefined) event.maxAttendees = maxAttendees;
    if (isOnline !== undefined) event.isOnline = isOnline;
    if (isFree !== undefined) event.isFree = isFree;
    if (price !== undefined) event.price = price;
    if (tags !== undefined) event.tags = tags;
    if (recordingUrl !== undefined) event.recordingUrl = recordingUrl;

    await event.save();

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Error updating event:', error);
    next(error);
  }
};

export const deleteEvent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const userRoles = req.userRoles || [];

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const isAdmin = userRoles.includes('admin');
    if (event.hostId !== userId && !isAdmin) {
      throw new ForbiddenError('Only the host can delete this event');
    }

    event.status = 'cancelled';
    await event.save();

    res.json({
      success: true,
      message: 'Event cancelled successfully'
    });
  } catch (error) {
    logger.error('Error deleting event:', error);
    next(error);
  }
};

export const registerForEvent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const userEmail = req.userEmail || req.user?.email || '';

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.status !== 'published') {
      throw new BadRequestError('Registration is not open for this event');
    }

    if (event.startTime < new Date()) {
      throw new BadRequestError('This event has already started');
    }

    if (event.maxAttendees && event.registrationCount >= event.maxAttendees) {
      throw new BadRequestError('This event is full');
    }

    const existingRegistration = await EventRegistration.findOne({
      eventId: id,
      userId
    });

    if (existingRegistration) {
      if (existingRegistration.status === 'registered') {
        throw new ConflictError('You are already registered for this event');
      }
      if (existingRegistration.status === 'cancelled') {
        existingRegistration.status = 'registered';
        existingRegistration.registeredAt = new Date();
        existingRegistration.cancelledAt = undefined;
        await existingRegistration.save();

        await Event.findByIdAndUpdate(id, { $inc: { registrationCount: 1 } });

        res.json({
          success: true,
          data: existingRegistration,
          message: 'Successfully re-registered for event'
        });
        return;
      }
    }

    const registration = new EventRegistration({
      eventId: id,
      userId,
      userName: req.user?.email?.split('@')[0] || 'User',
      userEmail,
      status: 'registered'
    });

    await registration.save();

    await Event.findByIdAndUpdate(id, { $inc: { registrationCount: 1 } });

    logger.info(`User ${userId} registered for event ${id}`);

    res.status(201).json({
      success: true,
      data: registration
    });
  } catch (error) {
    logger.error('Error registering for event:', error);
    next(error);
  }
};

export const unregisterFromEvent = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const registration = await EventRegistration.findOne({
      eventId: id,
      userId,
      status: 'registered'
    });

    if (!registration) {
      throw new NotFoundError('You are not registered for this event');
    }

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    await registration.save();

    await Event.findByIdAndUpdate(id, { $inc: { registrationCount: -1 } });

    res.json({
      success: true,
      message: 'Successfully unregistered from event'
    });
  } catch (error) {
    logger.error('Error unregistering from event:', error);
    next(error);
  }
};

export const getEventAttendees = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const status = (req.query.status as string) || 'registered';

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const isHost = event.hostId === userId;
    const isCoHost = event.coHosts.some(h => h.userId === userId);

    if (!isHost && !isCoHost) {
      throw new ForbiddenError('Only hosts can view attendees');
    }

    const [registrations, total] = await Promise.all([
      EventRegistration.find({ eventId: id, status })
        .sort({ registeredAt: 1 })
        .skip(skip)
        .limit(limit),
      EventRegistration.countDocuments({ eventId: id, status })
    ]);

    res.json({
      success: true,
      data: {
        attendees: registrations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching event attendees:', error);
    next(error);
  }
};

export const markAttendance = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, registrationId } = req.params;
    const userId = req.userId!;
    const { attended } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const isHost = event.hostId === userId;
    const isCoHost = event.coHosts.some(h => h.userId === userId);

    if (!isHost && !isCoHost) {
      throw new ForbiddenError('Only hosts can mark attendance');
    }

    const registration = await EventRegistration.findById(registrationId);
    if (!registration || registration.eventId.toString() !== id) {
      throw new NotFoundError('Registration not found');
    }

    if (attended) {
      registration.status = 'attended';
      registration.attendedAt = new Date();
      await Event.findByIdAndUpdate(id, { $inc: { attendeeCount: 1 } });
    } else {
      if (registration.status === 'attended') {
        await Event.findByIdAndUpdate(id, { $inc: { attendeeCount: -1 } });
      }
      registration.status = 'no_show';
    }

    await registration.save();

    res.json({
      success: true,
      data: registration
    });
  } catch (error) {
    logger.error('Error marking attendance:', error);
    next(error);
  }
};

export const submitFeedback = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }

    const event = await Event.findById(id);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.endTime > new Date()) {
      throw new BadRequestError('You can only submit feedback after the event ends');
    }

    const registration = await EventRegistration.findOne({
      eventId: id,
      userId,
      status: { $in: ['registered', 'attended'] }
    });

    if (!registration) {
      throw new ForbiddenError('You must be registered for this event to submit feedback');
    }

    registration.feedback = {
      rating,
      comment,
      submittedAt: new Date()
    };

    await registration.save();

    res.json({
      success: true,
      data: registration
    });
  } catch (error) {
    logger.error('Error submitting feedback:', error);
    next(error);
  }
};

export const getUserEvents = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const type = req.query.type as string;

    if (type === 'hosting') {
      const [events, total] = await Promise.all([
        Event.find({
          $or: [
            { hostId: userId },
            { 'coHosts.userId': userId }
          ]
        })
          .sort({ startTime: -1 })
          .skip(skip)
          .limit(limit),
        Event.countDocuments({
          $or: [
            { hostId: userId },
            { 'coHosts.userId': userId }
          ]
        })
      ]);

      res.json({
        success: true,
        data: {
          events,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } else {
      const [registrations, total] = await Promise.all([
        EventRegistration.find({
          userId,
          status: { $in: ['registered', 'attended'] }
        })
          .sort({ registeredAt: -1 })
          .skip(skip)
          .limit(limit),
        EventRegistration.countDocuments({
          userId,
          status: { $in: ['registered', 'attended'] }
        })
      ]);

      const eventIds = registrations.map(r => r.eventId);
      const events = await Event.find({ _id: { $in: eventIds } });

      const eventsWithRegistration = events.map(event => {
        const registration = registrations.find(
          r => r.eventId.toString() === event._id.toString()
        );
        return {
          ...event.toJSON(),
          registration
        };
      });

      res.json({
        success: true,
        data: {
          events: eventsWithRegistration,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    }
  } catch (error) {
    logger.error('Error fetching user events:', error);
    next(error);
  }
};
