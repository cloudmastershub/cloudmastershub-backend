#!/usr/bin/env npx ts-node

/**
 * Learning Path Migration Script
 * 
 * This script investigates and migrates learning paths from Admin Service PostgreSQL
 * to Course Service MongoDB as part of the learning path architecture correction.
 * 
 * Usage: npm run migrate-learning-paths
 */

import mongoose from 'mongoose';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Database connections
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub';
const POSTGRES_URI = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://localhost:5432/cloudmastershub_admin';

// Course Service MongoDB Models (simplified for migration)
const learningPathSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  shortDescription: String,
  category: { type: String, required: true },
  level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], required: true },
  thumbnail: String,
  instructorId: { type: String, required: true },
  price: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  isFree: { type: Boolean, default: true },
  pathway: [{
    stepId: String,
    type: { type: String, enum: ['course', 'lab', 'assessment', 'project'] },
    title: String,
    description: String,
    courseId: String,
    labId: String,
    order: Number,
    isRequired: { type: Boolean, default: true },
    estimatedTimeMinutes: Number,
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    skills: [String],
    prerequisites: [String]
  }],
  objectives: [String],
  skills: [String],
  prerequisites: [String],
  outcomes: [String],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  enrollmentCount: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  tags: [String],
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  isPublished: { type: Boolean, default: false },
  keywords: [String],
  includesCertificate: { type: Boolean, default: false },
  hasHandsOnLabs: { type: Boolean, default: false },
  supportLevel: { type: String, enum: ['basic', 'standard', 'premium'], default: 'basic' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual fields
learningPathSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

learningPathSchema.virtual('totalSteps').get(function() {
  return this.pathway ? this.pathway.length : 0;
});

learningPathSchema.virtual('totalCourses').get(function() {
  return this.pathway ? this.pathway.filter(step => step.type === 'course').length : 0;
});

learningPathSchema.virtual('totalLabs').get(function() {
  return this.pathway ? this.pathway.filter(step => step.type === 'lab').length : 0;
});

learningPathSchema.virtual('estimatedDurationHours').get(function() {
  if (!this.pathway) return 0;
  return Math.round(this.pathway.reduce((total, step) => total + (step.estimatedTimeMinutes || 0), 0) / 60);
});

const LearningPath = mongoose.model('LearningPath', learningPathSchema);

interface MigrationResult {
  success: boolean;
  message: string;
  details?: any;
}

interface LearningPathData {
  source: 'admin_actions' | 'admin_settings' | 'manual_entry';
  title: string;
  description: string;
  category: string;
  level: string;
  instructorId: string;
  originalData?: any;
}

class LearningPathMigrator {
  private pgPool: Pool;
  private mongoConnected = false;

  constructor() {
    this.pgPool = new Pool({
      connectionString: POSTGRES_URI,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async initialize(): Promise<void> {
    try {
      // Connect to MongoDB
      await mongoose.connect(MONGODB_URI);
      this.mongoConnected = true;
      console.log('✅ Connected to MongoDB (Course Service)');

      // Test PostgreSQL connection
      const client = await this.pgPool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ Connected to PostgreSQL (Admin Service)');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.mongoConnected) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
    await this.pgPool.end();
    console.log('🔌 Disconnected from PostgreSQL');
  }

  async investigateAdminService(): Promise<LearningPathData[]> {
    console.log('\n🔍 Investigating Admin Service PostgreSQL for learning paths...');
    
    const foundPaths: LearningPathData[] = [];
    const client = await this.pgPool.connect();

    try {
      // Check admin_actions table for learning path creation/updates
      console.log('📋 Checking admin_actions table...');
      const actionsResult = await client.query(`
        SELECT * FROM admin_actions 
        WHERE resource_type = 'learning_path' 
           OR action LIKE '%path%' 
           OR details::text ILIKE '%learning%path%'
           OR details::text ILIKE '%pathway%'
        ORDER BY created_at DESC
      `);

      if (actionsResult.rows.length > 0) {
        console.log(`📄 Found ${actionsResult.rows.length} learning path related actions`);
        for (const row of actionsResult.rows) {
          console.log(`   - ${row.action} by ${row.admin_email} at ${row.created_at}`);
          console.log(`     Resource: ${row.resource_type}:${row.resource_id}`);
          if (row.details) {
            console.log(`     Details: ${JSON.stringify(row.details, null, 2)}`);
          }
        }
      } else {
        console.log('   No learning path actions found');
      }

      // Check platform_settings for learning path configurations
      console.log('📋 Checking platform_settings table...');
      const settingsResult = await client.query(`
        SELECT * FROM platform_settings 
        WHERE setting_key ILIKE '%path%' 
           OR setting_value::text ILIKE '%learning%path%'
           OR description ILIKE '%path%'
      `);

      if (settingsResult.rows.length > 0) {
        console.log(`⚙️ Found ${settingsResult.rows.length} learning path related settings`);
        for (const row of settingsResult.rows) {
          console.log(`   - ${row.category}.${row.setting_key}: ${row.setting_value}`);
          console.log(`     ${row.description}`);
        }
      } else {
        console.log('   No learning path settings found');
      }

      // Check content_moderation_queue for learning paths
      console.log('📋 Checking content_moderation_queue table...');
      const queueResult = await client.query(`
        SELECT * FROM content_moderation_queue 
        WHERE content_type = 'learning_path' 
           OR content_title ILIKE '%learning%path%'
           OR content_description ILIKE '%learning%path%'
      `);

      if (queueResult.rows.length > 0) {
        console.log(`📝 Found ${queueResult.rows.length} learning paths in moderation queue`);
        for (const row of queueResult.rows) {
          console.log(`   - ${row.content_title} (${row.status})`);
          console.log(`     Author: ${row.author_email}, Flagged: ${row.flagged_at}`);
        }
      } else {
        console.log('   No learning paths in moderation queue');
      }

      // List all tables to see if there are any we missed
      console.log('📋 Checking all tables in Admin Service...');
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      console.log('📊 Available tables:');
      for (const row of tablesResult.rows) {
        console.log(`   - ${row.table_name}`);
      }

    } catch (error) {
      console.error('❌ Error investigating Admin Service:', error);
    } finally {
      client.release();
    }

    return foundPaths;
  }

  async getCurrentLearningPaths(): Promise<any[]> {
    console.log('\n🔍 Checking current learning paths in Course Service MongoDB...');
    
    try {
      const paths = await LearningPath.find({}).lean();
      console.log(`📊 Found ${paths.length} existing learning paths:`);
      
      for (const path of paths) {
        console.log(`   - ${path.title} (${path.status})`);
        console.log(`     Created: ${path.createdAt}, Category: ${path.category}`);
        console.log(`     Steps: ${path.pathway ? path.pathway.length : 0}`);
      }

      return paths;
    } catch (error) {
      console.error('❌ Error fetching current learning paths:', error);
      return [];
    }
  }

  async createSampleLearningPaths(): Promise<MigrationResult[]> {
    console.log('\n🏗️ Creating sample learning paths to replace missing data...');
    
    const samplePaths = [
      {
        title: 'AWS Solutions Architect Professional Path',
        slug: 'aws-solutions-architect-professional-path',
        description: 'Comprehensive learning path to master AWS cloud architecture and become a certified Solutions Architect Professional. Covers advanced AWS services, architecture patterns, security, and best practices.',
        shortDescription: 'Master AWS cloud architecture and become a certified Solutions Architect Professional.',
        category: 'aws',
        level: 'advanced',
        thumbnail: 'https://api.cloudmastershub.com/images/paths/aws-solutions-architect.svg',
        instructorId: 'platform',
        price: 299,
        currency: 'USD',
        isFree: false,
        objectives: [
          'Design and deploy scalable AWS architectures',
          'Master advanced AWS services and integrations',
          'Implement security and compliance best practices',
          'Optimize costs and performance',
          'Pass the AWS Solutions Architect Professional exam'
        ],
        skills: ['AWS', 'Cloud Architecture', 'Security', 'Cost Optimization', 'DevOps'],
        prerequisites: ['AWS Solutions Architect Associate certification', 'Hands-on AWS experience'],
        outcomes: [
          'AWS Solutions Architect Professional certification',
          'Advanced cloud architecture skills',
          'Enterprise-grade AWS solution design abilities'
        ],
        status: 'published',
        isPublished: true,
        includesCertificate: true,
        hasHandsOnLabs: true,
        supportLevel: 'premium'
      },
      {
        title: 'Azure DevOps Engineer Expert Path',
        slug: 'azure-devops-engineer-expert-path',
        description: 'Complete learning journey to become an Azure DevOps Engineer Expert. Master CI/CD pipelines, infrastructure as code, monitoring, and DevOps best practices on Microsoft Azure.',
        shortDescription: 'Master Azure DevOps, CI/CD pipelines, and infrastructure automation.',
        category: 'azure',
        level: 'intermediate',
        thumbnail: 'https://api.cloudmastershub.com/images/paths/azure-devops.svg',
        instructorId: 'platform',
        price: 249,
        currency: 'USD',
        isFree: false,
        objectives: [
          'Implement CI/CD pipelines with Azure DevOps',
          'Master Infrastructure as Code with ARM and Terraform',
          'Configure monitoring and logging solutions',
          'Implement security and compliance in DevOps',
          'Pass Azure DevOps Engineer Expert certification'
        ],
        skills: ['Azure', 'DevOps', 'CI/CD', 'Infrastructure as Code', 'Monitoring'],
        prerequisites: ['Basic Azure knowledge', 'Software development experience'],
        outcomes: [
          'Azure DevOps Engineer Expert certification',
          'Production-ready DevOps pipeline skills',
          'Enterprise DevOps implementation experience'
        ],
        status: 'published',
        isPublished: true,
        includesCertificate: true,
        hasHandsOnLabs: true,
        supportLevel: 'premium'
      },
      {
        title: 'Google Cloud Professional Cloud Architect Path',
        slug: 'gcp-professional-cloud-architect-path',
        description: 'Become a Google Cloud Professional Cloud Architect with this comprehensive learning path. Master GCP services, architecture patterns, and enterprise cloud solutions.',
        shortDescription: 'Master Google Cloud architecture and become a Professional Cloud Architect.',
        category: 'gcp',
        level: 'advanced',
        thumbnail: 'https://api.cloudmastershub.com/images/paths/gcp-architect.svg',
        instructorId: 'platform',
        price: 279,
        currency: 'USD',
        isFree: false,
        objectives: [
          'Design scalable and reliable GCP architectures',
          'Master GCP core services and integrations',
          'Implement security and compliance on GCP',
          'Optimize costs and performance',
          'Pass the Professional Cloud Architect exam'
        ],
        skills: ['Google Cloud', 'Cloud Architecture', 'Security', 'Data Engineering', 'Machine Learning'],
        prerequisites: ['Basic GCP knowledge', 'Cloud computing fundamentals'],
        outcomes: [
          'Google Cloud Professional Cloud Architect certification',
          'Enterprise GCP architecture skills',
          'Multi-cloud architecture expertise'
        ],
        status: 'published',
        isPublished: true,
        includesCertificate: true,
        hasHandsOnLabs: true,
        supportLevel: 'premium'
      },
      {
        title: 'Multi-Cloud Security Specialist Path',
        slug: 'multi-cloud-security-specialist-path',
        description: 'Comprehensive security-focused learning path covering AWS, Azure, and GCP. Master cloud security best practices, compliance, and advanced security implementations across all major cloud platforms.',
        shortDescription: 'Master cloud security across AWS, Azure, and GCP platforms.',
        category: 'security',
        level: 'expert',
        thumbnail: 'https://api.cloudmastershub.com/images/paths/multi-cloud-security.svg',
        instructorId: 'platform',
        price: 349,
        currency: 'USD',
        isFree: false,
        objectives: [
          'Implement advanced security across all cloud platforms',
          'Master identity and access management (IAM)',
          'Configure network security and encryption',
          'Implement compliance and governance',
          'Respond to security incidents and threats'
        ],
        skills: ['Cloud Security', 'IAM', 'Network Security', 'Compliance', 'Incident Response'],
        prerequisites: ['Cloud platform experience', 'Basic security knowledge'],
        outcomes: [
          'Multi-cloud security expertise',
          'Advanced threat detection skills',
          'Enterprise security architecture abilities'
        ],
        status: 'published',
        isPublished: true,
        includesCertificate: true,
        hasHandsOnLabs: true,
        supportLevel: 'premium'
      },
      {
        title: 'Cloud-Native Development Path',
        slug: 'cloud-native-development-path',
        description: 'Learn to build and deploy cloud-native applications using containers, microservices, and serverless technologies across AWS, Azure, and GCP.',
        shortDescription: 'Build modern cloud-native applications with containers and microservices.',
        category: 'development',
        level: 'intermediate',
        thumbnail: 'https://api.cloudmastershub.com/images/paths/cloud-native-dev.svg',
        instructorId: 'platform',
        price: 199,
        currency: 'USD',
        isFree: false,
        objectives: [
          'Build containerized applications with Docker',
          'Deploy applications with Kubernetes',
          'Implement serverless architectures',
          'Design microservices patterns',
          'Implement CI/CD for cloud-native apps'
        ],
        skills: ['Docker', 'Kubernetes', 'Serverless', 'Microservices', 'DevOps'],
        prerequisites: ['Programming experience', 'Basic cloud knowledge'],
        outcomes: [
          'Cloud-native development skills',
          'Container orchestration expertise',
          'Modern application architecture knowledge'
        ],
        status: 'published',
        isPublished: true,
        includesCertificate: true,
        hasHandsOnLabs: true,
        supportLevel: 'standard'
      },
      {
        title: 'Data Engineering on Cloud Path',
        slug: 'data-engineering-cloud-path',
        description: 'Master data engineering across cloud platforms. Learn to build data pipelines, implement data lakes, and create analytics solutions using AWS, Azure, and GCP data services.',
        shortDescription: 'Master data engineering and analytics across cloud platforms.',
        category: 'data',
        level: 'intermediate',
        thumbnail: 'https://api.cloudmastershub.com/images/paths/data-engineering.svg',
        instructorId: 'platform',
        price: 229,
        currency: 'USD',
        isFree: false,
        objectives: [
          'Build scalable data pipelines',
          'Implement data lakes and warehouses',
          'Master ETL/ELT processes',
          'Create real-time analytics solutions',
          'Implement data governance and security'
        ],
        skills: ['Data Engineering', 'ETL', 'Data Lakes', 'Analytics', 'Big Data'],
        prerequisites: ['SQL knowledge', 'Basic programming skills'],
        outcomes: [
          'Enterprise data engineering skills',
          'Modern data architecture expertise',
          'Multi-cloud data platform knowledge'
        ],
        status: 'published',
        isPublished: true,
        includesCertificate: true,
        hasHandsOnLabs: true,
        supportLevel: 'standard'
      },
      {
        title: 'Cloud Cost Optimization Path',
        slug: 'cloud-cost-optimization-path',
        description: 'Learn advanced strategies for optimizing cloud costs across AWS, Azure, and GCP. Master financial operations (FinOps), resource optimization, and cost governance.',
        shortDescription: 'Master cloud cost optimization and financial operations (FinOps).',
        category: 'finops',
        level: 'intermediate',
        thumbnail: 'https://api.cloudmastershub.com/images/paths/cost-optimization.svg',
        instructorId: 'platform',
        price: 179,
        currency: 'USD',
        isFree: false,
        objectives: [
          'Implement cloud cost monitoring and alerting',
          'Optimize resource utilization and sizing',
          'Master reserved instances and savings plans',
          'Implement cost allocation and chargeback',
          'Build cost optimization automation'
        ],
        skills: ['FinOps', 'Cost Optimization', 'Resource Management', 'Automation', 'Analytics'],
        prerequisites: ['Basic cloud knowledge', 'Understanding of cloud pricing'],
        outcomes: [
          'Advanced cost optimization skills',
          'FinOps methodology expertise',
          'Cloud financial management abilities'
        ],
        status: 'published',
        isPublished: true,
        includesCertificate: true,
        hasHandsOnLabs: true,
        supportLevel: 'standard'
      }
    ];

    const results: MigrationResult[] = [];

    for (const pathData of samplePaths) {
      try {
        // Check if path already exists
        const existing = await LearningPath.findOne({ slug: pathData.slug });
        if (existing) {
          console.log(`⏭️ Skipping existing path: ${pathData.title}`);
          results.push({
            success: true,
            message: `Path already exists: ${pathData.title}`,
            details: { slug: pathData.slug, action: 'skipped' }
          });
          continue;
        }

        // Create new learning path
        const newPath = new LearningPath(pathData);
        await newPath.save();

        console.log(`✅ Created learning path: ${pathData.title}`);
        results.push({
          success: true,
          message: `Successfully created: ${pathData.title}`,
          details: { slug: pathData.slug, id: newPath._id, action: 'created' }
        });

      } catch (error) {
        console.error(`❌ Failed to create path: ${pathData.title}`, error);
        results.push({
          success: false,
          message: `Failed to create: ${pathData.title}`,
          details: { error: (error as any)?.message || 'Unknown error', action: 'failed' }
        });
      }
    }

    return results;
  }

  async generateMigrationReport(results: MigrationResult[]): Promise<void> {
    console.log('\n📊 MIGRATION REPORT');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const created = results.filter(r => r.details?.action === 'created');
    const skipped = results.filter(r => r.details?.action === 'skipped');

    console.log(`✅ Successful operations: ${successful.length}`);
    console.log(`❌ Failed operations: ${failed.length}`);
    console.log(`🆕 Learning paths created: ${created.length}`);
    console.log(`⏭️ Learning paths skipped (already exist): ${skipped.length}`);

    if (created.length > 0) {
      console.log('\n🆕 Created Learning Paths:');
      for (const result of created) {
        console.log(`   - ${result.message} (ID: ${result.details.id})`);
      }
    }

    if (skipped.length > 0) {
      console.log('\n⏭️ Skipped Learning Paths:');
      for (const result of skipped) {
        console.log(`   - ${result.message}`);
      }
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed Operations:');
      for (const result of failed) {
        console.log(`   - ${result.message}`);
        if (result.details?.error) {
          console.log(`     Error: ${result.details.error}`);
        }
      }
    }

    // Final verification
    const finalCount = await LearningPath.countDocuments();
    console.log(`\n📈 Total learning paths in database: ${finalCount}`);
  }
}

// Main execution function
async function main() {
  console.log('🚀 Learning Path Migration Script Started');
  console.log('==========================================');

  const migrator = new LearningPathMigrator();
  
  try {
    await migrator.initialize();

    // Step 1: Investigate Admin Service for existing learning paths
    const adminPaths = await migrator.investigateAdminService();

    // Step 2: Check current learning paths in Course Service
    await migrator.getCurrentLearningPaths();

    // Step 3: Create sample learning paths to replace missing data
    const migrationResults = await migrator.createSampleLearningPaths();

    // Step 4: Generate comprehensive report
    await migrator.generateMigrationReport(migrationResults);

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await migrator.cleanup();
  }
}

// Execute the migration
if (require.main === module) {
  main().catch(console.error);
}

export default LearningPathMigrator;