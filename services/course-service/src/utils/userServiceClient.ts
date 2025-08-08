/**
 * User Service Client for Course Service
 * Handles communication with the user service to fetch user profile data
 */

import axios from 'axios';
import logger from './logger';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  roles: string[];
  subscriptionTier: string;
}

class UserServiceClient {
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = process.env.USER_SERVICE_URL || 'http://user-service.cloudmastershub-dev.svc.cluster.local:3001';
    this.timeout = 5000; // 5 seconds timeout
  }

  /**
   * Fetch user profile by email (userId)
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      logger.debug('Fetching user profile from user service', { userId, baseURL: this.baseURL });
      
      const response = await axios.get(
        `${this.baseURL}/api/users/profile/${encodeURIComponent(userId)}`,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.data?.success && response.data?.data) {
        const user = response.data.data;
        logger.debug('Successfully retrieved user profile', { 
          userId, 
          firstName: user.firstName,
          lastName: user.lastName 
        });
        
        return {
          id: user.id || userId,
          email: user.email || userId,
          firstName: user.firstName || this.extractFirstNameFromEmail(userId),
          lastName: user.lastName || this.extractLastNameFromEmail(userId),
          avatar: user.avatar,
          roles: user.roles || ['student'],
          subscriptionTier: user.subscriptionTier || 'free'
        };
      }

      logger.warn('User profile not found in user service response', { userId, response: response.data });
      return null;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.warn('User service unavailable, using fallback user data extraction', { 
          userId, 
          error: error.message 
        });
      } else {
        logger.error('Error fetching user profile from user service', { 
          userId, 
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
      }
      
      // Return fallback user data extracted from email
      return this.createFallbackUserProfile(userId);
    }
  }

  /**
   * Fetch multiple user profiles in batch
   */
  async getUserProfiles(userIds: string[]): Promise<Record<string, UserProfile>> {
    const profiles: Record<string, UserProfile> = {};
    
    // Process in chunks to avoid overwhelming the user service
    const chunkSize = 10;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      
      const chunkProfiles = await Promise.allSettled(
        chunk.map(userId => this.getUserProfile(userId))
      );
      
      chunk.forEach((userId, index) => {
        const result = chunkProfiles[index];
        if (result.status === 'fulfilled' && result.value) {
          profiles[userId] = result.value;
        } else {
          // Use fallback for failed requests
          profiles[userId] = this.createFallbackUserProfile(userId);
        }
      });
      
      // Add small delay between chunks to be respectful to user service
      if (i + chunkSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logger.info('Retrieved user profiles in batch', { 
      totalRequested: userIds.length,
      successfullyRetrieved: Object.keys(profiles).length
    });
    
    return profiles;
  }

  /**
   * Create fallback user profile from email when user service is unavailable
   */
  private createFallbackUserProfile(userId: string): UserProfile {
    return {
      id: userId,
      email: userId,
      firstName: this.extractFirstNameFromEmail(userId),
      lastName: this.extractLastNameFromEmail(userId),
      roles: ['student'],
      subscriptionTier: 'free'
    };
  }

  /**
   * Extract first name from email for fallback scenarios
   * Examples:
   * - "mbuaku@gmail.com" -> "Mbuaku"
   * - "john.doe@example.com" -> "John"
   * - "student1@gmail.com" -> "Student1"
   */
  private extractFirstNameFromEmail(email: string): string {
    try {
      const localPart = email.split('@')[0];
      const cleanName = localPart
        .replace(/[._-]/g, ' ')
        .split(' ')[0];
      
      // Capitalize first letter
      return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
    } catch (error) {
      return 'Student';
    }
  }

  /**
   * Extract last name from email for fallback scenarios
   */
  private extractLastNameFromEmail(email: string): string {
    try {
      const localPart = email.split('@')[0];
      const nameParts = localPart.replace(/[._-]/g, ' ').split(' ');
      
      if (nameParts.length > 1) {
        const lastName = nameParts[nameParts.length - 1];
        return lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
      }
      
      // If no clear last name, use domain
      const domain = email.split('@')[1]?.split('.')[0];
      return domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : '';
    } catch (error) {
      return '';
    }
  }
}

export const userServiceClient = new UserServiceClient();
export type { UserProfile };