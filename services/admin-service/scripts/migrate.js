#!/usr/bin/env node

const { Pool } = require('pg');
const { readFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');

class SimpleMigrator {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://cloudmasters:cloudmasters123@localhost:5432/cloudmastershub?sslmode=disable',
      ssl: false
    });
    this.migrationsPath = join(__dirname, '../migrations');
  }

  async createMigrationsTable() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✓ Admin migrations table ensured');
    } catch (error) {
      console.error('✗ Error creating migrations table:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async getExecutedMigrations() {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT name FROM admin_migrations ORDER BY id ASC'
      );
      return result.rows.map(row => row.name);
    } catch (error) {
      console.error('✗ Error fetching executed migrations:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async executeMigration(migrationName) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const migrationPath = join(this.migrationsPath, migrationName);
      if (!existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
      }

      const migrationSql = readFileSync(migrationPath, 'utf8');

      console.log(`🔄 Executing migration: ${migrationName}`);
      
      // Execute the migration SQL
      await client.query(migrationSql);

      // Record the migration as executed
      await client.query(
        'INSERT INTO admin_migrations (name) VALUES ($1)',
        [migrationName]
      );

      await client.query('COMMIT');
      console.log(`✓ Migration completed: ${migrationName}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✗ Migration failed: ${migrationName}`, error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async runMigrations() {
    try {
      console.log('🚀 Starting admin service database migrations...');
      
      await this.createMigrationsTable();
      
      if (!existsSync(this.migrationsPath)) {
        console.log(`✗ Migrations directory not found: ${this.migrationsPath}`);
        return;
      }

      const migrationFiles = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      if (migrationFiles.length === 0) {
        console.log('ℹ️ No migration files found');
        return;
      }

      const executedMigrations = await this.getExecutedMigrations();
      const executedSet = new Set(executedMigrations);

      const pendingMigrations = migrationFiles.filter(file => !executedSet.has(file));
      
      if (pendingMigrations.length === 0) {
        console.log('✓ No pending admin migrations');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending admin migrations:`);
      pendingMigrations.forEach(migration => console.log(`  - ${migration}`));
      
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log('🎉 All admin migrations completed successfully!');
    } catch (error) {
      console.error('💥 Migration process failed:', error.message);
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }

  async getStatus() {
    try {
      await this.createMigrationsTable();
      
      if (!existsSync(this.migrationsPath)) {
        console.log(`✗ Migrations directory not found: ${this.migrationsPath}`);
        return;
      }

      const migrationFiles = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      const executedMigrations = await this.getExecutedMigrations();
      const executedSet = new Set(executedMigrations);

      const pendingMigrations = migrationFiles.filter(file => !executedSet.has(file));

      console.log('\n📊 Admin Migration Status:');
      console.log(`  Total migrations: ${migrationFiles.length}`);
      console.log(`  Executed: ${executedMigrations.length}`);
      console.log(`  Pending: ${pendingMigrations.length}`);

      if (executedMigrations.length > 0) {
        console.log('\n✅ Executed migrations:');
        executedMigrations.forEach(migration => console.log(`  - ${migration}`));
      }

      if (pendingMigrations.length > 0) {
        console.log('\n⏳ Pending migrations:');
        pendingMigrations.forEach(migration => console.log(`  - ${migration}`));
      }
    } catch (error) {
      console.error('💥 Status check failed:', error.message);
      process.exit(1);
    } finally {
      await this.pool.end();
    }
  }
}

// CLI handling
const command = process.argv[2];
const migrator = new SimpleMigrator();

switch (command) {
  case 'up':
  case 'migrate':
    migrator.runMigrations();
    break;
  case 'status':
    migrator.getStatus();
    break;
  default:
    console.log(`
Admin Service Database Migrator

Usage:
  node migrate.js up      - Run pending migrations
  node migrate.js status  - Show migration status

Environment Variables:
  DATABASE_URL - PostgreSQL connection string
                 Default: postgresql://cloudmasters:cloudmasters123@localhost:5432/cloudmastershub

Examples:
  node migrate.js up
  DATABASE_URL="postgresql://user:pass@host:5432/db" node migrate.js status
`);
    break;
}