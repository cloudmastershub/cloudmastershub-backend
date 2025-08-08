/**
 * Seed script to create sample student enrollments for testing instructor/students page
 * This creates real CourseProgress documents in MongoDB to demonstrate the production-ready functionality
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub';

// Sample student IDs and course data
const sampleEnrollments = [
  {
    userId: 'student1@gmail.com',
    courseId: '674b6239c831fa95dc7cfed4', // Use actual course ID from your database
    enrolledAt: new Date('2024-01-15T10:00:00Z'),
    progress: 67,
    lastAccessedAt: new Date('2024-01-22T14:30:00Z'),
    completedLessons: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5', 'lesson-6', 'lesson-7', 'lesson-8'],
    currentLesson: 'lesson-9',
    watchedTime: 4800, // 1.33 hours
  },
  {
    userId: 'student2@gmail.com', 
    courseId: '674b6239c831fa95dc7cfed4',
    enrolledAt: new Date('2024-01-10T09:00:00Z'),
    progress: 100,
    lastAccessedAt: new Date('2024-01-20T16:45:00Z'),
    completedLessons: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5', 'lesson-6', 'lesson-7', 'lesson-8', 'lesson-9', 'lesson-10', 'lesson-11', 'lesson-12'],
    completedAt: new Date('2024-01-20T16:45:00Z'),
    watchedTime: 7200, // 2 hours
  },
  {
    userId: 'student3@gmail.com',
    courseId: '674b6239c831fa95dc7cfed5', // Different course ID
    enrolledAt: new Date('2024-01-20T11:00:00Z'),
    progress: 25,
    lastAccessedAt: new Date('2024-01-23T10:15:00Z'),
    completedLessons: ['lesson-1', 'lesson-2', 'lesson-3'],
    currentLesson: 'lesson-4',
    watchedTime: 1800, // 0.5 hours
  },
  {
    userId: 'student4@gmail.com',
    courseId: '674b6239c831fa95dc7cfed4',
    enrolledAt: new Date('2024-01-05T14:00:00Z'),
    progress: 15,
    lastAccessedAt: new Date('2024-01-06T09:30:00Z'),
    completedLessons: ['lesson-1'],
    currentLesson: 'lesson-2',
    watchedTime: 900, // 0.25 hours
  },
  {
    userId: 'student5@gmail.com',
    courseId: '674b6239c831fa95dc7cfed4',
    enrolledAt: new Date('2024-01-18T12:00:00Z'),
    progress: 45,
    lastAccessedAt: new Date('2024-01-23T11:20:00Z'),
    completedLessons: ['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5'],
    currentLesson: 'lesson-6',
    watchedTime: 3600, // 1 hour
  }
];

async function seedStudentEnrollments() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const collection = db.collection('courseprogresses');
    
    // Clear existing sample enrollments
    console.log('🧹 Clearing existing sample enrollments...');
    await collection.deleteMany({
      userId: { $in: sampleEnrollments.map(e => e.userId) }
    });
    
    // Insert new sample enrollments
    console.log('📚 Creating student enrollments...');
    const result = await collection.insertMany(sampleEnrollments.map(enrollment => ({
      ...enrollment,
      createdAt: enrollment.enrolledAt,
      updatedAt: enrollment.lastAccessedAt
    })));
    
    console.log(`✅ Created ${result.insertedCount} student enrollments`);
    
    // Display summary
    console.log('\n📊 Sample Student Enrollments Created:');
    for (const enrollment of sampleEnrollments) {
      console.log(`- ${enrollment.userId}: ${enrollment.progress}% progress in course ${enrollment.courseId}`);
    }
    
    console.log('\n✨ Student enrollment seeding completed successfully!');
    console.log('🎯 You can now test the /instructor/students page with real data');
    
  } catch (error) {
    console.error('❌ Error seeding student enrollments:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedStudentEnrollments()
    .then(() => {
      console.log('✅ Seeding process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedStudentEnrollments };