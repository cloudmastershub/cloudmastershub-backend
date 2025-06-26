#!/usr/bin/env node

/**
 * CloudMastersHub Payment Service Database Setup Script
 * 
 * This script sets up the payment service database by running migrations
 * and seeding initial data.
 * 
 * Usage:
 *   node scripts/setup-database.js
 *   
 * Environment Variables:
 *   DATABASE_URL or individual vars (POSTGRES_HOST, POSTGRES_PORT, etc.)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }

  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'cloudmastershub',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
};

// Read SQL file
const readSqlFile = (filename) => {
  const filePath = path.join(__dirname, '..', 'migrations', filename);
  return fs.readFileSync(filePath, 'utf8');
};

// Execute SQL with error handling
const executeSql = async (pool, sql, description) => {
  try {
    console.log(`Executing: ${description}...`);
    await pool.query(sql);
    console.log(`✅ Success: ${description}`);
  } catch (error) {
    console.error(`❌ Error: ${description}`);
    console.error(error.message);
    throw error;
  }
};

// Main setup function
const setupDatabase = async () => {
  let pool;
  
  try {
    console.log('🚀 Starting Payment Service Database Setup...\n');
    
    // Create database connection
    const dbConfig = getDbConfig();
    pool = new Pool(dbConfig);
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established\n');
    
    // Run migrations in order
    const migrations = [
      {
        file: '001_create_payment_tables.sql',
        description: 'Creating payment service tables and indexes'
      },
      {
        file: '002_seed_subscription_plans.sql',
        description: 'Seeding default subscription plans'
      }
    ];
    
    for (const migration of migrations) {
      const sql = readSqlFile(migration.file);
      await executeSql(pool, sql, migration.description);
    }
    
    // Verify setup by counting tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'subscription_plans', 
        'subscriptions', 
        'payments', 
        'payment_methods', 
        'purchases', 
        'user_access', 
        'invoices'
      )
      ORDER BY table_name
    `);
    
    console.log(`\n✅ Setup complete! Created ${result.rows.length} tables:`);
    result.rows.forEach(row => {
      console.log(`   📊 ${row.table_name}`);
    });
    
    // Show subscription plans
    const plansResult = await pool.query('SELECT name, price, interval FROM subscription_plans ORDER BY price');
    console.log(`\n📋 Default subscription plans:`);
    plansResult.rows.forEach(plan => {
      const price = plan.price == 0 ? 'Free' : `$${plan.price}/${plan.interval}`;
      console.log(`   💳 ${plan.name}: ${price}`);
    });
    
    console.log(`\n🎉 Payment Service database setup completed successfully!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Set up Stripe webhook endpoints`);
    console.log(`   2. Create Stripe products and prices`);
    console.log(`   3. Update subscription plans with Stripe price IDs`);
    console.log(`   4. Test the payment service endpoints`);
    
  } catch (error) {
    console.error('\n❌ Database setup failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
};

// Run if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };