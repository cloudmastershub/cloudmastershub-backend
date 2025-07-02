#!/usr/bin/env ts-node

/**
 * Grant All Roles Script
 * 
 * This script:
 * 1. Runs the database migration to add roles support
 * 2. Grants all roles (student, instructor, admin) to the specified user
 * 
 * Usage: npm run grant-admin
 */

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../database/connection';
import { userRepository } from '../database/userRepository';
import logger from '../utils/logger';

const ADMIN_EMAIL = 'mbuaku@gmail.com';

async function runMigration() {
  try {
    logger.info('Running database migration for roles support...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/add-user-roles.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute the migration
    await db.query(migrationSQL);
    
    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Failed to run database migration', error);
    throw error;
  }
}

async function grantAdminPrivileges() {
  try {
    logger.info(`Granting all roles to ${ADMIN_EMAIL}...`);
    
    // Grant all roles using the repository method
    const user = await userRepository.grantAdminPrivileges(ADMIN_EMAIL);
    
    if (user) {
      logger.info('All roles granted successfully', {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        subscriptionType: user.subscription_type
      });
      
      console.log('\n✅ All roles granted successfully!');
      console.log(`User: ${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`Roles: ${user.roles.join(', ')}`);
      console.log(`Subscription: ${user.subscription_type}`);
      console.log('\nYou can now log in and access all user experiences:');
      console.log('- Student Dashboard: / (default experience)');
      console.log('- Instructor Dashboard: /instructor');
      console.log('- Admin Dashboard: /admin');
      console.log('- Course Management: /instructor/courses');
      console.log('- User Management: /admin/users');
      console.log('- Analytics: /admin/analytics');
    } else {
      throw new Error(`User with email ${ADMIN_EMAIL} not found. Please register first.`);
    }
  } catch (error) {
    logger.error('Failed to grant all roles', error);
    throw error;
  }
}

async function checkExistingUser() {
  try {
    logger.info(`Checking if user ${ADMIN_EMAIL} exists...`);
    
    const user = await userRepository.getUserByEmail(ADMIN_EMAIL);
    
    if (user) {
      logger.info('User found', {
        userId: user.id,
        email: user.email,
        currentRoles: user.roles || 'No roles set'
      });
      return user;
    } else {
      logger.info('User not found - migration will create the user');
      return null;
    }
  } catch (error) {
    logger.error('Failed to check existing user', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting All Roles Grant Process...\n');
    
    // Initialize database connection
    await db.connect();
    logger.info('Database connection established');
    
    // Check if user exists
    await checkExistingUser();
    
    // Run the migration (this will create user if doesn't exist)
    await runMigration();
    
    // Grant all roles (redundant but ensures it's set)
    await grantAdminPrivileges();
    
    console.log('\n🎉 Process completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the backend services: npm run dev');
    console.log('2. Visit the frontend application');
    console.log('3. Log in with your email and password');
    console.log('4. You now have access to all user experiences (student, instructor, admin)');
    
  } catch (error) {
    console.error('\n❌ Failed to grant all roles:', error);
    logger.error('Grant roles process failed', error);
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await db.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Failed to close database connection', error);
    }
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

export { main, runMigration, grantAdminPrivileges };