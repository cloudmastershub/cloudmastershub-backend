import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface SeedUser {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  subscription_type: 'free' | 'premium' | 'enterprise';
  email_verified: boolean;
}

const seedUsers: SeedUser[] = [
  {
    email: 'admin@cloudmastershub.com',
    password: 'CloudMaster2024!',
    first_name: 'Admin',
    last_name: 'User',
    subscription_type: 'enterprise',
    email_verified: true,
  },
  {
    email: 'john.doe@example.com',
    password: 'password123',
    first_name: 'John',
    last_name: 'Doe',
    subscription_type: 'premium',
    email_verified: true,
  },
  {
    email: 'jane.smith@example.com',
    password: 'password123',
    first_name: 'Jane',
    last_name: 'Smith',
    subscription_type: 'free',
    email_verified: true,
  },
  {
    email: 'bob.wilson@example.com',
    password: 'password123',
    first_name: 'Bob',
    last_name: 'Wilson',
    subscription_type: 'premium',
    email_verified: false,
  },
  {
    email: 'alice.johnson@example.com',
    password: 'password123',
    first_name: 'Alice',
    last_name: 'Johnson',
    subscription_type: 'free',
    email_verified: true,
  },
];

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting user database seeding...');
    
    // Check if users already exist
    const existingUsers = await client.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(existingUsers.rows[0].count);
    
    if (userCount > 0) {
      console.log(`ℹ️  Database already has ${userCount} users. Skipping seed.`);
      console.log('   To re-seed, run: npm run db:reset');
      return;
    }
    
    console.log('👤 Creating seed users...');
    
    for (const user of seedUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      
      const result = await client.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, 
          subscription_type, email_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
        RETURNING id, email`,
        [
          user.email,
          passwordHash,
          user.first_name,
          user.last_name,
          user.subscription_type,
          user.email_verified,
        ]
      );
      
      console.log(`✅ Created user: ${result.rows[0].email} (${result.rows[0].id})`);
      
      // Create some sample progress data for premium users
      if (user.subscription_type === 'premium') {
        await client.query(
          `INSERT INTO user_progress (
            user_id, course_id, lesson_id, completed, 
            completion_percentage, time_spent_seconds, 
            created_at, updated_at
          ) VALUES 
          ($1, 'aws-fundamentals', 'intro-to-aws', true, 100, 1800, NOW(), NOW()),
          ($1, 'aws-fundamentals', 'ec2-basics', true, 100, 2400, NOW(), NOW()),
          ($1, 'aws-fundamentals', 's3-storage', false, 45, 1200, NOW(), NOW())`,
          [result.rows[0].id]
        );
        
        console.log(`📊 Created sample progress for user: ${user.email}`);
      }
    }
    
    // Create some sample analytics data
    console.log('📈 Creating sample analytics data...');
    
    const users = await client.query('SELECT id, email FROM users LIMIT 3');
    
    for (const user of users.rows) {
      await client.query(
        `INSERT INTO user_analytics (
          user_id, event_type, event_data, session_id, created_at
        ) VALUES 
        ($1, 'login', '{"source": "web", "device": "desktop"}', 'sess_001', NOW() - INTERVAL '1 day'),
        ($1, 'course_view', '{"course_id": "aws-fundamentals"}', 'sess_001', NOW() - INTERVAL '1 day'),
        ($1, 'lesson_start', '{"course_id": "aws-fundamentals", "lesson_id": "intro-to-aws"}', 'sess_001', NOW() - INTERVAL '1 day'),
        ($1, 'lesson_complete', '{"course_id": "aws-fundamentals", "lesson_id": "intro-to-aws", "duration": 1800}', 'sess_001', NOW() - INTERVAL '1 day')`,
        [user.id]
      );
    }
    
    // Display summary
    const finalCounts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM user_progress) as progress_records,
        (SELECT COUNT(*) FROM user_analytics) as analytics_records
    `);
    
    const counts = finalCounts.rows[0];
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   👥 Users: ${counts.users}`);
    console.log(`   📈 Progress records: ${counts.progress_records}`);
    console.log(`   📊 Analytics records: ${counts.analytics_records}`);
    console.log('\n🔐 Test accounts created:');
    console.log('   📧 admin@cloudmastershub.com (password: CloudMaster2024!)');
    console.log('   📧 john.doe@example.com (password: password123)');
    console.log('   📧 jane.smith@example.com (password: password123)');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeding
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default seedDatabase;