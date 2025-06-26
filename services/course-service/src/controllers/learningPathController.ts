import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import {
  LearningPath,
  LearningPathQueryParams,
  LearningPathListResponse,
  LearningPathDetailsResponse,
  CreateLearningPathRequest,
  UpdateLearningPathRequest,
  AddPathwayStepRequest,
  PathwayProgressResponse,
  LearningPathProgress,
  PathwayStep,
  CourseCategory,
  DifficultyLevel,
  CourseStatus,
} from '@cloudmastershub/types';

// Mock data for learning paths
const mockLearningPaths: LearningPath[] = [
  {
    id: 'aws-solutions-architect-path',
    title: 'AWS Solutions Architect Journey',
    description:
      'Complete learning path to become an AWS Solutions Architect. Master EC2, VPC, S3, RDS, and architectural best practices through hands-on projects.',
    shortDescription: 'Master AWS architecture with hands-on projects and real-world scenarios.',
    category: CourseCategory.AWS,
    level: DifficultyLevel.INTERMEDIATE,
    thumbnail: 'https://cloudmastershub.com/images/paths/aws-architect.jpg',
    instructorId: 'instructor-aws-jane',
    price: 199.99,
    originalPrice: 299.99,
    currency: 'USD',
    isFree: false,
    pathway: [],
    totalSteps: 8,
    totalCourses: 5,
    totalLabs: 6,
    estimatedDurationHours: 24,
    objectives: [
      'Design scalable AWS architectures',
      'Implement security best practices',
      'Optimize for cost and performance',
      'Pass AWS Solutions Architect certification',
    ],
    skills: ['AWS Architecture', 'Cloud Security', 'Cost Optimization', 'Infrastructure Design'],
    prerequisites: [
      'Basic understanding of cloud computing',
      'Familiarity with networking concepts',
    ],
    outcomes: [
      'AWS Certified Solutions Architect',
      'Real-world project portfolio',
      'Production-ready skills',
    ],
    rating: 4.8,
    reviewCount: 342,
    enrollmentCount: 2150,
    completionRate: 87.5,
    tags: ['aws', 'architecture', 'certification', 'cloud'],
    status: CourseStatus.PUBLISHED,
    isPublished: true,
    publishedAt: new Date('2024-01-15'),
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2024-12-20'),
    slug: 'aws-solutions-architect-journey',
    metaDescription:
      'Master AWS architecture with this comprehensive learning path. Hands-on labs, real projects, certification prep.',
    keywords: ['aws', 'solutions architect', 'cloud architecture', 'certification'],
    includesCertificate: true,
    hasHandsOnLabs: true,
    supportLevel: 'premium',
  },
  {
    id: 'azure-devops-engineer-path',
    title: 'Azure DevOps Engineer Professional',
    description:
      'Comprehensive path to master Azure DevOps, CI/CD pipelines, Infrastructure as Code, and modern deployment strategies.',
    shortDescription: 'Master Azure DevOps and modern deployment practices.',
    category: CourseCategory.AZURE,
    level: DifficultyLevel.ADVANCED,
    thumbnail: 'https://cloudmastershub.com/images/paths/azure-devops.jpg',
    instructorId: 'instructor-azure-mike',
    price: 249.99,
    originalPrice: 349.99,
    currency: 'USD',
    isFree: false,
    pathway: [],
    totalSteps: 10,
    totalCourses: 6,
    totalLabs: 8,
    estimatedDurationHours: 32,
    objectives: [
      'Build robust CI/CD pipelines',
      'Implement Infrastructure as Code',
      'Master Azure DevOps services',
      'Design deployment strategies',
    ],
    skills: ['Azure DevOps', 'CI/CD', 'Infrastructure as Code', 'Monitoring', 'Security'],
    prerequisites: [
      'Experience with Azure',
      'Understanding of DevOps principles',
      'Basic scripting knowledge',
    ],
    outcomes: [
      'Azure DevOps Expert certification',
      'Production pipeline portfolio',
      'Advanced deployment strategies',
    ],
    rating: 4.9,
    reviewCount: 189,
    enrollmentCount: 1340,
    completionRate: 92.1,
    tags: ['azure', 'devops', 'cicd', 'automation'],
    status: CourseStatus.PUBLISHED,
    isPublished: true,
    publishedAt: new Date('2024-02-10'),
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-12-18'),
    slug: 'azure-devops-engineer-professional',
    metaDescription:
      'Become an Azure DevOps expert with advanced CI/CD, IaC, and deployment strategies.',
    keywords: ['azure devops', 'cicd', 'infrastructure as code', 'deployment'],
    includesCertificate: true,
    hasHandsOnLabs: true,
    supportLevel: 'premium',
  },
  {
    id: 'multi-cloud-security-path',
    title: 'Multi-Cloud Security Specialist',
    description:
      'Learn security best practices across AWS, Azure, and GCP. Master identity management, network security, and compliance frameworks.',
    shortDescription: 'Master security across all major cloud platforms.',
    category: CourseCategory.SECURITY,
    level: DifficultyLevel.EXPERT,
    thumbnail: 'https://cloudmastershub.com/images/paths/multi-cloud-security.jpg',
    instructorId: 'instructor-security-sarah',
    price: 299.99,
    currency: 'USD',
    isFree: false,
    pathway: [],
    totalSteps: 12,
    totalCourses: 7,
    totalLabs: 10,
    estimatedDurationHours: 40,
    objectives: [
      'Implement multi-cloud security strategies',
      'Master identity and access management',
      'Design secure network architectures',
      'Ensure compliance across platforms',
    ],
    skills: [
      'Cloud Security',
      'Identity Management',
      'Compliance',
      'Threat Detection',
      'Incident Response',
    ],
    prerequisites: [
      'Experience with AWS, Azure, or GCP',
      'Understanding of security fundamentals',
      'Network security knowledge',
    ],
    outcomes: [
      'Multi-cloud security expertise',
      'Security architecture certification',
      'Incident response skills',
    ],
    rating: 4.7,
    reviewCount: 125,
    enrollmentCount: 890,
    completionRate: 78.4,
    tags: ['security', 'multi-cloud', 'compliance', 'identity'],
    status: CourseStatus.PUBLISHED,
    isPublished: true,
    publishedAt: new Date('2024-03-05'),
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-12-15'),
    slug: 'multi-cloud-security-specialist',
    metaDescription:
      'Master security across AWS, Azure, and GCP with hands-on labs and real-world scenarios.',
    keywords: ['multi-cloud security', 'cloud security', 'compliance', 'identity management'],
    includesCertificate: true,
    hasHandsOnLabs: true,
    supportLevel: 'premium',
  },
];

