import logger from '../utils/logger';

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
 * Why seeding is disabled:
 * - Eliminates confusion between mock and real data
 * - Ensures all features work with production data
 * - Provides authentic testing and development experience
 * - Prevents deployment of placeholder content
 */

const seedDatabase = async (): Promise<void> => {
  logger.warn('🚫 Database seeding is disabled.');
  logger.warn('CloudMastersHub follows a "No Mock Data" policy.');
  logger.warn('All courses must be created through the dashboard interface at /instructor/courses/create');
  logger.warn('This ensures production-ready data and eliminates mock data confusion.');
  
  // Intentionally do nothing - seeding is disabled
  return;
};

// Seeding functionality disabled - export maintained for compatibility
export { seedDatabase };
export default seedDatabase;