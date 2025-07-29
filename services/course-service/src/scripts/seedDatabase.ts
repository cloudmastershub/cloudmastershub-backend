import DatabaseConnection from '../database/connection';
import { Course, LearningPath } from '../models';
import { CourseCategory, DifficultyLevel, CourseStatus } from '@cloudmastershub/types';
import { generateSlug } from '@cloudmastershub/utils';
import logger from '../utils/logger';

const sampleCourses = [
  {
    title: 'AWS Fundamentals',
    slug: generateSlug('AWS Fundamentals'),
    description: 'Learn the basics of Amazon Web Services cloud computing platform',
    category: CourseCategory.AWS,
    level: DifficultyLevel.BEGINNER,
    duration: 300,
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    instructor: {
      id: 'instructor-1',
      name: 'Jane Smith',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150',
      bio: 'AWS Solutions Architect with 10+ years experience',
      expertise: ['AWS', 'Cloud Architecture', 'DevOps'],
      rating: 4.8
    },
    price: 49.99,
    rating: 4.8,
    enrollmentCount: 1250,
    tags: ['aws', 'cloud', 'fundamentals', 'beginner'],
    requirements: ['Basic computer knowledge', 'Internet connection'],
    objectives: [
      'Understand cloud computing concepts',
      'Navigate AWS Management Console',
      'Deploy applications on AWS',
      'Configure basic AWS services'
    ],
    curriculum: [
      {
        id: 'section-1',
        title: 'Introduction to Cloud Computing',
        description: 'Understanding the basics of cloud computing',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            sectionId: 'section-1',
            title: 'What is Cloud Computing?',
            description: 'Introduction to cloud computing concepts and benefits',
            videoUrl: 'https://www.youtube.com/embed/dH0yz-Osy54',
            duration: 15,
            order: 1,
            resources: [
              {
                id: 'resource-1',
                type: 'pdf',
                title: 'Cloud Computing Overview',
                url: 'https://example.com/cloud-overview.pdf'
              }
            ]
          },
          {
            id: 'lesson-1-2',
            sectionId: 'section-1',
            title: 'AWS Overview',
            description: 'Introduction to Amazon Web Services',
            videoUrl: 'https://www.youtube.com/embed/a9__D53WsUs',
            duration: 20,
            order: 2,
            resources: []
          }
        ]
      },
      {
        id: 'section-2',
        title: 'Core AWS Services',
        description: 'Essential AWS services every developer should know',
        order: 2,
        lessons: [
          {
            id: 'lesson-2-1',
            sectionId: 'section-2',
            title: 'EC2 Basics',
            description: 'Understanding Elastic Compute Cloud',
            videoUrl: 'https://www.youtube.com/embed/TsRBftzZsQo',
            duration: 30,
            order: 1,
            resources: [
              {
                id: 'resource-2',
                type: 'link',
                title: 'EC2 Documentation',
                url: 'https://docs.aws.amazon.com/ec2/'
              }
            ]
          },
          {
            id: 'lesson-2-2',
            sectionId: 'section-2',
            title: 'S3 Storage',
            description: 'Simple Storage Service fundamentals',
            videoUrl: 'https://www.youtube.com/embed/77lMCiiMilo',
            duration: 25,
            order: 2,
            resources: []
          }
        ]
      }
    ],
    status: CourseStatus.PUBLISHED
  },
  {
    title: 'Azure DevOps Mastery',
    slug: generateSlug('Azure DevOps Mastery'),
    description: 'Master CI/CD pipelines and DevOps practices with Microsoft Azure',
    category: CourseCategory.AZURE,
    level: DifficultyLevel.INTERMEDIATE,
    duration: 480,
    thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    instructor: {
      id: 'instructor-2',
      name: 'John Doe',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      bio: 'Microsoft MVP and DevOps evangelist',
      expertise: ['Azure', 'DevOps', 'CI/CD', 'Kubernetes'],
      rating: 4.6
    },
    price: 79.99,
    rating: 4.6,
    enrollmentCount: 850,
    tags: ['azure', 'devops', 'cicd', 'intermediate'],
    requirements: ['Basic understanding of software development', 'Git knowledge'],
    objectives: [
      'Set up Azure DevOps pipelines',
      'Implement CI/CD best practices',
      'Deploy applications to Azure',
      'Monitor and troubleshoot deployments'
    ],
    curriculum: [
      {
        id: 'section-1',
        title: 'Azure DevOps Introduction',
        description: 'Getting started with Azure DevOps',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            sectionId: 'section-1',
            title: 'Azure DevOps Overview',
            description: 'Understanding Azure DevOps services',
            videoUrl: 'https://www.youtube.com/embed/JhqpF-5E10I',
            duration: 20,
            order: 1,
            resources: []
          }
        ]
      }
    ],
    status: CourseStatus.PUBLISHED
  },
  {
    title: 'Google Cloud Platform Security',
    slug: generateSlug('Google Cloud Platform Security'),
    description: 'Comprehensive security practices for Google Cloud Platform',
    category: CourseCategory.GCP,
    level: DifficultyLevel.ADVANCED,
    duration: 600,
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
    instructor: {
      id: 'instructor-3',
      name: 'Sarah Wilson',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      bio: 'Google Cloud Security Specialist and CISSP',
      expertise: ['GCP', 'Cloud Security', 'Identity Management', 'Compliance'],
      rating: 4.9
    },
    price: 99.99,
    rating: 4.9,
    enrollmentCount: 420,
    tags: ['gcp', 'security', 'advanced', 'compliance'],
    requirements: ['GCP fundamentals', 'Security basics', 'Networking knowledge'],
    objectives: [
      'Implement GCP security best practices',
      'Configure IAM and access controls',
      'Set up monitoring and alerting',
      'Ensure compliance requirements'
    ],
    curriculum: [
      {
        id: 'section-1',
        title: 'GCP Security Fundamentals',
        description: 'Core security concepts in Google Cloud',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            sectionId: 'section-1',
            title: 'Security Model Overview',
            description: 'Understanding GCP shared responsibility model',
            videoUrl: 'https://www.youtube.com/embed/hRykDK620Po',
            duration: 25,
            order: 1,
            resources: []
          }
        ]
      }
    ],
    status: CourseStatus.PUBLISHED
  },
  {
    title: 'Multi-Cloud Architecture Patterns',
    slug: generateSlug('Multi-Cloud Architecture Patterns'),
    description: 'Design and implement applications across multiple cloud providers',
    category: CourseCategory.MULTICLOUD,
    level: DifficultyLevel.EXPERT,
    duration: 720,
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    instructor: {
      id: 'instructor-4',
      name: 'Michael Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      bio: 'Cloud architect with expertise across AWS, Azure, and GCP',
      expertise: ['Multi-Cloud', 'Architecture', 'Kubernetes', 'Terraform'],
      rating: 4.7
    },
    price: 149.99,
    rating: 4.7,
    enrollmentCount: 180,
    tags: ['multicloud', 'architecture', 'expert', 'kubernetes'],
    requirements: ['Experience with at least one cloud provider', 'Docker knowledge', 'Kubernetes basics'],
    objectives: [
      'Design multi-cloud architectures',
      'Implement cross-cloud networking',
      'Manage multi-cloud deployments',
      'Optimize costs across providers'
    ],
    curriculum: [
      {
        id: 'section-1',
        title: 'Multi-Cloud Strategy',
        description: 'Planning your multi-cloud approach',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            sectionId: 'section-1',
            title: 'Why Multi-Cloud?',
            description: 'Benefits and challenges of multi-cloud adoption',
            videoUrl: 'https://www.youtube.com/embed/wJZOopq4mK0',
            duration: 30,
            order: 1,
            resources: []
          }
        ]
      }
    ],
    status: CourseStatus.PUBLISHED
  },
  {
    title: 'Kubernetes for Beginners',
    slug: generateSlug('Kubernetes for Beginners'),
    description: 'Learn container orchestration with Kubernetes from scratch',
    category: CourseCategory.DEVOPS,
    level: DifficultyLevel.BEGINNER,
    duration: 400,
    thumbnail: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800',
    instructor: {
      id: 'instructor-5',
      name: 'Alex Rodriguez',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      bio: 'DevOps engineer and Kubernetes trainer',
      expertise: ['Kubernetes', 'Docker', 'DevOps', 'Microservices'],
      rating: 4.5
    },
    price: 59.99,
    rating: 4.5,
    enrollmentCount: 980,
    tags: ['kubernetes', 'devops', 'containers', 'beginner'],
    requirements: ['Docker basics', 'Command line familiarity'],
    objectives: [
      'Understand Kubernetes architecture',
      'Deploy applications to Kubernetes',
      'Manage pods, services, and deployments',
      'Troubleshoot common issues'
    ],
    curriculum: [
      {
        id: 'section-1',
        title: 'Kubernetes Fundamentals',
        description: 'Core Kubernetes concepts',
        order: 1,
        lessons: [
          {
            id: 'lesson-1-1',
            sectionId: 'section-1',
            title: 'What is Kubernetes?',
            description: 'Introduction to container orchestration',
            videoUrl: 'https://www.youtube.com/embed/VnvRFRk_51k',
            duration: 20,
            order: 1,
            resources: []
          }
        ]
      }
    ],
    status: CourseStatus.PUBLISHED
  }
];

