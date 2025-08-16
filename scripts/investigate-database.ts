#!/usr/bin/env npx ts-node

/**
 * Database Investigation Script
 * 
 * This script connects to the Course Service MongoDB database
 * and reports on the current content: courses and learning paths
 */

import mongoose from 'mongoose';

async function investigateDatabase() {
  console.log('🔍 INVESTIGATING COURSE SERVICE DATABASE');
  console.log('==========================================\n');

  try {
    // Connect to MongoDB using the course service connection string
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub-courses';
    console.log('📡 Connecting to MongoDB:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully\n');

    // Get database name
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    const dbName = db.databaseName;
    console.log('🗄️  Database Name:', dbName, '\n');

    // List all collections
    console.log('📊 COLLECTIONS ANALYSIS');
    console.log('========================');
    
    const collections = await db.listCollections().toArray();
    console.log('📁 Available Collections:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    console.log('');

    // Analyze Courses collection
    console.log('📚 COURSES ANALYSIS');
    console.log('====================');
    
    const coursesCollection = db.collection('courses');
    const courseCount = await coursesCollection.countDocuments();
    console.log(`📊 Total Courses: ${courseCount}`);
    
    if (courseCount > 0) {
      // Get sample courses with key fields
      const sampleCourses = await coursesCollection.find({})
        .project({ title: 1, slug: 1, status: 1, category: 1, level: 1, createdAt: 1 })
        .limit(10)
        .toArray();
      
      console.log('\n📋 Sample Courses:');
      sampleCourses.forEach((course, index) => {
        console.log(`   ${index + 1}. "${course.title}"`);
        console.log(`      - ID: ${course._id}`);
        console.log(`      - Slug: ${course.slug || 'NO SLUG'}`);
        console.log(`      - Status: ${course.status}`);
        console.log(`      - Category: ${course.category}`);
        console.log(`      - Level: ${course.level}`);
        console.log(`      - Created: ${course.createdAt}`);
        console.log('');
      });

      // Status breakdown
      const statusStats = await coursesCollection.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).toArray();
      
      console.log('📈 Courses by Status:');
      statusStats.forEach(stat => {
        console.log(`   - ${stat._id}: ${stat.count} courses`);
      });
      console.log('');
    }

    // Analyze Learning Paths collection
    console.log('🛤️  LEARNING PATHS ANALYSIS');
    console.log('=============================');
    
    const pathsCollection = db.collection('learningpaths');
    const pathCount = await pathsCollection.countDocuments();
    console.log(`📊 Total Learning Paths: ${pathCount}`);
    
    if (pathCount > 0) {
      // Get sample learning paths with key fields
      const samplePaths = await pathsCollection.find({})
        .project({ title: 1, slug: 1, status: 1, isPublished: 1, category: 1, level: 1, pathway: 1, createdAt: 1 })
        .limit(10)
        .toArray();
      
      console.log('\n📋 Sample Learning Paths:');
      samplePaths.forEach((path, index) => {
        console.log(`   ${index + 1}. "${path.title}"`);
        console.log(`      - ID: ${path._id}`);
        console.log(`      - Slug: ${path.slug || 'NO SLUG'}`);
        console.log(`      - Status: ${path.status}`);
        console.log(`      - Published: ${path.isPublished}`);
        console.log(`      - Category: ${path.category}`);
        console.log(`      - Level: ${path.level}`);
        console.log(`      - Steps: ${path.pathway?.length || 0}`);
        console.log(`      - Created: ${path.createdAt}`);
        console.log('');
      });

      // Status breakdown
      const pathStatusStats = await pathsCollection.aggregate([
        { $group: { _id: { status: '$status', published: '$isPublished' }, count: { $sum: 1 } } }
      ]).toArray();
      
      console.log('📈 Learning Paths by Status:');
      pathStatusStats.forEach(stat => {
        const statusLabel = `${stat._id.status} (Published: ${stat._id.published})`;
        console.log(`   - ${statusLabel}: ${stat.count} paths`);
      });
      console.log('');
    }

    // Check for Progress collections
    console.log('📈 PROGRESS TRACKING');
    console.log('====================');
    
    const courseProgressCollection = db.collection('courseprogresses');
    const courseProgressCount = await courseProgressCollection.countDocuments();
    console.log(`📊 Course Progress Records: ${courseProgressCount}`);

    const pathProgressCollection = db.collection('learningpathprogresses');
    const pathProgressCount = await pathProgressCollection.countDocuments();
    console.log(`📊 Learning Path Progress Records: ${pathProgressCount}`);
    console.log('');

    // Overall Summary
    console.log('📋 SUMMARY REPORT');
    console.log('==================');
    console.log(`📚 Courses: ${courseCount}`);
    console.log(`🛤️  Learning Paths: ${pathCount}`);
    console.log(`📈 Course Progress Records: ${courseProgressCount}`);
    console.log(`📈 Path Progress Records: ${pathProgressCount}`);
    console.log(`🗄️  Database: ${dbName}`);
    console.log(`📁 Collections: ${collections.length}`);
    
    console.log('\n✅ Database investigation completed successfully!');

  } catch (error: any) {
    console.error('❌ Database investigation failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  investigateDatabase().catch(console.error);
}

export default investigateDatabase;