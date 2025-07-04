import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Course } from '../src/models/Course';
import { generateSlug, generateUniqueSlug } from '@cloudmastershub/utils';
import logger from '../src/utils/logger';

// Load environment variables
dotenv.config();

async function addSlugsToExistingCourses() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub-courses';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for slug migration');

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
      logger.info('All courses already have slugs. Migration complete.');
      return;
    }

    // Get all existing slugs to ensure uniqueness
    const existingCourses = await Course.find({ slug: { $exists: true } }).select('slug');
    const existingSlugs = existingCourses.map(c => c.slug).filter(Boolean);

    let updatedCount = 0;
    const errors: any[] = [];

    // Update each course with a slug
    for (const course of coursesWithoutSlugs) {
      try {
        const baseSlug = generateSlug(course.title);
        const uniqueSlug = generateUniqueSlug(baseSlug, existingSlugs);
        
        course.slug = uniqueSlug;
        await course.save();
        
        existingSlugs.push(uniqueSlug); // Add to existing slugs to prevent duplicates
        updatedCount++;
        
        logger.info(`Added slug "${uniqueSlug}" to course "${course.title}" (ID: ${course._id})`);
      } catch (error) {
        logger.error(`Failed to add slug to course "${course.title}" (ID: ${course._id}):`, error);
        errors.push({ courseId: course._id, title: course.title, error });
      }
    }

    logger.info(`Slug migration completed. Updated ${updatedCount} courses.`);
    
    if (errors.length > 0) {
      logger.error(`Failed to update ${errors.length} courses:`, errors);
    }

    // Verify all courses now have slugs
    const coursesStillWithoutSlugs = await Course.countDocuments({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });

    if (coursesStillWithoutSlugs > 0) {
      logger.warn(`WARNING: ${coursesStillWithoutSlugs} courses still don't have slugs`);
    } else {
      logger.info('SUCCESS: All courses now have slugs');
    }

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  addSlugsToExistingCourses()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { addSlugsToExistingCourses };