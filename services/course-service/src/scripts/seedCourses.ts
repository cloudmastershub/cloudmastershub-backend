import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Course } from '../models/Course';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub';

// Sample courses data
const sampleCourses = [
  {
    title: 'AWS Cloud Practitioner Essentials',
    slug: 'aws-cloud-practitioner-essentials',
    description: 'Comprehensive introduction to AWS cloud services and best practices for beginners',
    level: 'beginner',
    category: 'AWS',
    cloudProvider: ['aws'],
    duration: 30,
    price: 0,
    isFree: true,
    thumbnail: 'https://api.cloudmastershub.com/images/courses/aws-practitioner.svg',
    objectives: [
      'Understand AWS cloud concepts and global infrastructure',
      'Learn core AWS services and their use cases',
      'Master AWS security and compliance principles',
      'Understand AWS pricing and support models'
    ],
    prerequisites: ['Basic IT knowledge', 'Understanding of web technologies'],
    tags: ['aws', 'cloud', 'certification', 'beginner'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'Introduction to AWS',
        description: 'Overview of cloud computing and AWS',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'What is Cloud Computing?',
            description: 'Understanding cloud computing concepts',
            duration: 30,
            videoUrl: 'https://example.com/video1',
            resources: []
          },
          {
            lessonId: 'lesson-1-2',
            title: 'AWS Global Infrastructure',
            description: 'Regions, Availability Zones, and Edge Locations',
            duration: 45,
            videoUrl: 'https://example.com/video2',
            resources: []
          }
        ]
      },
      {
        moduleId: 'module-2',
        title: 'Core AWS Services',
        description: 'Essential AWS services overview',
        lessons: [
          {
            lessonId: 'lesson-2-1',
            title: 'Amazon EC2',
            description: 'Elastic Compute Cloud fundamentals',
            duration: 60,
            videoUrl: 'https://example.com/video3',
            resources: []
          },
          {
            lessonId: 'lesson-2-2',
            title: 'Amazon S3',
            description: 'Simple Storage Service essentials',
            duration: 45,
            videoUrl: 'https://example.com/video4',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'instructor-1',
      name: 'John Smith',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@cloudmastershub.com',
      bio: 'AWS Certified Solutions Architect with 10+ years of experience',
      avatar: 'https://cloudmastershub.com/images/john-smith.jpg',
      expertise: ['AWS', 'Cloud Architecture', 'DevOps']
    },
    totalStudents: 5432,
    averageRating: 4.8,
    totalReviews: 1243,
    lastUpdated: new Date('2024-06-15'),
    status: 'published'
  },
  {
    title: 'Azure Fundamentals AZ-900',
    slug: 'azure-fundamentals-az-900',
    description: 'Complete preparation course for Microsoft Azure Fundamentals certification',
    level: 'beginner',
    category: 'Azure',
    cloudProvider: ['azure'],
    duration: 25,
    price: 49.99,
    isFree: false,
    thumbnail: 'https://cloudmastershub.com/images/azure-fundamentals.jpg',
    objectives: [
      'Understand Azure cloud concepts',
      'Master Azure core services',
      'Learn Azure security and compliance',
      'Understand Azure pricing and support'
    ],
    prerequisites: ['Basic understanding of IT concepts'],
    tags: ['azure', 'microsoft', 'certification', 'beginner'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'Cloud Concepts',
        description: 'Introduction to cloud computing and Azure',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'Benefits of Cloud Services',
            description: 'Understanding cloud advantages',
            duration: 30,
            videoUrl: 'https://example.com/azure-video1',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'instructor-2',
      name: 'Sarah Johnson',
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@cloudmastershub.com',
      bio: 'Microsoft Certified Azure Solutions Expert',
      avatar: 'https://cloudmastershub.com/images/sarah-johnson.jpg',
      expertise: ['Azure', 'Cloud Security', 'Enterprise Architecture']
    },
    totalStudents: 3210,
    averageRating: 4.7,
    totalReviews: 876,
    lastUpdated: new Date('2024-07-01'),
    status: 'published'
  },
  {
    title: 'Kubernetes Mastery: From Zero to Hero',
    slug: 'kubernetes-mastery-zero-to-hero',
    description: 'Complete Kubernetes course covering basics to advanced orchestration techniques',
    level: 'intermediate',
    category: 'DevOps',
    cloudProvider: ['multi-cloud'],
    duration: 40,
    price: 79.99,
    isFree: false,
    thumbnail: 'https://cloudmastershub.com/images/kubernetes-mastery.jpg',
    objectives: [
      'Master Kubernetes architecture and components',
      'Deploy and manage containerized applications',
      'Implement Kubernetes security best practices',
      'Scale and monitor Kubernetes clusters'
    ],
    prerequisites: ['Docker knowledge', 'Linux command line', 'Basic networking'],
    tags: ['kubernetes', 'devops', 'containers', 'orchestration'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'Kubernetes Fundamentals',
        description: 'Core concepts and architecture',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'Kubernetes Architecture',
            description: 'Understanding Kubernetes components',
            duration: 45,
            videoUrl: 'https://example.com/k8s-video1',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'instructor-3',
      name: 'Mike Chen',
      firstName: 'Mike',
      lastName: 'Chen',
      email: 'mike.chen@cloudmastershub.com',
      bio: 'CKA & CKAD certified Kubernetes expert',
      avatar: 'https://cloudmastershub.com/images/mike-chen.jpg',
      expertise: ['Kubernetes', 'Docker', 'CI/CD', 'Cloud Native']
    },
    totalStudents: 2890,
    averageRating: 4.9,
    totalReviews: 654,
    lastUpdated: new Date('2024-07-15'),
    status: 'published'
  },
  {
    title: 'Google Cloud Platform Essentials',
    slug: 'gcp-essentials',
    description: 'Introduction to Google Cloud Platform services and solutions',
    level: 'beginner',
    category: 'GCP',
    cloudProvider: ['gcp'],
    duration: 20,
    price: 0,
    isFree: true,
    thumbnail: 'https://cloudmastershub.com/images/gcp-essentials.jpg',
    objectives: [
      'Understand GCP core services',
      'Learn GCP compute and storage options',
      'Master GCP networking concepts',
      'Implement GCP best practices'
    ],
    prerequisites: ['Basic cloud computing knowledge'],
    tags: ['gcp', 'google', 'cloud', 'beginner'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'GCP Overview',
        description: 'Introduction to Google Cloud Platform',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'GCP Services Overview',
            description: 'Understanding GCP service categories',
            duration: 30,
            videoUrl: 'https://example.com/gcp-video1',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'instructor-4',
      name: 'Lisa Wang',
      firstName: 'Lisa',
      lastName: 'Wang',
      email: 'lisa.wang@cloudmastershub.com',
      bio: 'Google Cloud Professional Architect',
      avatar: 'https://cloudmastershub.com/images/lisa-wang.jpg',
      expertise: ['GCP', 'Big Data', 'Machine Learning']
    },
    totalStudents: 1567,
    averageRating: 4.6,
    totalReviews: 432,
    lastUpdated: new Date('2024-06-30'),
    status: 'published'
  },
  {
    title: 'DevOps Pipeline Automation',
    slug: 'devops-pipeline-automation',
    description: 'Build and automate CI/CD pipelines with modern DevOps tools',
    level: 'advanced',
    category: 'DevOps',
    cloudProvider: ['multi-cloud'],
    duration: 35,
    price: 89.99,
    isFree: false,
    thumbnail: 'https://cloudmastershub.com/images/devops-pipeline.jpg',
    objectives: [
      'Design CI/CD pipelines',
      'Implement Infrastructure as Code',
      'Automate testing and deployment',
      'Monitor and optimize pipelines'
    ],
    prerequisites: ['Git knowledge', 'Basic scripting', 'Cloud platform experience'],
    tags: ['devops', 'cicd', 'automation', 'jenkins', 'gitlab'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'CI/CD Fundamentals',
        description: 'Understanding continuous integration and delivery',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'Introduction to CI/CD',
            description: 'CI/CD concepts and benefits',
            duration: 40,
            videoUrl: 'https://example.com/cicd-video1',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'instructor-5',
      name: 'David Brown',
      firstName: 'David',
      lastName: 'Brown',
      email: 'david.brown@cloudmastershub.com',
      bio: 'DevOps consultant with 15+ years experience',
      avatar: 'https://cloudmastershub.com/images/david-brown.jpg',
      expertise: ['DevOps', 'Automation', 'Cloud Architecture']
    },
    totalStudents: 2134,
    averageRating: 4.8,
    totalReviews: 567,
    lastUpdated: new Date('2024-07-20'),
    status: 'published'
  }
];

// No sample learning paths - CloudMastersHub operates on real data only
// Learning paths should be created through the admin interface with real content

async function seedDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await Course.deleteMany({ slug: { $in: sampleCourses.map(c => c.slug) } });
    // No learning paths to seed - real data only

    // Insert courses
    console.log('📚 Seeding courses...');
    const insertedCourses = await Course.insertMany(sampleCourses);
    console.log(`✅ Inserted ${insertedCourses.length} courses`);

    console.log('🎉 Database seeding completed successfully!');
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`- Courses: ${insertedCourses.length}`);
    console.log(`- Learning Paths: 0 (Real data only - create through admin interface)`);
    
    insertedCourses.forEach(course => {
      console.log(`  📘 ${course.title} (${course.level}) - ${course.isFree ? 'FREE' : '$' + course.price}`);
    });

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed script
seedDatabase();