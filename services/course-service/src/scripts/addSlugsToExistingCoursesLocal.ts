import mongoose from 'mongoose';
import { generateSlug, generateUniqueSlug } from '@cloudmastershub/utils';

// Simple Course interface for this script
interface CourseDoc {
  _id: string;
  title: string;
  slug?: string;
}

const MONGODB_URI = 'mongodb://localhost:27017/cloudmastershub';

async function addSlugsToExistingCourses() {
  try {
    console.log('Starting slug migration for existing courses...');

    // Connect directly to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false }));

    // Find all courses without slugs
    const coursesWithoutSlugs = await Course.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    }).lean<CourseDoc[]>();

    console.log(`Found ${coursesWithoutSlugs.length} courses without slugs`);

    if (coursesWithoutSlugs.length === 0) {
      console.log('All courses already have slugs. No migration needed.');
      return;
    }

    // Get all existing slugs to ensure uniqueness
    const existingSlugs = await Course.find({ 
      slug: { $exists: true, $nin: [null, ''] } 
    }).select('slug').lean();
    
    const slugSet = new Set(existingSlugs.map(course => (course as any).slug));

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

        console.log(`Updated course "${course.title}" with slug: ${uniqueSlug}`);
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update course ${course._id} (${course.title}):`, error);
      }
    }

    console.log(`Successfully updated ${updatedCount} courses with slugs`);

    // Verify the update worked
    const remainingCoursesWithoutSlugs = await Course.find({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    }).countDocuments();

    if (remainingCoursesWithoutSlugs === 0) {
      console.log('✅ All courses now have slugs! Migration completed successfully.');
    } else {
      console.warn(`⚠️  ${remainingCoursesWithoutSlugs} courses still without slugs. Check logs for errors.`);
    }

    await mongoose.disconnect();

    return {
      totalProcessed: coursesWithoutSlugs.length,
      updated: updatedCount,
      remaining: remainingCoursesWithoutSlugs
    };

  } catch (error) {
    console.error('Error during slug migration:', error);
    await mongoose.disconnect();
    throw error;
  }
}

// Run migration
addSlugsToExistingCourses()
  .then((result) => {
    console.log('Slug migration completed:', result);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Slug migration failed:', error);
    process.exit(1);
  });