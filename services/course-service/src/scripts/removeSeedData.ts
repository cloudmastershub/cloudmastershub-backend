import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { LearningPath } from '../models/LearningPath';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub';

// Known seed data slugs to remove
const SEED_PATH_SLUGS = [
  'aws-solutions-architect-path',
  'cloud-devops-engineer-path',
  'cloud-security-specialist-path',
  // Additional ones that might have been added
  'azure-administrator-path',
  'multi-cloud-architect-path',
  'gcp-data-engineer-path',
  'cloud-native-developer-path'
];

async function removeSeedData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get current count before removal
    const beforeCount = await LearningPath.countDocuments();
    console.log(`📊 Current learning paths in database: ${beforeCount}`);

    // Remove all seeded learning paths by slug
    console.log('🧹 Removing seeded learning paths...');
    const deleteResult = await LearningPath.deleteMany({
      slug: { $in: SEED_PATH_SLUGS }
    });

    console.log(`✅ Removed ${deleteResult.deletedCount} seeded learning paths`);

    // Get final count
    const afterCount = await LearningPath.countDocuments();
    console.log(`📊 Remaining learning paths in database: ${afterCount}`);

    if (afterCount === 0) {
      console.log('ℹ️  No learning paths remain in the database.');
      console.log('📝 Ready for real production data to be added through the admin interface.');
    } else {
      // List remaining paths (should be real production data only)
      const remainingPaths = await LearningPath.find().select('title slug status');
      console.log('\n📚 Remaining Learning Paths (Real Data):');
      remainingPaths.forEach((path: any) => {
        console.log(`  - ${path.title} (${path.slug}) - ${path.status || 'unknown status'}`);
      });
    }

    console.log('\n🎉 Seed data removal completed successfully!');
    console.log('✅ System now contains only real production data.');

  } catch (error) {
    console.error('❌ Error removing seed data:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup script
removeSeedData();