import DatabaseConnection from '../database/connection';
import { Course } from '../models';
import logger from '../utils/logger';

/**
 * Clean up seeded courses from the database
 * 
 * This script identifies and removes courses that were created by seed scripts
 * to comply with the "No Mock Data" policy.
 */

interface CleanupResult {
  totalCourses: number;
  seededCourses: number;
  realCourses: number;
  removedCourses: string[];
  keptCourses: string[];
}

/**
 * Detect if a course was likely created by seed scripts
 */
function isSeededCourse(course: any): boolean {
  // Check for seed-specific instructor IDs
  const seededInstructorIds = [
    'instructor-1', 'instructor-2', 'instructor-3',
    'instructor-aws-101', 'instructor-azure-201', 'instructor-gcp-301',
    'instructor-multicloud-401', 'instructor-k8s-301',
    'instructor-aws-jane', 'instructor-azure-mike', 'instructor-gcp-emily'
  ];

  if (seededInstructorIds.includes(course.instructor?.id)) {
    return true;
  }

  // Check for seed-specific instructor names
  const seededInstructorNames = [
    'Jane Smith', 'Sarah Johnson', 'Michael Chen', 'Dr. Emily Rodriguez', 
    'David Thompson', 'Lisa Wang'
  ];

  if (seededInstructorNames.includes(course.instructor?.name)) {
    return true;
  }

  // Check for placeholder/example content
  const placeholderIndicators = [
    'via.placeholder.com',
    'example.com',
    'https://www.youtube.com/embed/dQw4w9WgXcQ', // Rick roll - common placeholder
    'placeholder',
    'Lorem ipsum'
  ];

  const hasPlaceholderContent = placeholderIndicators.some(indicator => 
    course.thumbnail?.includes(indicator) ||
    course.preview?.includes(indicator) ||
    course.description?.includes(indicator)
  );

  if (hasPlaceholderContent) {
    return true;
  }

  // Check for unrealistic enrollment patterns typical of seed data
  const hasUnrealisticEnrollment = (course.enrollmentCount > 100) && 
                                  (course.rating > 4.5) && 
                                  (course.status === 'PUBLISHED') &&
                                  !course.createdAt; // Seed data might not have proper timestamps

  if (hasUnrealisticEnrollment) {
    return true;
  }

  // Check for exact matches to known seed course titles
  const seededTitles = [
    'AWS Fundamentals',
    'Azure DevOps Mastery',
    'Google Cloud Platform Security',
    'Multi-Cloud Architecture',
    'Kubernetes Fundamentals'
  ];

  if (seededTitles.includes(course.title)) {
    return true;
  }

  return false;
}

const cleanupSeededCourses = async (): Promise<CleanupResult> => {
  try {
    logger.info('🧹 Starting seeded course cleanup...');
    
    const dbConnection = DatabaseConnection.getInstance();
    const isConnected = dbConnection.getConnectionStatus();
    
    if (!isConnected) {
      logger.error('Database connection not available. Cannot cleanup courses.');
      throw new Error('Database connection required for cleanup');
    }

    // Get all courses
    const allCourses = await Course.find({}).lean();
    logger.info(`📊 Found ${allCourses.length} total courses in database`);

    const result: CleanupResult = {
      totalCourses: allCourses.length,
      seededCourses: 0,
      realCourses: 0,
      removedCourses: [],
      keptCourses: []
    };

    // Analyze each course
    for (const course of allCourses) {
      const isSeeded = isSeededCourse(course);
      
      if (isSeeded) {
        result.seededCourses++;
        
        logger.info(`🗑️  Removing seeded course: "${course.title}" (ID: ${course._id})`);
        logger.info(`   Reason: Instructor "${course.instructor?.name}" (${course.instructor?.id})`);
        
        // Delete the course
        await Course.findByIdAndDelete(course._id);
        result.removedCourses.push(`${course.title} (${course._id})`);
        
      } else {
        result.realCourses++;
        result.keptCourses.push(`${course.title} (${course._id})`);
        logger.info(`✅ Keeping real course: "${course.title}" (ID: ${course._id})`);
      }
    }

    logger.info('🎉 Cleanup completed successfully!');
    logger.info('📊 Summary:');
    logger.info(`   📚 Total courses processed: ${result.totalCourses}`);
    logger.info(`   🗑️  Seeded courses removed: ${result.seededCourses}`);
    logger.info(`   ✅ Real courses kept: ${result.realCourses}`);
    
    if (result.removedCourses.length > 0) {
      logger.info('🗑️  Removed courses:');
      result.removedCourses.forEach(course => logger.info(`     - ${course}`));
    }
    
    if (result.keptCourses.length > 0) {
      logger.info('✅ Kept courses:');
      result.keptCourses.forEach(course => logger.info(`     - ${course}`));
    }
    
    return result;
    
  } catch (error) {
    logger.error('❌ Error during seeded course cleanup:', error);
    throw error;
  }
};

// Run the cleanup if this script is executed directly
if (require.main === module) {
  cleanupSeededCourses().catch((error) => {
    console.error('Fatal error during cleanup:', error);
    process.exit(1);
  });
}

export { cleanupSeededCourses };
export default cleanupSeededCourses;