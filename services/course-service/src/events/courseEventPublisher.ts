import { v4 as uuidv4 } from 'uuid';
import { CourseEvent, LearningPathEvent, EventPriority } from '@cloudmastershub/types';
import { getEventBus } from '@cloudmastershub/utils';
import logger from '../utils/logger';

export class CourseEventPublisher {
  private eventBus = getEventBus();

  // Course Management Events
  async publishCourseCreated(courseId: string, courseData: {
    title: string;
    description: string;
    instructorId: string;
    category: string;
    difficulty: string;
    duration?: number;
    price?: number;
  }): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.created',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        instructorId: courseData.instructorId
      },
      courseId,
      instructorId: courseData.instructorId,
      data: {
        title: courseData.title,
        description: courseData.description,
        category: courseData.category,
        difficulty: courseData.difficulty,
        duration: courseData.duration,
        price: courseData.price,
        status: 'draft'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published course.created event', { courseId, eventId: event.id, instructorId: courseData.instructorId });
  }

  async publishCourseUpdated(courseId: string, updates: {
    title?: string;
    description?: string;
    category?: string;
    difficulty?: string;
    duration?: number;
    price?: number;
    status?: string;
    previousStatus?: string;
  }, instructorId?: string): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.updated',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        instructorId,
        updatedFields: Object.keys(updates)
      },
      courseId,
      instructorId,
      data: updates
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published course.updated event', { courseId, eventId: event.id, updates: Object.keys(updates) });
  }

  async publishCourseDeleted(courseId: string, instructorId: string, reason?: string): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.deleted',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        instructorId,
        adminAction: true
      },
      courseId,
      instructorId,
      data: {
        deletedAt: new Date().toISOString(),
        reason
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.warn('Published course.deleted event', { courseId, eventId: event.id, instructorId, reason });
  }

  async publishCoursePublished(courseId: string, instructorId: string): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.published',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        instructorId,
        contentModeration: true
      },
      courseId,
      instructorId,
      data: {
        status: 'published',
        previousStatus: 'draft',
        publishedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published course.published event', { courseId, eventId: event.id, instructorId });
  }

  async publishCourseUnpublished(courseId: string, instructorId: string, reason?: string): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.unpublished',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        instructorId,
        adminAction: true
      },
      courseId,
      instructorId,
      data: {
        status: 'unpublished',
        previousStatus: 'published',
        unpublishedAt: new Date().toISOString(),
        reason
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.warn('Published course.unpublished event', { courseId, eventId: event.id, instructorId, reason });
  }

  // Course Enrollment Events
  async publishCourseEnrolled(courseId: string, userId: string, enrollmentType: 'subscription' | 'purchase' | 'free'): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.enrolled',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        userId,
        enrollmentType
      },
      courseId,
      userId,
      data: {
        enrollmentType,
        enrolledAt: new Date().toISOString(),
        progress: 0
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published course.enrolled event', { courseId, userId, eventId: event.id, enrollmentType });
  }

  async publishCourseUnenrolled(courseId: string, userId: string, reason?: string): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.unenrolled',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        userId
      },
      courseId,
      userId,
      data: {
        unenrolledAt: new Date().toISOString(),
        reason
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published course.unenrolled event', { courseId, userId, eventId: event.id, reason });
  }

  // Course Progress Events
  async publishCourseProgressUpdated(courseId: string, userId: string, progress: number, lessonId?: string): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.progress.updated',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        userId,
        lessonId
      },
      courseId,
      userId,
      data: {
        progress,
        lessonId,
        progressUpdatedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.LOW });
    logger.debug('Published course.progress.updated event', { courseId, userId, progress, eventId: event.id });
  }

  async publishCourseCompleted(courseId: string, userId: string, completionData: {
    finalScore?: number;
    completionTime?: number;
    certificateEligible?: boolean;
  }): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.completed',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        userId,
        certificateEligible: completionData.certificateEligible
      },
      courseId,
      userId,
      data: {
        progress: 100,
        completedAt: new Date().toISOString(),
        finalScore: completionData.finalScore,
        completionTime: completionData.completionTime,
        certificateEligible: completionData.certificateEligible
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published course.completed event', { courseId, userId, eventId: event.id, ...completionData });
  }

  async publishCourseCertificateIssued(courseId: string, userId: string, certificateId: string): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.certificate.issued',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        userId,
        certificateId
      },
      courseId,
      userId,
      data: {
        certificateId,
        issuedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published course.certificate.issued event', { courseId, userId, certificateId, eventId: event.id });
  }

  // Course Review Events
  async publishCourseReviewed(courseId: string, userId: string, reviewData: {
    rating: number;
    review?: string;
    reviewId: string;
  }): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.reviewed',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        userId,
        reviewId: reviewData.reviewId
      },
      courseId,
      userId,
      data: {
        rating: reviewData.rating,
        review: reviewData.review,
        reviewedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.LOW });
    logger.info('Published course.reviewed event', { courseId, userId, rating: reviewData.rating, eventId: event.id });
  }

  async publishCourseRatingAdded(courseId: string, userId: string, rating: number): Promise<void> {
    const event: CourseEvent = {
      id: uuidv4(),
      type: 'course.rating.added',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        courseId,
        userId
      },
      courseId,
      userId,
      data: {
        rating,
        ratedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.LOW });
    logger.info('Published course.rating.added event', { courseId, userId, rating, eventId: event.id });
  }

  // Learning Path Events
  async publishLearningPathCreated(pathId: string, pathData: {
    title: string;
    description: string;
    instructorId: string;
    totalSteps: number;
  }): Promise<void> {
    const event: LearningPathEvent = {
      id: uuidv4(),
      type: 'path.created',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        pathId,
        instructorId: pathData.instructorId
      },
      pathId,
      instructorId: pathData.instructorId,
      data: {
        title: pathData.title,
        description: pathData.description,
        totalSteps: pathData.totalSteps,
        status: 'draft'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published path.created event', { pathId, eventId: event.id, instructorId: pathData.instructorId });
  }

  async publishLearningPathUpdated(pathId: string, updates: {
    title?: string;
    description?: string;
    totalSteps?: number;
    status?: string;
    previousStatus?: string;
  }, instructorId?: string): Promise<void> {
    const event: LearningPathEvent = {
      id: uuidv4(),
      type: 'path.updated',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        pathId,
        instructorId,
        updatedFields: Object.keys(updates)
      },
      pathId,
      instructorId,
      data: updates
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published path.updated event', { pathId, eventId: event.id, updates: Object.keys(updates) });
  }

  async publishLearningPathEnrolled(pathId: string, userId: string, enrollmentType: 'subscription' | 'purchase' | 'free'): Promise<void> {
    const event: LearningPathEvent = {
      id: uuidv4(),
      type: 'path.enrolled',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        pathId,
        userId,
        enrollmentType
      },
      pathId,
      userId,
      data: {
        enrollmentType,
        enrolledAt: new Date().toISOString(),
        progress: 0,
        completedSteps: 0
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published path.enrolled event', { pathId, userId, eventId: event.id, enrollmentType });
  }

  async publishLearningPathStepCompleted(pathId: string, userId: string, stepData: {
    stepId: string;
    stepType: 'course' | 'assessment' | 'project';
    completedSteps: number;
    totalSteps: number;
    progress: number;
  }): Promise<void> {
    const event: LearningPathEvent = {
      id: uuidv4(),
      type: 'path.step.completed',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        pathId,
        userId,
        stepId: stepData.stepId
      },
      pathId,
      userId,
      stepId: stepData.stepId,
      data: {
        stepType: stepData.stepType,
        completedSteps: stepData.completedSteps,
        totalSteps: stepData.totalSteps,
        progress: stepData.progress,
        stepCompletedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published path.step.completed event', { 
      pathId, userId, stepId: stepData.stepId, eventId: event.id, progress: stepData.progress 
    });
  }

  async publishLearningPathCompleted(pathId: string, userId: string, completionData: {
    totalSteps: number;
    completionTime?: number;
    certificateEligible?: boolean;
  }): Promise<void> {
    const event: LearningPathEvent = {
      id: uuidv4(),
      type: 'path.completed',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        pathId,
        userId,
        certificateEligible: completionData.certificateEligible
      },
      pathId,
      userId,
      data: {
        progress: 100,
        completedSteps: completionData.totalSteps,
        totalSteps: completionData.totalSteps,
        completedAt: new Date().toISOString(),
        completionTime: completionData.completionTime,
        certificateEligible: completionData.certificateEligible
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published path.completed event', { pathId, userId, eventId: event.id, ...completionData });
  }

  async publishLearningPathCertificateIssued(pathId: string, userId: string, certificateId: string): Promise<void> {
    const event: LearningPathEvent = {
      id: uuidv4(),
      type: 'path.certificate.issued',
      version: '1.0',
      timestamp: new Date(),
      source: 'course-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'course-service',
        pathId,
        userId,
        certificateId
      },
      pathId,
      userId,
      data: {
        certificateId,
        issuedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published path.certificate.issued event', { pathId, userId, certificateId, eventId: event.id });
  }
}

// Singleton instance
let courseEventPublisher: CourseEventPublisher | null = null;

export const getCourseEventPublisher = (): CourseEventPublisher => {
  if (!courseEventPublisher) {
    courseEventPublisher = new CourseEventPublisher();
  }
  return courseEventPublisher;
};