import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * DATABASE SEEDING DISABLED - NO MOCK DATA POLICY
 * 
 * CloudMastersHub follows a strict "No Mock Data" policy to ensure production-ready quality.
 * 
 * All course data must be created through the dashboard interface:
 * - Visit: /instructor/courses/create
 * - Use the course creation workflow for real courses
 * - This ensures proper data validation and business logic
 * 
 * This seed script has been disabled to comply with the no mock data policy.
 */

async function seedDatabase() {
  try {
    console.log('🚫 Database seeding is disabled.');
    console.log('CloudMastersHub follows a "No Mock Data" policy.');
    console.log('All courses must be created through the dashboard interface at /instructor/courses/create');
    console.log('This ensures production-ready data and eliminates mock data confusion.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    console.log('✅ Seeding check completed (seeding disabled)');
  }
}

// Run the seeding check (which does nothing)
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default seedDatabase;