// Mock pathway steps
const mockPathwaySteps: { [pathId: string]: PathwayStep[] } = {
  'aws-solutions-architect-path': [
    {
      id: 'step-1',
      pathId: 'aws-solutions-architect-path',
      order: 1,
      type: 'course',
      title: 'AWS Fundamentals',
      description: 'Learn the basics of AWS services and cloud computing concepts',
      courseId: 'aws-fundamentals',
      isRequired: true,
      isLocked: false,
      estimatedTimeMinutes: 180,
      prerequisites: [],
      unlocks: ['step-2'],
      difficulty: DifficultyLevel.BEGINNER,
      skills: ['AWS Basics', 'Cloud Computing'],
      createdAt: new Date('2023-12-01'),
      updatedAt: new Date('2024-12-01'),
    },
    {
      id: 'step-2',
      pathId: 'aws-solutions-architect-path',
      order: 2,
      type: 'lab',
      title: 'Launch Your First EC2 Instance',
      description: 'Hands-on lab to create and configure EC2 instances',
      labId: 'aws-ec2-basics-lab',
      isRequired: true,
      isLocked: true,
      estimatedTimeMinutes: 90,
      prerequisites: ['step-1'],
      unlocks: ['step-3'],
      difficulty: DifficultyLevel.BEGINNER,
      skills: ['EC2', 'Instance Management'],
      createdAt: new Date('2023-12-01'),
      updatedAt: new Date('2024-12-01'),
    },
  ],
};

