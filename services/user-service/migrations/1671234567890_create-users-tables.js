/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Create users table
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    first_name: { type: 'varchar(100)', notNull: true },
    last_name: { type: 'varchar(100)', notNull: true },
    profile_picture: { type: 'text' },
    subscription_type: { 
      type: 'varchar(20)', 
      notNull: true, 
      default: 'free',
      check: "subscription_type IN ('free', 'premium', 'enterprise')"
    },
    subscription_expires_at: { type: 'timestamp' },
    email_verified: { type: 'boolean', default: false },
    email_verification_token: { type: 'varchar(255)' },
    password_reset_token: { type: 'varchar(255)' },
    password_reset_expires: { type: 'timestamp' },
    last_login_at: { type: 'timestamp' },
    login_attempts: { type: 'integer', default: 0 },
    locked_until: { type: 'timestamp' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  // Create user_progress table
  pgm.createTable('user_progress', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    course_id: { type: 'varchar(50)', notNull: true },
    lesson_id: { type: 'varchar(50)', notNull: true },
    completed: { type: 'boolean', default: false },
    completion_percentage: { type: 'integer', default: 0, check: 'completion_percentage >= 0 AND completion_percentage <= 100' },
    time_spent_seconds: { type: 'integer', default: 0 },
    last_accessed_at: { type: 'timestamp' },
    completed_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  // Create user_analytics table
  pgm.createTable('user_analytics', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    event_type: { type: 'varchar(50)', notNull: true },
    event_data: { type: 'jsonb' },
    session_id: { type: 'varchar(255)' },
    ip_address: { type: 'inet' },
    user_agent: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  // Create refresh_tokens table
  pgm.createTable('refresh_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE'
    },
    token_hash: { type: 'varchar(255)', notNull: true, unique: true },
    expires_at: { type: 'timestamp', notNull: true },
    revoked: { type: 'boolean', default: false },
    revoked_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', default: pgm.func('current_timestamp') }
  });

  // Create indexes for better performance
  pgm.createIndex('users', 'email');
  pgm.createIndex('user_progress', 'user_id');
  pgm.createIndex('user_progress', 'course_id');
  pgm.createIndex('user_progress', ['user_id', 'course_id']);
  pgm.createIndex('user_analytics', 'user_id');
  pgm.createIndex('user_analytics', 'event_type');
  pgm.createIndex('user_analytics', 'created_at');
  pgm.createIndex('refresh_tokens', 'user_id');
  pgm.createIndex('refresh_tokens', 'expires_at');
  pgm.createIndex('refresh_tokens', 'token_hash');

  // Create updated_at trigger function
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Add triggers for updated_at
  pgm.sql('CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();');
  pgm.sql('CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();');
};

exports.down = pgm => {
  // Drop triggers
  pgm.sql('DROP TRIGGER IF EXISTS update_users_updated_at ON users;');
  pgm.sql('DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;');
  
  // Drop function
  pgm.sql('DROP FUNCTION IF EXISTS update_updated_at_column();');
  
  // Drop tables (in reverse order due to foreign keys)
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('user_analytics');
  pgm.dropTable('user_progress');
  pgm.dropTable('users');
};