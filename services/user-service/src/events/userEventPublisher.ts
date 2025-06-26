import { v4 as uuidv4 } from 'uuid';
import { UserEvent, EventPriority } from '@cloudmastershub/types';
import { getEventBus } from '@cloudmastershub/utils';
import logger from '../utils/logger';

export class UserEventPublisher {
  private eventBus = getEventBus();

  async publishUserCreated(userId: string, userData: {
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  }): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.created',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId
      },
      userId,
      data: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: userData.roles,
        status: 'active'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published user.created event', { userId, eventId: event.id });
  }

  async publishUserUpdated(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    email?: string;
    previousEmail?: string;
  }): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.updated',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        updatedFields: Object.keys(updates)
      },
      userId,
      data: updates
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published user.updated event', { userId, eventId: event.id, updates: Object.keys(updates) });
  }

  async publishProfileUpdated(userId: string, profileData: {
    firstName?: string;
    lastName?: string;
    bio?: string;
  }): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.profile.updated',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        profileFields: Object.keys(profileData)
      },
      userId,
      data: profileData
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published user.profile.updated event', { userId, eventId: event.id });
  }

  async publishEmailChanged(userId: string, newEmail: string, previousEmail: string): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.email.changed',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        securitySensitive: true
      },
      userId,
      data: {
        email: newEmail,
        previousEmail
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published user.email.changed event', { userId, eventId: event.id, newEmail });
  }

  async publishPasswordChanged(userId: string): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.password.changed',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        securitySensitive: true
      },
      userId,
      data: {
        passwordChangedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published user.password.changed event', { userId, eventId: event.id });
  }

  async publishRoleChanged(userId: string, newRoles: string[], previousRoles: string[]): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.role.changed',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        securitySensitive: true
      },
      userId,
      data: {
        roles: newRoles,
        previousRoles
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published user.role.changed event', { userId, eventId: event.id, newRoles, previousRoles });
  }

  async publishUserLogin(userId: string, loginData: {
    email: string;
    loginMethod: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.login',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        securityEvent: true
      },
      userId,
      data: loginData
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published user.login event', { userId, eventId: event.id, email: loginData.email });
  }

  async publishUserLogout(userId: string, logoutData: {
    email: string;
    sessionDuration?: number;
  }): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.logout',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        securityEvent: true
      },
      userId,
      data: logoutData
    };

    await this.eventBus.publish(event, { priority: EventPriority.LOW });
    logger.info('Published user.logout event', { userId, eventId: event.id });
  }

  async publishUserSuspended(userId: string, reason: string, suspendedBy: string): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.suspended',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        adminAction: true,
        suspendedBy
      },
      userId,
      data: {
        status: 'suspended',
        previousStatus: 'active',
        reason,
        suspendedBy,
        suspendedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.warn('Published user.suspended event', { userId, eventId: event.id, reason, suspendedBy });
  }

  async publishUserActivated(userId: string, activatedBy: string): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.activated',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        adminAction: true,
        activatedBy
      },
      userId,
      data: {
        status: 'active',
        previousStatus: 'suspended',
        activatedBy,
        activatedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published user.activated event', { userId, eventId: event.id, activatedBy });
  }

  async publishUserDeleted(userId: string, deletedBy: string, reason?: string): Promise<void> {
    const event: UserEvent = {
      id: uuidv4(),
      type: 'user.deleted',
      version: '1.0',
      timestamp: new Date(),
      source: 'user-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'user-service',
        userId,
        adminAction: true,
        deletedBy
      },
      userId,
      data: {
        status: 'deleted',
        previousStatus: 'active',
        deletedBy,
        deletedAt: new Date().toISOString(),
        reason
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.warn('Published user.deleted event', { userId, eventId: event.id, deletedBy, reason });
  }
}

// Singleton instance
let userEventPublisher: UserEventPublisher | null = null;

export const getUserEventPublisher = (): UserEventPublisher => {
  if (!userEventPublisher) {
    userEventPublisher = new UserEventPublisher();
  }
  return userEventPublisher;
};