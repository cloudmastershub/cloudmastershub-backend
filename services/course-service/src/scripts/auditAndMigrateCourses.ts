import DatabaseConnection from '../database/connection';
import { Course, CourseProgress } from '../models';
import { generateSlug, generateUniqueSlug } from '@cloudmastershub/utils';
import mongoose from 'mongoose';
import logger from '../utils/logger';

interface AuditResult {
  totalCourses: number;
  coursesWithReadableSlugs: number;
  coursesWithLegacyIds: number;
  mockCourses: number;
  orphanedProgress: number;
  report: CourseAuditRecord[];
}

interface CourseAuditRecord {
  _id: string;
  title: string;
  slug: string;
  status: string;
  hasReadableSlug: boolean;
  isLegacyId: boolean;
  isMockCourse: boolean;
  shouldMigrate: boolean;
  shouldDelete: boolean;
  enrollmentCount: number;
  createdAt?: Date;
}

/**
 * Check if a string looks like a legacy ID (UUID or MongoDB ObjectId pattern)
 */
function isLegacyId(id: string): boolean {
  // UUID pattern (e.g., "123e4567-e89b-12d3-a456-426614174000")
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // MongoDB ObjectId pattern (24 hex characters)
  const objectIdPattern = /^[0-9a-f]{24}$/i;
  
  // Random alphanumeric strings (common for mock data)
  const randomAlphanumericPattern = /^[A-Za-z0-9]{10,}$/;
  
  return uuidPattern.test(id) || 
         objectIdPattern.test(id) || 
         (randomAlphanumericPattern.test(id) && id.length > 15);
}

/**
 * Check if a slug is human-readable
 */
function hasReadableSlug(slug: string): boolean {
  // Readable slugs should contain hyphens and be lowercase
  // Examples: "aws-fundamentals", "docker-for-beginners"
  return slug.includes('-') && 
         slug === slug.toLowerCase() && 
         !/^[0-9a-f]{24}$/i.test(slug) && // Not an ObjectId
         !isLegacyId(slug);
}

/**
 * Detect if this is likely a mock/test course
 */
function isMockCourse(course: any): boolean {
  const mockIndicators = [
    'test', 'mock', 'sample', 'demo', 'example',
    'placeholder', 'temp', 'fake', 'dummy'
  ];
  
  const titleLower = course.title.toLowerCase();
  const descriptionLower = course.description?.toLowerCase() || '';
  
  // Check for mock indicators in title or description
  const hasMockKeywords = mockIndicators.some(keyword => 
    titleLower.includes(keyword) || descriptionLower.includes(keyword)
  );
  
  // Check for test instructor patterns
  const hasTestInstructor = course.instructor?.name?.toLowerCase().includes('test') ||
                           course.instructor?.id?.includes('test');
  
  // Check for very low enrollment (could be test data)
  const hasLowEngagement = course.enrollmentCount === 0 && 
                          course.rating === 0 &&
                          course.status === 'DRAFT';
  
  // Check for unrealistic data patterns
  const hasUnrealisticData = course.price === 0 && 
                            course.enrollmentCount > 1000; // Free course with high enrollment but no rating
  
  return hasMockKeywords || hasTestInstructor || hasLowEngagement || hasUnrealisticData;
}

/**
 * Audit all courses in the database
 */
