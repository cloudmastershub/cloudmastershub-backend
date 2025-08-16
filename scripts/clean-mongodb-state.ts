#!/usr/bin/env npx ts-node

/**
 * Clean MongoDB State Script
 * 
 * This script connects to the course service MongoDB and ensures
 * a clean, consistent state for all course service replicas
 */

import mongoose from 'mongoose';

async function cleanMongoDBState() {
  console.log('🧹 CLEANING MONGODB STATE FOR COURSE SERVICE');
  console.log('===============================================\n');

  try {
    // Connect to production MongoDB using the same connection as course service
    const mongoUri = 'mongodb://admin:cloudmaster123@mongodb.cloudmastershub-dev.svc.cluster.local:27017/cloudmastershub?authSource=admin';
    console.log('📡 Connecting to production MongoDB...');
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully\n');

    // Get database name
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    const dbName = db.databaseName;
    console.log('🗄️  Database:', dbName);

    // List collections before cleanup
    console.log('\n📊 BEFORE CLEANUP:');
    console.log('==================');
    
    const collections = await db.listCollections().toArray();
    console.log('📁 Collections found:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} documents`);
    }

    // Clean course-related collections
    console.log('\n🧹 CLEANING COURSE DATA:');
    console.log('=========================');
    
    const coursesCollection = db.collection('courses');
    const coursesCount = await coursesCollection.countDocuments();
    console.log(`📚 Found ${coursesCount} courses - removing all...`);
    await coursesCollection.deleteMany({});
    console.log('✅ All courses deleted');

    const learningPathsCollection = db.collection('learningpaths');
    const pathsCount = await learningPathsCollection.countDocuments();
    console.log(`🛤️  Found ${pathsCount} learning paths - removing all...`);
    await learningPathsCollection.deleteMany({});
    console.log('✅ All learning paths deleted');

    const courseProgressCollection = db.collection('courseprogresses');
    const progressCount = await courseProgressCollection.countDocuments();
    console.log(`📈 Found ${progressCount} course progress records - removing all...`);
    await courseProgressCollection.deleteMany({});
    console.log('✅ All course progress deleted');

    const pathProgressCollection = db.collection('learningpathprogresses');
    const pathProgressCount = await pathProgressCollection.countDocuments();
    console.log(`📈 Found ${pathProgressCount} path progress records - removing all...`);
    await pathProgressCollection.deleteMany({});
    console.log('✅ All path progress deleted');

    // Verify cleanup
    console.log('\n📊 AFTER CLEANUP:');
    console.log('==================');
    
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`   - ${col.name}: ${count} documents`);
    }

    console.log('\n🎯 CLEAN STATE ACHIEVED');
    console.log('========================');
    console.log('✅ MongoDB is now in a clean state');
    console.log('✅ All course service replicas will see identical empty state');
    console.log('✅ Ready for consistent data creation');
    console.log('\n📝 NEXT STEPS:');
    console.log('- Scale course service back to multiple replicas');
    console.log('- All replicas will now use the same clean MongoDB state');
    console.log('- Create courses through the admin interface or API');
    console.log('- All replicas will see consistent data');

  } catch (error: any) {
    console.error('❌ MongoDB cleanup failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  cleanMongoDBState().catch(console.error);
}

export default cleanMongoDBState;