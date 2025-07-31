import { Request, Response } from 'express';
import { getInstructorStats } from '../instructorController';
import User from '../../models/User';
import { UserRole } from '../../models/User';

// Mock the User model
jest.mock('../../models/User');
const MockedUser = jest.mocked(User);

// Mock logger
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  }
}));

describe('InstructorController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnThis();

    mockRequest = {
      userId: 'instructor123',
      userRoles: [UserRole.INSTRUCTOR]
    };

    mockResponse = {
      json: responseJson,
      status: responseStatus
    };

    jest.clearAllMocks();
  });

  describe('getInstructorStats', () => {
    it('should return instructor statistics successfully', async () => {
      // Mock the aggregation pipeline result
      const mockAggregationResult = [{
        studentCount: 5,
        instructorCount: 2
      }];

      MockedUser.aggregate.mockResolvedValue(mockAggregationResult);

      await getInstructorStats(mockRequest as any, mockResponse as Response);

      expect(MockedUser.aggregate).toHaveBeenCalledWith([
        {
          $facet: {
            studentCount: [
              { $match: { roles: { $in: [UserRole.STUDENT] } } },
              { $count: 'count' }
            ],
            instructorCount: [
              { $match: { roles: { $in: [UserRole.INSTRUCTOR] } } },
              { $count: 'count' }
            ]
          }
        },
        {
          $project: {
            studentCount: { $ifNull: [{ $arrayElemAt: ['$studentCount.count', 0] }, 0] },
            instructorCount: { $ifNull: [{ $arrayElemAt: ['$instructorCount.count', 0] }, 0] }
          }
        }
      ]);

      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: {
          studentCount: 5,
          instructorCount: 2,
          courseCount: 0,
          totalEarnings: 0
        }
      });
    });

    it('should return zero counts when no users exist', async () => {
      // Mock empty aggregation result
      const mockAggregationResult = [{
        studentCount: 0,
        instructorCount: 0
      }];

      MockedUser.aggregate.mockResolvedValue(mockAggregationResult);

      await getInstructorStats(mockRequest as any, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: {
          studentCount: 0,
          instructorCount: 0,
          courseCount: 0,
          totalEarnings: 0
        }
      });
    });

    it('should return 401 when userId is not provided', async () => {
      mockRequest.userId = undefined;

      await getInstructorStats(mockRequest as any, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(401);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Instructor ID not found'
      });
    });

    it('should return 403 when user is not an instructor', async () => {
      mockRequest.userRoles = [UserRole.STUDENT];

      await getInstructorStats(mockRequest as any, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(403);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied. Instructor role required.'
      });
    });

    it('should handle database errors gracefully', async () => {
      MockedUser.aggregate.mockRejectedValue(new Error('Database connection failed'));

      await getInstructorStats(mockRequest as any, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
      expect(responseJson).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch instructor statistics'
      });
    });

    it('should handle empty aggregation result', async () => {
      MockedUser.aggregate.mockResolvedValue([]);

      await getInstructorStats(mockRequest as any, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith({
        success: true,
        data: {
          studentCount: 0,
          instructorCount: 0,
          courseCount: 0,
          totalEarnings: 0
        }
      });
    });
  });
});