export async function auditCourses(): Promise<AuditResult> {
  logger.info('Starting course audit...');

  const courses = await Course.find({}).lean();
  const totalCourses = courses.length;
  
  const report: CourseAuditRecord[] = [];
  let coursesWithReadableSlugs = 0;
  let coursesWithLegacyIds = 0;
  let mockCourses = 0;

  for (const course of courses) {
    const hasReadable = hasReadableSlug(course.slug);
    const isLegacy = isLegacyId(course.slug);
    const isMock = isMockCourse(course);
    
    if (hasReadable) coursesWithReadableSlugs++;
    if (isLegacy) coursesWithLegacyIds++;
    if (isMock) mockCourses++;

    const auditRecord: CourseAuditRecord = {
      _id: course._id.toString(),
      title: course.title,
      slug: course.slug,
      status: course.status,
      hasReadableSlug: hasReadable,
      isLegacyId: isLegacy,
      isMockCourse: isMock,
      shouldMigrate: !hasReadable && !isMock, // Migrate legitimate courses with bad slugs
      shouldDelete: isMock, // Delete mock courses
      enrollmentCount: course.enrollmentCount || 0,
      createdAt: course.createdAt
    };

    report.push(auditRecord);
  }

  // Check for orphaned course progress records
  const allCourseIds = courses.map(c => c._id.toString());
  const allCourseSlugs = courses.map(c => c.slug);
  const allValidIds = [...allCourseIds, ...allCourseSlugs];
  
  const orphanedProgress = await CourseProgress.countDocuments({
    courseId: { $nin: allValidIds }
  });

  const result: AuditResult = {
    totalCourses,
    coursesWithReadableSlugs,
    coursesWithLegacyIds,
    mockCourses,
    orphanedProgress,
    report: report.sort((a, b) => {
      // Sort by: should delete first, then should migrate, then by title
      if (a.shouldDelete !== b.shouldDelete) return a.shouldDelete ? -1 : 1;
      if (a.shouldMigrate !== b.shouldMigrate) return a.shouldMigrate ? -1 : 1;
      return a.title.localeCompare(b.title);
    })
  };

  logger.info('Course audit completed', {
    totalCourses: result.totalCourses,
    readable: result.coursesWithReadableSlugs,
    legacy: result.coursesWithLegacyIds,
    mock: result.mockCourses,
    orphaned: result.orphanedProgress
  });

  return result;
}

/**
 * Delete mock courses and orphaned data
 */
export async function deleteMockCourses(auditResult: AuditResult): Promise<number> {
  logger.info('Starting mock course deletion...');

  const mockCourseIds = auditResult.report
    .filter(record => record.shouldDelete)
    .map(record => record._id);

  if (mockCourseIds.length === 0) {
    logger.info('No mock courses to delete');
    return 0;
  }

  logger.info(`Deleting ${mockCourseIds.length} mock courses...`);

  // Delete mock courses
  const deleteResult = await Course.deleteMany({
    _id: { $in: mockCourseIds.map(id => new mongoose.Types.ObjectId(id)) }
  });

  // Delete progress records for deleted courses
  const deletedProgressRecords = await CourseProgress.deleteMany({
    courseId: { $in: mockCourseIds }
  });

  // Delete orphaned progress records
  const allRemainingCourses = await Course.find({}).select('_id slug').lean();
  const validCourseIdentifiers = [
    ...allRemainingCourses.map(c => c._id.toString()),
    ...allRemainingCourses.map(c => c.slug)
  ];

  const orphanedProgressDeleted = await CourseProgress.deleteMany({
    courseId: { $nin: validCourseIdentifiers }
  });

  logger.info('Mock course deletion completed', {
    coursesDeleted: deleteResult.deletedCount,
    progressRecordsDeleted: deletedProgressRecords.deletedCount,
    orphanedProgressDeleted: orphanedProgressDeleted.deletedCount
  });

  return deleteResult.deletedCount || 0;
}

/**
 * Migrate legitimate courses to use slug-based IDs
 */