export const getAllLearningPaths = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      level,
      instructorId,
      minPrice,
      maxPrice,
      isFree,
      minRating,
      tags,
      search,
      sortBy = 'newest',
      sortOrder = 'desc',
    } = req.query as LearningPathQueryParams;

    logger.info('Fetching learning paths', {
      filters: { category, level, instructorId, isFree, search },
      pagination: { page, limit },
      sort: { sortBy, sortOrder },
    });

    // TODO: Implement MongoDB queries with filters
    let filteredPaths = [...mockLearningPaths];

    // Apply filters
    if (category) {
      filteredPaths = filteredPaths.filter((path) => path.category === category);
    }
    if (level) {
      filteredPaths = filteredPaths.filter((path) => path.level === level);
    }
    if (instructorId) {
      filteredPaths = filteredPaths.filter((path) => path.instructorId === instructorId);
    }
    if (isFree !== undefined) {
      const isFreeBoolean = String(isFree) === 'true';
      filteredPaths = filteredPaths.filter((path) => path.isFree === isFreeBoolean);
    }
    if (minPrice) {
      filteredPaths = filteredPaths.filter((path) => path.price >= Number(minPrice));
    }
    if (maxPrice) {
      filteredPaths = filteredPaths.filter((path) => path.price <= Number(maxPrice));
    }
    if (minRating) {
      filteredPaths = filteredPaths.filter((path) => path.rating >= Number(minRating));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPaths = filteredPaths.filter(
        (path) =>
          path.title.toLowerCase().includes(searchLower) ||
          path.description.toLowerCase().includes(searchLower) ||
          path.tags.some((tag: string) => tag.toLowerCase().includes(searchLower))
      );
    }
    if (tags) {
      const tagArray = tags.split(',');
      filteredPaths = filteredPaths.filter((path) =>
        tagArray.some((tag: string) => path.tags.includes(tag.trim()))
      );
    }

    // Apply sorting
    filteredPaths.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'newest':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'popular':
          comparison = b.enrollmentCount - a.enrollmentCount;
          break;
        case 'rating':
          comparison = b.rating - a.rating;
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'duration':
          comparison = a.estimatedDurationHours - b.estimatedDurationHours;
          break;
        default:
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    // Apply pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedPaths = filteredPaths.slice(startIndex, endIndex);

    const response: LearningPathListResponse = {
      paths: paginatedPaths,
      total: filteredPaths.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(filteredPaths.length / limitNum),
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error fetching learning paths:', error);
    next(error);
  }
};

export const getLearningPathById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Fetching learning path by ID', { pathId: id });

    // TODO: Implement MongoDB query
    const path = mockLearningPaths.find((p) => p.id === id);

    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
      });
      return;
    }

    // Mock additional data for detailed response
    const pathwaySteps = mockPathwaySteps[id] || [];
    const mockInstructor = {
      id: path.instructorId,
      name: 'Jane Smith',
      bio: 'AWS Solutions Architect with 10+ years of experience',
      avatar: 'https://cloudmastershub.com/images/instructors/jane.jpg',
      expertise: ['AWS', 'Cloud Architecture', 'Security'],
      rating: 4.9,
    };

    const response: LearningPathDetailsResponse = {
      ...path,
      pathway: pathwaySteps.map((step) => ({
        ...step,
        course: step.courseId
          ? {
              id: step.courseId,
              title: 'AWS Fundamentals',
              description: 'Learn the basics of AWS services',
              thumbnail: 'https://cloudmastershub.com/images/courses/aws-fundamentals.jpg',
              duration: 180,
            }
          : undefined,
        lab: step.labId
          ? {
              id: step.labId,
              title: 'EC2 Basics Lab',
              description: 'Hands-on EC2 instance management',
              provider: 'aws',
              estimatedTime: 90,
            }
          : undefined,
      })),
      prerequisites: [],
      recommendations: mockLearningPaths
        .filter((p) => p.id !== id && p.category === path.category)
        .slice(0, 3),
      reviews: [
        {
          id: 'review-1',
          pathId: id,
          userId: 'user-123',
          rating: 5,
          title: 'Excellent comprehensive path',
          content:
            'This learning path covers everything needed to become proficient in AWS architecture.',
          helpful: 23,
          verified: true,
          createdAt: new Date('2024-11-15'),
          updatedAt: new Date('2024-11-15'),
        },
      ],
      instructor: mockInstructor,
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error fetching learning path by ID:', error);
    next(error);
  }
};

export const createLearningPath = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pathData = req.body as CreateLearningPathRequest;
    const instructorId = (req as any).user?.userId; // From JWT middleware

    logger.info('Creating new learning path', { title: pathData.title, instructorId });

    // TODO: Validate instructor permissions
    // TODO: Generate slug from title
    // TODO: Save to MongoDB

    const newPath: LearningPath = {
      id: `path-${Date.now()}`,
      ...pathData,
      instructorId,
      pathway: [],
      totalSteps: 0,
      totalCourses: 0,
      totalLabs: 0,
      estimatedDurationHours: 0,
      rating: 0,
      reviewCount: 0,
      enrollmentCount: 0,
      completionRate: 0,
      status: CourseStatus.DRAFT,
      isPublished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      slug: pathData.title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
      isFree: pathData.price === 0,
      hasHandsOnLabs: false,
    };

    res.status(201).json({
      success: true,
      message: 'Learning path created successfully',
      data: newPath,
    });
  } catch (error) {
    logger.error('Error creating learning path:', error);
    next(error);
  }
};

