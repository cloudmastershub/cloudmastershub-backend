export { Course, ICourse } from './Course';
export { CourseProgress, ICourseProgress } from './CourseProgress';
export { Bookmark, IBookmark } from './Bookmark';
export { Certificate, ICertificate } from './Certificate';
// Learning paths removed - now admin-only via admin service
// Keep exports temporarily to avoid build errors in unused files
export { LearningPath, LearningPathProgress, ILearningPath, ILearningPathProgress } from './LearningPath';

// Re-export mongoose for convenience
export { default as mongoose } from 'mongoose';