export async function migrateLegitimateCoursesToSlugs(auditResult: AuditResult): Promise<number> {
  logger.info('Starting course slug migration...');

  const coursesToMigrate = auditResult.report.filter(record => record.shouldMigrate);

  if (coursesToMigrate.length === 0) {
    logger.info('No courses need migration');
    return 0;
  }

  logger.info(`Migrating ${coursesToMigrate.length} courses to slug-based IDs...`);

  let migratedCount = 0;

  for (const courseRecord of coursesToMigrate) {
    try {
      const course = await Course.findById(courseRecord._id);
      if (!course) continue;

      // Generate a new readable slug from the title
      const baseSlug = generateSlug(course.title);
      
      // Get all existing slugs to ensure uniqueness
      const existingCourses = await Course.find({
        slug: { $regex: `^${baseSlug}(-\\d+)?$` }
      }).select('slug');
      
      const existingSlugs = existingCourses
        .filter(c => c._id.toString() !== course._id.toString())
        .map(c => c.slug);
      
      const newSlug = generateUniqueSlug(baseSlug, existingSlugs);

      // Update the course slug
      course.slug = newSlug;
      await course.save();

      // Update any progress records that reference the old slug
      await CourseProgress.updateMany(
        { courseId: courseRecord.slug },
        { courseId: newSlug }
      );

      logger.info(`Migrated course: ${course.title}`, {
        oldSlug: courseRecord.slug,
        newSlug: newSlug,
        courseId: course._id
      });

      migratedCount++;
    } catch (error) {
      logger.error(`Error migrating course ${courseRecord.title}:`, error);
    }
  }

  logger.info('Course migration completed', { migratedCount });
  return migratedCount;
}

/**
 * Clean up any remaining foreign key references
 */
export async function cleanupForeignKeyReferences(): Promise<void> {
  logger.info('Cleaning up foreign key references...');

  // Get all valid course slugs
  const validCourses = await Course.find({}).select('slug').lean();
  const validSlugs = validCourses.map(c => c.slug);

  // Clean up course progress records with invalid course references
  const cleanupResult = await CourseProgress.deleteMany({
    courseId: { $nin: validSlugs }
  });

  logger.info('Foreign key cleanup completed', {
    cleanedProgressRecords: cleanupResult.deletedCount
  });
}

/**
 * Main migration function
 */
export async function performCourseMigration(): Promise<void> {
  try {
    logger.info('Starting comprehensive course migration...');

    // Connect to database
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.connect();

    // Step 1: Audit current state
    const auditResult = await auditCourses();
    
    console.log('\n=== COURSE AUDIT REPORT ===');
    console.log(`Total courses: ${auditResult.totalCourses}`);
    console.log(`Courses with readable slugs: ${auditResult.coursesWithReadableSlugs}`);
    console.log(`Courses with legacy IDs: ${auditResult.coursesWithLegacyIds}`);
    console.log(`Mock courses to delete: ${auditResult.mockCourses}`);
    console.log(`Orphaned progress records: ${auditResult.orphanedProgress}`);
    
    console.log('\n=== DETAILED COURSE BREAKDOWN ===');
    auditResult.report.forEach(record => {
      const flags = [];
      if (record.shouldDelete) flags.push('DELETE');
      if (record.shouldMigrate) flags.push('MIGRATE');
      if (record.hasReadableSlug) flags.push('READABLE');
      if (record.isLegacyId) flags.push('LEGACY');
      if (record.isMockCourse) flags.push('MOCK');
      
      console.log(`${record.title}: ${record.slug} [${flags.join(', ')}]`);
    });

    // Step 2: Delete mock courses
    const deletedCount = await deleteMockCourses(auditResult);
    
    // Step 3: Migrate legitimate courses
    const migratedCount = await migrateLegitimateCoursesToSlugs(auditResult);
    
    // Step 4: Clean up foreign key references
    await cleanupForeignKeyReferences();

    // Step 5: Final audit
    const finalAudit = await auditCourses();
    
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Mock courses deleted: ${deletedCount}`);
    console.log(`Courses migrated: ${migratedCount}`);
    console.log(`Final course count: ${finalAudit.totalCourses}`);
    console.log(`Courses with readable slugs: ${finalAudit.coursesWithReadableSlugs}`);
    console.log(`Courses with legacy IDs: ${finalAudit.coursesWithLegacyIds}`);
    
    if (finalAudit.coursesWithLegacyIds === 0 && finalAudit.mockCourses === 0) {
      console.log('✅ Migration completed successfully! All courses now use readable slugs.');
    } else {
      console.log('⚠️  Migration completed with some issues. Manual review may be needed.');
    }

    logger.info('Course migration completed successfully');
  } catch (error) {
    logger.error('Course migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  performCourseMigration()
    .then(() => {
      logger.info('Migration completed, exiting...');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}