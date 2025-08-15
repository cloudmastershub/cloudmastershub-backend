const mongoose = require('mongoose');

// Course Schema
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  category: { type: String, required: true },
  cloudProvider: [String],
  duration: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  isFree: { type: Boolean, default: true },
  thumbnail: String,
  objectives: [String],
  prerequisites: [String],
  tags: [String],
  curriculum: [{
    moduleId: String,
    title: String,
    description: String,
    lessons: [{
      lessonId: String,
      title: String,
      description: String,
      duration: Number,
      videoUrl: String,
      resources: [String]
    }]
  }],
  instructor: {
    id: String,
    name: String,
    firstName: String,
    lastName: String,
    email: String,
    bio: String,
    avatar: String,
    expertise: [String]
  },
  totalStudents: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const Course = mongoose.model('Course', courseSchema);

// Sample course data for production seeding
const sampleCourses = [
  {
    title: 'Cloud Computing Fundamentals',
    slug: 'cloud-computing-fundamentals',
    description: 'Master the essential concepts of cloud computing across AWS, Azure, and Google Cloud Platform',
    level: 'beginner',
    category: 'Multi-Cloud',
    cloudProvider: ['aws', 'azure', 'gcp'],
    duration: 25,
    price: 0,
    isFree: true,
    thumbnail: '/images/course-placeholder.svg',
    objectives: [
      'Understand cloud computing concepts and deployment models',
      'Compare AWS, Azure, and GCP core services',
      'Learn cloud security and compliance basics',
      'Master cost optimization strategies'
    ],
    prerequisites: ['Basic IT knowledge'],
    tags: ['cloud', 'aws', 'azure', 'gcp', 'fundamentals'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'Introduction to Cloud Computing',
        description: 'Core cloud concepts and service models',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'What is Cloud Computing?',
            description: 'Understanding cloud computing fundamentals',
            duration: 30,
            videoUrl: 'https://example.com/video1',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'mbuaku@gmail.com',
      name: 'CloudMaster Admin',
      firstName: 'CloudMaster',
      lastName: 'Admin',
      email: 'mbuaku@gmail.com',
      bio: 'Expert cloud architect and instructor',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      expertise: ['AWS', 'Azure', 'GCP', 'Multi-Cloud']
    },
    totalStudents: 1250,
    averageRating: 4.7,
    totalReviews: 89,
    status: 'published'
  },
  {
    title: 'AWS Solutions Architect Associate',
    slug: 'aws-solutions-architect-associate',
    description: 'Complete preparation course for AWS Solutions Architect Associate certification',
    level: 'intermediate',
    category: 'AWS',
    cloudProvider: ['aws'],
    duration: 40,
    price: 99.99,
    isFree: false,
    thumbnail: '/images/course-placeholder.svg',
    objectives: [
      'Design resilient architectures on AWS',
      'Define performant architectures',
      'Specify secure applications and architectures',
      'Design cost-optimized architectures'
    ],
    prerequisites: ['AWS Cloud Practitioner knowledge', 'Basic networking concepts'],
    tags: ['aws', 'certification', 'solutions-architect', 'intermediate'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'AWS Core Services',
        description: 'Essential AWS services for architects',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'EC2 Deep Dive',
            description: 'Comprehensive EC2 overview',
            duration: 45,
            videoUrl: 'https://example.com/aws-video1',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'mbuaku@gmail.com',
      name: 'CloudMaster Admin',
      firstName: 'CloudMaster',
      lastName: 'Admin',
      email: 'mbuaku@gmail.com',
      bio: 'AWS Certified Solutions Architect Professional',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      expertise: ['AWS', 'Solutions Architecture', 'Cloud Migration']
    },
    totalStudents: 892,
    averageRating: 4.8,
    totalReviews: 156,
    status: 'published'
  },
  {
    title: 'Azure DevOps Fundamentals',
    slug: 'azure-devops-fundamentals',
    description: 'Learn Azure DevOps tools and practices for modern software development',
    level: 'intermediate',
    category: 'Azure',
    cloudProvider: ['azure'],
    duration: 35,
    price: 79.99,
    isFree: false,
    thumbnail: '/images/course-placeholder.svg',
    objectives: [
      'Implement CI/CD pipelines with Azure DevOps',
      'Manage source control with Azure Repos',
      'Plan and track work with Azure Boards',
      'Deploy and manage applications'
    ],
    prerequisites: ['Basic development experience', 'Understanding of Git'],
    tags: ['azure', 'devops', 'cicd', 'intermediate'],
    curriculum: [
      {
        moduleId: 'module-1',
        title: 'Azure DevOps Overview',
        description: 'Introduction to Azure DevOps services',
        lessons: [
          {
            lessonId: 'lesson-1-1',
            title: 'Azure DevOps Services Overview',
            description: 'Understanding Azure DevOps components',
            duration: 35,
            videoUrl: 'https://example.com/azure-video1',
            resources: []
          }
        ]
      }
    ],
    instructor: {
      id: 'mbuaku@gmail.com',
      name: 'CloudMaster Admin',
      firstName: 'CloudMaster',
      lastName: 'Admin',
      email: 'mbuaku@gmail.com',
      bio: 'Microsoft Azure DevOps Engineer Expert',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      expertise: ['Azure', 'DevOps', 'CI/CD', 'Automation']
    },
    totalStudents: 645,
    averageRating: 4.6,
    totalReviews: 94,
    status: 'published'
  }
];

async function seedProductionDatabase() {
  try {
    // MongoDB connection string from environment
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://mongodb:27017/cloudmastershub';
    
    console.log('🔗 Connecting to MongoDB...');
    console.log('Using URI:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@'));
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing courses to ensure clean slate
    console.log('🧹 Clearing existing courses...');
    const deleteResult = await Course.deleteMany({});
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing courses`);

    // Insert sample courses
    console.log('📚 Seeding courses...');
    const insertedCourses = await Course.insertMany(sampleCourses);
    console.log(`✅ Inserted ${insertedCourses.length} courses`);

    console.log('🎉 Production database seeding completed successfully!');
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`- Courses: ${insertedCourses.length}`);
    
    insertedCourses.forEach(course => {
      console.log(`  📘 ${course.title} (${course.level}) - ${course.isFree ? 'FREE' : '$' + course.price} - slug: ${course.slug}`);
    });

    // Verify courses are accessible
    console.log('\n🔍 Verifying course accessibility...');
    for (const course of insertedCourses) {
      const found = await Course.findOne({ slug: course.slug });
      if (found) {
        console.log(`  ✅ ${course.slug} - accessible`);
      } else {
        console.log(`  ❌ ${course.slug} - not found`);
      }
    }

  } catch (error) {
    console.error('❌ Error seeding production database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed script
if (require.main === module) {
  seedProductionDatabase();
}

module.exports = { seedProductionDatabase };