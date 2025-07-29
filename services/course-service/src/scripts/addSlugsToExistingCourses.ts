import DatabaseConnection from '../database/connection';
import { Course } from '../models';
import { generateSlug, generateUniqueSlug } from '@cloudmastershub/utils';
import logger from '../utils/logger';

export async function addSlugsToExistingCourses() {
  try {
    logger.info('Starting slug migration for existing courses...');

    // Connect to database
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.connect();

    // Find all courses without slugs
    const coursesWithoutSlugs = await Course.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });

    logger.info(`Found ${coursesWithoutSlugs.length} courses without slugs`);

    if (coursesWithoutSlugs.length === 0) {
      logger.info('All courses already have slugs. No migration needed.');
      return;
    }

    // Get all existing slugs to ensure uniqueness
    const existingSlugs = await Course.find({ 
      slug: { $exists: true, $nin: [null, ''] } 
    }).select('slug').lean();
    
    const slugSet = new Set(existingSlugs.map(course => course.slug));

    let updatedCount = 0;

    // Process each course without a slug
    for (const course of coursesWithoutSlugs) {
      try {
        // Generate base slug from title
        const baseSlug = generateSlug(course.title);
        
        // Generate unique slug
        const uniqueSlug = generateUniqueSlug(baseSlug, Array.from(slugSet));
        
        // Add the new slug to our tracking set
        slugSet.add(uniqueSlug);

        // Update the course with the new slug
        await Course.findByIdAndUpdate(
          course._id,
          { slug: uniqueSlug },
          { new: true }
        );

        logger.info(`Updated course "${course.title}" with slug: ${uniqueSlug}`);
        updatedCount++;
      } catch (error) {
        logger.error(`Failed to update course ${course._id} (${course.title}):`, error);
      }
    }

    logger.info(`Successfully updated ${updatedCount} courses with slugs`);

    // Verify the update worked
    const remainingCoursesWithoutSlugs = await Course.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    }).countDocuments();

    if (remainingCoursesWithoutSlugs === 0) {
      logger.info('✅ All courses now have slugs! Migration completed successfully.');
    } else {
      logger.warn(`⚠️  ${remainingCoursesWithoutSlugs} courses still without slugs. Check logs for errors.`);
    }

    return {
      totalProcessed: coursesWithoutSlugs.length,
      updated: updatedCount,
      remaining: remainingCoursesWithoutSlugs
    };

  } catch (error) {
    logger.error('Error during slug migration:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  addSlugsToExistingCourses()
    .then((result) => {
      logger.info('Slug migration completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Slug migration failed:', error);
      process.exit(1);
    });
}