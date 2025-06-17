import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Course schema (simplified for seeding)
const courseSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  subcategory: String,
  difficulty: String,
  duration_minutes: Number,
  prerequisites: [String],
  learning_objectives: [String],
  thumbnail_url: String,
  video_url: String,
  instructor: {
    name: String,
    bio: String,
    avatar_url: String
  },
  price: {
    amount: Number,
    currency: String
  },
  is_published: Boolean,
  is_free: Boolean,
  tags: [String],
  rating: {
    average: Number,
    count: Number
  },
  enrollment_count: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const lessonSchema = new mongoose.Schema({
  course_id: mongoose.Schema.Types.ObjectId,
  title: String,
  description: String,
  order: Number,
  type: String,
  duration_minutes: Number,
  content: {
    video_url: String,
    transcript: String,
    slides_url: String,
    notes: String,
    resources: [{
      title: String,
      url: String,
      type: String
    }]
  },
  is_preview: Boolean,
  is_published: Boolean,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Course = mongoose.model('Course', courseSchema);
const Lesson = mongoose.model('Lesson', lessonSchema);

const seedCourses = [
  {
    title: 'AWS Fundamentals for Beginners',
    description: 'Learn the basics of Amazon Web Services (AWS) including EC2, S3, RDS, and more. Perfect for beginners starting their cloud journey.',
    category: 'aws',
    subcategory: 'fundamentals',
    difficulty: 'beginner',
    duration_minutes: 480,
    prerequisites: ['Basic computer skills', 'Understanding of web concepts'],
    learning_objectives: [
      'Understand AWS core services',
      'Deploy your first EC2 instance',
      'Create and manage S3 buckets',
      'Set up basic networking with VPC'
    ],
    thumbnail_url: 'https://example.com/thumbnails/aws-fundamentals.jpg',
    video_url: 'https://example.com/videos/aws-fundamentals-intro.mp4',
    instructor: {
      name: 'Sarah Johnson',
      bio: 'AWS Solutions Architect with 8+ years of cloud experience',
      avatar_url: 'https://example.com/avatars/sarah-johnson.jpg'
    },
    price: {
      amount: 0,
      currency: 'USD'
    },
    is_published: true,
    is_free: true,
    tags: ['aws', 'cloud', 'beginner', 'fundamentals', 'ec2', 's3'],
    rating: {
      average: 4.7,
      count: 1234
    },
    enrollment_count: 5678
  },
  {
    title: 'Azure DevOps Complete Guide',
    description: 'Master Azure DevOps from basics to advanced concepts. Learn CI/CD, Azure Repos, Boards, and Test Plans.',
    category: 'azure',
    subcategory: 'devops',
    difficulty: 'intermediate',
    duration_minutes: 720,
    prerequisites: ['Basic Azure knowledge', 'Understanding of development lifecycle'],
    learning_objectives: [
      'Set up Azure DevOps projects',
      'Create CI/CD pipelines',
      'Manage code with Azure Repos',
      'Track work with Azure Boards'
    ],
    thumbnail_url: 'https://example.com/thumbnails/azure-devops.jpg',
    video_url: 'https://example.com/videos/azure-devops-intro.mp4',
    instructor: {
      name: 'Michael Chen',
      bio: 'Microsoft MVP and Azure DevOps expert with 10+ years experience',
      avatar_url: 'https://example.com/avatars/michael-chen.jpg'
    },
    price: {
      amount: 99.99,
      currency: 'USD'
    },
    is_published: true,
    is_free: false,
    tags: ['azure', 'devops', 'ci-cd', 'intermediate', 'pipelines'],
    rating: {
      average: 4.5,
      count: 892
    },
    enrollment_count: 2341
  },
  {
    title: 'Google Cloud Security Best Practices',
    description: 'Comprehensive guide to securing your Google Cloud Platform (GCP) infrastructure. Learn IAM, VPC security, and compliance.',
    category: 'gcp',
    subcategory: 'security',
    difficulty: 'advanced',
    duration_minutes: 600,
    prerequisites: ['GCP fundamentals', 'Basic security concepts', 'Networking knowledge'],
    learning_objectives: [
      'Implement IAM best practices',
      'Secure VPC networks',
      'Set up security monitoring',
      'Achieve compliance requirements'
    ],
    thumbnail_url: 'https://example.com/thumbnails/gcp-security.jpg',
    video_url: 'https://example.com/videos/gcp-security-intro.mp4',
    instructor: {
      name: 'Dr. Emily Rodriguez',
      bio: 'Cybersecurity expert and Google Cloud certified professional',
      avatar_url: 'https://example.com/avatars/emily-rodriguez.jpg'
    },
    price: {
      amount: 149.99,
      currency: 'USD'
    },
    is_published: true,
    is_free: false,
    tags: ['gcp', 'security', 'advanced', 'iam', 'compliance'],
    rating: {
      average: 4.9,
      count: 456
    },
    enrollment_count: 1789
  },
  {
    title: 'Multi-Cloud Architecture Patterns',
    description: 'Learn how to design and implement applications across multiple cloud providers. Explore hybrid cloud strategies.',
    category: 'architecture',
    subcategory: 'multi-cloud',
    difficulty: 'expert',
    duration_minutes: 900,
    prerequisites: ['AWS experience', 'Azure experience', 'GCP experience', 'Architecture patterns'],
    learning_objectives: [
      'Design multi-cloud architectures',
      'Implement cross-cloud networking',
      'Manage multi-cloud deployments',
      'Optimize costs across providers'
    ],
    thumbnail_url: 'https://example.com/thumbnails/multi-cloud.jpg',
    video_url: 'https://example.com/videos/multi-cloud-intro.mp4',
    instructor: {
      name: 'David Thompson',
      bio: 'Principal Cloud Architect with certifications in AWS, Azure, and GCP',
      avatar_url: 'https://example.com/avatars/david-thompson.jpg'
    },
    price: {
      amount: 199.99,
      currency: 'USD'
    },
    is_published: true,
    is_free: false,
    tags: ['multi-cloud', 'architecture', 'expert', 'aws', 'azure', 'gcp'],
    rating: {
      average: 4.8,
      count: 234
    },
    enrollment_count: 567
  }
];

async function createLessonsForCourse(courseId: any, courseTitle: string, lessonCount: number) {
  const lessons = [];
  
  for (let i = 1; i <= lessonCount; i++) {
    lessons.push({
      course_id: courseId,
      title: `${courseTitle} - Lesson ${i}`,
      description: `This is lesson ${i} of the ${courseTitle} course.`,
      order: i,
      type: i === 1 ? 'video' : (i % 3 === 0 ? 'quiz' : 'video'),
      duration_minutes: Math.floor(Math.random() * 30) + 15, // 15-45 minutes
      content: {
        video_url: `https://example.com/videos/course-${courseId}-lesson-${i}.mp4`,
        transcript: `Transcript for lesson ${i}...`,
        slides_url: `https://example.com/slides/course-${courseId}-lesson-${i}.pdf`,
        notes: `Study notes for lesson ${i}...`,
        resources: [
          {
            title: `Additional Resource ${i}`,
            url: `https://example.com/resources/lesson-${i}.pdf`,
            type: 'pdf'
          }
        ]
      },
      is_preview: i === 1, // First lesson is always preview
      is_published: true
    });
  }
  
  return await Lesson.insertMany(lessons);
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting course database seeding...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub_courses';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');
    
    // Check if courses already exist
    const existingCourses = await Course.countDocuments();
    
    if (existingCourses > 0) {
      console.log(`ℹ️  Database already has ${existingCourses} courses. Skipping seed.`);
      console.log('   To re-seed, drop the collections first.');
      return;
    }
    
    console.log('📚 Creating seed courses...');
    
    const createdCourses = await Course.insertMany(seedCourses);
    console.log(`✅ Created ${createdCourses.length} courses`);
    
    console.log('📝 Creating lessons for each course...');
    
    let totalLessons = 0;
    for (const course of createdCourses) {
      const lessonCount = Math.floor(Math.random() * 8) + 5; // 5-12 lessons per course
      const lessons = await createLessonsForCourse(course._id, course.title, lessonCount);
      totalLessons += lessons.length;
      console.log(`✅ Created ${lessons.length} lessons for: ${course.title}`);
    }
    
    // Create some sample user sessions
    console.log('📊 Creating sample user sessions...');
    
    const UserSession = mongoose.model('UserSession', new mongoose.Schema({
      user_id: String,
      course_id: mongoose.Schema.Types.ObjectId,
      lesson_id: mongoose.Schema.Types.ObjectId,
      session_type: String,
      session_data: mongoose.Schema.Types.Mixed,
      duration_seconds: Number,
      ip_address: String,
      user_agent: String,
      createdAt: { type: Date, default: Date.now }
    }));
    
    const sampleSessions = [];
    const sampleUserIds = ['user1', 'user2', 'user3', 'user4'];
    
    for (const course of createdCourses.slice(0, 2)) { // Just for first 2 courses
      const lessons = await Lesson.find({ course_id: course._id }).limit(3);
      
      for (const userId of sampleUserIds.slice(0, 2)) {
        sampleSessions.push({
          user_id: userId,
          course_id: course._id,
          session_type: 'course_view',
          session_data: { source: 'web' },
          duration_seconds: 45,
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random within last week
        });
        
        for (const lesson of lessons) {
          sampleSessions.push({
            user_id: userId,
            course_id: course._id,
            lesson_id: lesson._id,
            session_type: 'lesson_start',
            session_data: { lesson_title: lesson.title },
            duration_seconds: Math.floor(Math.random() * 1800) + 300, // 5-35 minutes
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
          });
        }
      }
    }
    
    await UserSession.insertMany(sampleSessions);
    console.log(`✅ Created ${sampleSessions.length} sample user sessions`);
    
    // Display summary
    const finalCounts = {
      courses: await Course.countDocuments(),
      lessons: await Lesson.countDocuments(),
      sessions: await UserSession.countDocuments()
    };
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   📚 Courses: ${finalCounts.courses}`);
    console.log(`   📝 Lessons: ${finalCounts.lessons}`);
    console.log(`   📊 User sessions: ${finalCounts.sessions}`);
    console.log('\n📚 Sample courses created:');
    for (const course of createdCourses) {
      console.log(`   📖 ${course.title} (${course.category}/${course.difficulty})`);
    }
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Run the seeding
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default seedDatabase;