const sampleLearningPaths = [
  {
    title: 'AWS Solutions Architect Journey',
    description: 'Complete learning path to become an AWS Solutions Architect',
    shortDescription: 'Master AWS architecture and prepare for certification',
    category: CourseCategory.AWS,
    level: DifficultyLevel.INTERMEDIATE,
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    instructorId: 'instructor-1',
    price: 199.99,
    originalPrice: 299.99,
    currency: 'USD',
    isFree: false,
    objectives: [
      'Design resilient AWS architectures',
      'Pass AWS Solutions Architect certification',
      'Implement security best practices',
      'Optimize costs and performance'
    ],
    skills: ['AWS', 'Cloud Architecture', 'Security', 'Cost Optimization'],
    prerequisites: ['Basic IT knowledge', 'Networking fundamentals'],
    outcomes: ['AWS Certified Solutions Architect', 'Production-ready skills'],
    rating: 4.8,
    reviewCount: 125,
    enrollmentCount: 450,
    completionRate: 78,
    tags: ['aws', 'architecture', 'certification', 'solutions-architect'],
    status: CourseStatus.PUBLISHED,
    isPublished: true,
    includesCertificate: true,
    hasHandsOnLabs: true,
    supportLevel: 'premium' as const,
    pathway: [
      {
        id: 'step-1',
        pathId: '', // Will be set after creation
        order: 1,
        type: 'course' as const,
        title: 'AWS Fundamentals',
        description: 'Start with AWS basics',
        courseId: '', // Will be set after course creation
        isRequired: true,
        isLocked: false,
        estimatedTimeMinutes: 300,
        prerequisites: [],
        unlocks: ['step-2'],
        difficulty: DifficultyLevel.BEGINNER,
        skills: ['AWS Basics', 'Cloud Computing'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  }
];

export async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Connect to database
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.connect();

    // Clear existing data
    await Course.deleteMany({});
    await LearningPath.deleteMany({});
    logger.info('Cleared existing data');

    // Insert sample courses
    const createdCourses = await Course.insertMany(sampleCourses);
    logger.info(`Created ${createdCourses.length} sample courses`);

    // Update learning path with actual course ID
    if (createdCourses.length > 0) {
      sampleLearningPaths[0].pathway[0].courseId = createdCourses[0]._id.toString();
    }

    // Insert sample learning paths
    const createdPaths = await LearningPath.insertMany(sampleLearningPaths);
    logger.info(`Created ${createdPaths.length} sample learning paths`);

    // Update pathway pathId references
    for (const path of createdPaths) {
      path.pathway.forEach(step => {
        step.pathId = path._id.toString();
      });
      await path.save();
    }

    logger.info('Database seeding completed successfully');
    
    // Log summary
    logger.info('Seeding Summary:', {
      courses: createdCourses.length,
      learningPaths: createdPaths.length,
      totalDocuments: createdCourses.length + createdPaths.length
    });

    return {
      courses: createdCourses,
      learningPaths: createdPaths
    };
  } catch (error) {
    logger.error('Error seeding database:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding completed, exiting...');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed:', error);
      process.exit(1);
    });
}