#!/usr/bin/env npx ts-node

/**
 * Create Sample Course Script
 * 
 * Creates one sample course to test consistency across replicas
 */

import mongoose from 'mongoose';

// Simple course schema for direct insertion
const courseSchema = new mongoose.Schema({
  title: String,
  slug: String,
  description: String,
  category: String,
  level: String,
  duration: Number,
  thumbnail: String,
  instructor: {
    id: String,
    name: String,
    avatar: String,
    bio: String,
    expertise: [String],
    rating: Number
  },
  price: Number,
  rating: Number,
  enrollmentCount: Number,
  tags: [String],
  requirements: [String],
  objectives: [String],
  curriculum: [],
  status: String,
  publishedAt: Date
}, { timestamps: true });

async function createSampleCourse() {
  console.log('🎯 CREATING SAMPLE COURSE FOR CONSISTENCY TEST');
  console.log('===============================================\n');

  try {
    // Connect to production MongoDB
    const mongoUri = 'mongodb://admin:cloudmaster123@mongodb.cloudmastershub-dev.svc.cluster.local:27017/cloudmastershub?authSource=admin';
    console.log('📡 Connecting to production MongoDB...');
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully\n');

    const Course = mongoose.model('Course', courseSchema);

    // Create one sample course
    const sampleCourse = {
      title: 'Cloud Computing Fundamentals - TEST',
      slug: 'cloud-computing-fundamentals-test',
      description: 'A test course to verify data consistency across all course service replicas. This course should appear the same on all instances.',
      category: 'aws',
      level: 'beginner',
      duration: 180,
      thumbnail: 'https://api.cloudmastershub.com/images/courses/test-course.svg',
      instructor: {
        id: 'test-instructor',
        name: 'Test Instructor',
        avatar: 'https://via.placeholder.com/150',
        bio: 'Test instructor for consistency verification',
        expertise: ['testing', 'consistency'],
        rating: 5
      },
      price: 0,
      rating: 5,
      enrollmentCount: 0,
      tags: ['test', 'consistency', 'cloud'],
      requirements: ['Basic computer skills'],
      objectives: ['Verify data consistency', 'Test replica synchronization'],
      curriculum: [],
      status: 'published',
      publishedAt: new Date()
    };

    console.log('📚 Creating sample course...');
    const course = new Course(sampleCourse);
    await course.save();
    
    console.log('✅ Sample course created successfully!');
    console.log(`📋 Course ID: ${course._id}`);
    console.log(`📋 Course Slug: ${course.slug}`);
    console.log(`📋 Course Title: ${course.title}`);

    // Verify creation
    const courseCount = await Course.countDocuments();
    console.log(`\n📊 Total courses in database: ${courseCount}`);

    console.log('\n🎯 CONSISTENCY TEST READY');
    console.log('==========================');
    console.log('✅ Sample course created in centralized MongoDB');
    console.log('✅ All course service replicas should now see this course');
    console.log('✅ API should return consistent results across all requests');
    console.log('\n📝 TEST COMMAND:');
    console.log('curl "https://api.cloudmastershub.com/api/courses" | jq ".pagination.total"');
    console.log('(Should consistently return 1 across multiple requests)');

  } catch (error: any) {
    console.error('❌ Sample course creation failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  createSampleCourse().catch(console.error);
}

export default createSampleCourse;