export const updateLearningPath = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateLearningPathRequest;
    const userId = (req as any).user?.userId;

    logger.info('Updating learning path', { pathId: id, userId });

    // TODO: Verify ownership or admin permissions
    // TODO: Update in MongoDB

    const existingPath = mockLearningPaths.find((p) => p.id === id);
    if (!existingPath) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
      });
      return;
    }

    const updatedPath = {
      ...existingPath,
      ...updates,
      updatedAt: new Date(),
    };

    res.status(200).json({
      success: true,
      message: 'Learning path updated successfully',
      data: updatedPath,
    });
  } catch (error) {
    logger.error('Error updating learning path:', error);
    next(error);
  }
};

export const deleteLearningPath = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    logger.info('Deleting learning path', { pathId: id, userId });

    // TODO: Verify admin permissions only
    // TODO: Check if path has enrollments
    // TODO: Delete from MongoDB

    res.status(200).json({
      success: true,
      message: 'Learning path deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting learning path:', error);
    next(error);
  }
};

export const addPathwayStep = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const stepData = req.body as AddPathwayStepRequest;
    const userId = (req as any).user?.userId;

    logger.info('Adding pathway step', { pathId: id, stepType: stepData.type, userId });

    // TODO: Verify ownership
    // TODO: Validate course/lab IDs exist
    // TODO: Save to MongoDB

    const newStep: PathwayStep = {
      id: `step-${Date.now()}`,
      pathId: id,
      order: 999, // TODO: Calculate proper order
      ...stepData,
      isLocked: false,
      prerequisites: stepData.prerequisites || [],
      unlocks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    res.status(201).json({
      success: true,
      message: 'Pathway step added successfully',
      data: newStep,
    });
  } catch (error) {
    logger.error('Error adding pathway step:', error);
    next(error);
  }
};

export const removePathwayStep = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, stepId } = req.params;
    const userId = (req as any).user?.userId;

    logger.info('Removing pathway step', { pathId: id, stepId, userId });

    // TODO: Verify ownership
    // TODO: Check dependencies
    // TODO: Remove from MongoDB

    res.status(200).json({
      success: true,
      message: 'Pathway step removed successfully',
    });
  } catch (error) {
    logger.error('Error removing pathway step:', error);
    next(error);
  }
};

export const getLearningPathProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    logger.info('Fetching learning path progress', { pathId: id, userId });

    // TODO: Fetch from MongoDB

    // Mock progress data
    const mockProgress: LearningPathProgress = {
      id: 'progress-1',
      userId,
      pathId: id,
      enrolledAt: new Date('2024-11-01'),
      enrollmentType: 'purchased',
      progress: 45.5,
      currentStepId: 'step-2',
      completedSteps: ['step-1'],
      skippedSteps: [],
      totalTimeSpentMinutes: 320,
      lastAccessedAt: new Date(),
      isCompleted: false,
      strengths: ['AWS Basics'],
      weaknesses: ['Advanced Architecture'],
      recommendedNextPaths: ['azure-devops-engineer-path'],
      createdAt: new Date('2024-11-01'),
      updatedAt: new Date(),
    };

    const response: PathwayProgressResponse = {
      pathProgress: mockProgress,
      stepProgress: [
        {
          stepId: 'step-1',
          isCompleted: true,
          isLocked: false,
          timeSpent: 180,
          lastAccessed: new Date('2024-11-15'),
        },
        {
          stepId: 'step-2',
          isCompleted: false,
          isLocked: false,
          timeSpent: 45,
          lastAccessed: new Date(),
        },
      ],
      nextRecommendations: mockLearningPaths.slice(0, 3),
      achievements: [
        {
          type: 'badge',
          title: 'AWS Beginner',
          description: 'Completed first AWS course',
          iconUrl: 'https://cloudmastershub.com/badges/aws-beginner.png',
        },
      ],
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error fetching learning path progress:', error);
    next(error);
  }
};
