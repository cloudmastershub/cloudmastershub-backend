import logger from '../utils/logger';

interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: any;
}

class PathServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
  }

  async getAllPaths(params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    level?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<ServiceResponse> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      logger.info('Fetching learning paths from course service', { 
        url: `${this.baseUrl}/paths?${queryParams}`,
        params 
      });

      const response = await fetch(`${this.baseUrl}/paths?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Course service returned error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        return {
          success: false,
          error: `Course service error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      logger.info('Successfully fetched learning paths', { count: data.data?.length || 0 });
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch learning paths from course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async getPathById(pathId: string): Promise<ServiceResponse> {
    try {
      logger.info('Fetching learning path by ID from course service', { pathId });

      const response = await fetch(`${this.baseUrl}/paths/${pathId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Course service returned error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          pathId 
        });
        return {
          success: false,
          error: `Course service error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      logger.info('Successfully fetched learning path', { pathId });
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to fetch learning path by ID from course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async createPath(pathData: any): Promise<ServiceResponse> {
    try {
      logger.info('Creating learning path in course service', { 
        title: pathData.title,
        category: pathData.category 
      });

      const response = await fetch(`${this.baseUrl}/paths`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pathData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Course service returned error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        return {
          success: false,
          error: `Course service error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      logger.info('Successfully created learning path', { pathId: data.data?.id });
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to create learning path in course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async updatePath(pathId: string, updates: any): Promise<ServiceResponse> {
    try {
      logger.info('Updating learning path in course service', { pathId });

      const response = await fetch(`${this.baseUrl}/paths/${pathId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Course service returned error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          pathId 
        });
        return {
          success: false,
          error: `Course service error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      logger.info('Successfully updated learning path', { pathId });
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to update learning path in course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async deletePath(pathId: string): Promise<ServiceResponse> {
    try {
      logger.info('Deleting learning path in course service', { pathId });

      const response = await fetch(`${this.baseUrl}/paths/${pathId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Course service returned error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          pathId 
        });
        return {
          success: false,
          error: `Course service error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      logger.info('Successfully deleted learning path', { pathId });
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to delete learning path in course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async addCourseToPath(
    pathId: string,
    courseData: {
      courseId: string;
      order?: number;
      isRequired?: boolean;
      estimatedTimeMinutes?: number;
    }
  ): Promise<ServiceResponse> {
    try {
      logger.info('Adding course to learning path in course service', { pathId, courseId: courseData.courseId });

      const response = await fetch(`${this.baseUrl}/paths/${pathId}/steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'course',
          courseId: courseData.courseId,
          order: courseData.order,
          isRequired: courseData.isRequired,
          estimatedTimeMinutes: courseData.estimatedTimeMinutes,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Course service returned error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          pathId,
          courseId: courseData.courseId 
        });
        return {
          success: false,
          error: `Course service error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      logger.info('Successfully added course to learning path', { pathId, courseId: courseData.courseId });
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to add course to learning path in course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async removeCourseFromPath(pathId: string, courseId: string): Promise<ServiceResponse> {
    try {
      logger.info('Removing course from learning path in course service', { pathId, courseId });

      // First get the path to find the step ID
      const pathResult = await this.getPathById(pathId);
      if (!pathResult.success || !pathResult.data) {
        return {
          success: false,
          error: 'Learning path not found',
        };
      }

      const step = pathResult.data.pathwaySteps?.find((s: any) => s.courseId === courseId);
      if (!step) {
        return {
          success: false,
          error: 'Course not found in learning path',
        };
      }

      const response = await fetch(`${this.baseUrl}/paths/${pathId}/steps/${step.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Course service returned error:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText,
          pathId,
          courseId 
        });
        return {
          success: false,
          error: `Course service error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      logger.info('Successfully removed course from learning path', { pathId, courseId });
      return data as ServiceResponse;
    } catch (error) {
      logger.error('Failed to remove course from learning path in course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async reorderPathSteps(pathId: string, orderedSteps: string[]): Promise<ServiceResponse> {
    try {
      logger.info('Reordering learning path steps in course service', { pathId, stepCount: orderedSteps.length });

      // This would need to be implemented in the course service
      // For now, we'll return a placeholder
      return {
        success: true,
        data: { message: 'Reorder functionality not yet implemented in course service' },
      };
    } catch (error) {
      logger.error('Failed to reorder learning path steps in course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }

  async getPathAnalytics(timeframe: string): Promise<ServiceResponse> {
    try {
      logger.info('Fetching path analytics from course service', { timeframe });

      // This would need to be implemented in the course service
      // For now, we'll return placeholder data
      const analyticsData = {
        totalPaths: 0,
        publishedPaths: 0,
        enrolledStudents: 0,
        completedPaths: 0,
        averageCompletionRate: 0,
        popularCategories: [],
      };

      return {
        success: true,
        data: analyticsData,
      };
    } catch (error) {
      logger.error('Failed to fetch path analytics from course service:', error);
      return {
        success: false,
        error: 'Failed to communicate with course service',
      };
    }
  }
}

export default new PathServiceClient();