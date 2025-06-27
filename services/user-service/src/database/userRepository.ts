import { db, PoolClient } from './connection';
import logger from '../utils/logger';

// Database types matching the schema
export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  profile_picture?: string;
  roles: string[]; // Array of roles: 'student', 'instructor', 'admin'
  subscription_type: 'free' | 'premium' | 'premium_plus' | 'enterprise';
  subscription_expires_at?: Date;
  email_verified: boolean;
  email_verification_token?: string;
  password_reset_token?: string;
  password_reset_expires?: Date;
  last_login_at?: Date;
  login_attempts: number;
  locked_until?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserProgressRecord {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  completed: boolean;
  completion_percentage: number;
  time_spent_seconds: number;
  last_accessed_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserAnalyticsRecord {
  id: string;
  user_id: string;
  event_type: string;
  event_data?: Record<string, any>;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  revoked_at?: Date;
  created_at: Date;
}

// Input types for creating/updating users
export interface CreateUserInput {
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  profile_picture?: string;
  roles?: string[]; // Default to ['student'] if not provided
  subscription_type?: 'free' | 'premium' | 'premium_plus' | 'enterprise';
  email_verified?: boolean;
}

export interface UpdateUserInput {
  email?: string;
  password_hash?: string;
  first_name?: string;
  last_name?: string;
  profile_picture?: string;
  roles?: string[]; // Array of roles
  subscription_type?: 'free' | 'premium' | 'premium_plus' | 'enterprise';
  subscription_expires_at?: Date;
  email_verified?: boolean;
  email_verification_token?: string;
  password_reset_token?: string;
  password_reset_expires?: Date;
  last_login_at?: Date;
  login_attempts?: number;
  locked_until?: Date;
}

export interface CreateProgressInput {
  user_id: string;
  course_id: string;
  lesson_id: string;
  completed?: boolean;
  completion_percentage?: number;
  time_spent_seconds?: number;
  last_accessed_at?: Date;
  completed_at?: Date;
}

export interface UpdateProgressInput {
  completed?: boolean;
  completion_percentage?: number;
  time_spent_seconds?: number;
  last_accessed_at?: Date;
  completed_at?: Date;
}

export class UserRepository {
  /**
   * Create a new user
   */
  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const query = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, profile_picture, 
        roles, subscription_type, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      input.email,
      input.password_hash,
      input.first_name,
      input.last_name,
      input.profile_picture,
      input.roles || ['student'],
      input.subscription_type || 'free',
      input.email_verified || false
    ];

    try {
      const result = await db.query<UserRecord>(query, values);
      logger.info('User created in database', { 
        userId: result.rows[0].id, 
        email: result.rows[0].email 
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create user in database', { error, email: input.email });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserRecord | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    
    try {
      const result = await db.query<UserRecord>(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get user by ID', { error, userId });
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    
    try {
      const result = await db.query<UserRecord>(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get user by email', { error, email });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, input: UpdateUserInput): Promise<UserRecord | null> {
    const fields = Object.keys(input).filter(key => input[key as keyof UpdateUserInput] !== undefined);
    
    if (fields.length === 0) {
      return this.getUserById(userId);
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`;
    const values = [userId, ...fields.map(field => input[field as keyof UpdateUserInput])];

    try {
      const result = await db.query<UserRecord>(query, values);
      logger.info('User updated in database', { 
        userId, 
        updatedFields: fields 
      });
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to update user', { error, userId, fields });
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    
    try {
      const result = await db.query(query, [userId]);
      const deleted = (result.rowCount || 0) > 0;
      logger.info('User deleted from database', { userId, deleted });
      return deleted;
    } catch (error) {
      logger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  /**
   * Get users with pagination and filters
   */
  async getUsers(options: {
    limit?: number;
    offset?: number;
    subscription_type?: string;
    email_verified?: boolean;
    search?: string;
  } = {}): Promise<{ users: UserRecord[]; total: number }> {
    const { limit = 20, offset = 0, subscription_type, email_verified, search } = options;
    
    let whereConditions: string[] = [];
    let values: any[] = [];
    let paramCount = 0;

    if (subscription_type) {
      whereConditions.push(`subscription_type = $${++paramCount}`);
      values.push(subscription_type);
    }

    if (email_verified !== undefined) {
      whereConditions.push(`email_verified = $${++paramCount}`);
      values.push(email_verified);
    }

    if (search) {
      whereConditions.push(`(first_name ILIKE $${++paramCount} OR last_name ILIKE $${++paramCount} OR email ILIKE $${++paramCount})`);
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern, searchPattern);
      paramCount += 2; // We added 3 params but only incremented once
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM users 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    values.push(limit, offset);

    try {
      const result = await db.query<UserRecord>(dataQuery, values);
      return { users: result.rows, total };
    } catch (error) {
      logger.error('Failed to get users', { error, options });
      throw error;
    }
  }

  /**
   * Get users with active subscriptions
   */
  async getUsersWithActiveSubscriptions(): Promise<UserRecord[]> {
    const query = `
      SELECT * FROM users 
      WHERE subscription_type IN ('premium', 'enterprise')
      AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW())
      ORDER BY created_at DESC
    `;

    try {
      const result = await db.query<UserRecord>(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get users with active subscriptions', { error });
      throw error;
    }
  }

  /**
   * Create or update user progress
   */
  async upsertUserProgress(input: CreateProgressInput): Promise<UserProgressRecord> {
    const query = `
      INSERT INTO user_progress (
        user_id, course_id, lesson_id, completed, completion_percentage, 
        time_spent_seconds, last_accessed_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, course_id, lesson_id) 
      DO UPDATE SET
        completed = EXCLUDED.completed,
        completion_percentage = EXCLUDED.completion_percentage,
        time_spent_seconds = EXCLUDED.time_spent_seconds,
        last_accessed_at = EXCLUDED.last_accessed_at,
        completed_at = EXCLUDED.completed_at,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      input.user_id,
      input.course_id,
      input.lesson_id,
      input.completed || false,
      input.completion_percentage || 0,
      input.time_spent_seconds || 0,
      input.last_accessed_at || new Date(),
      input.completed_at
    ];

    // First, ensure the constraint exists
    await this.ensureProgressConstraint();

    try {
      const result = await db.query<UserProgressRecord>(query, values);
      logger.info('User progress updated', { 
        userId: input.user_id, 
        courseId: input.course_id, 
        lessonId: input.lesson_id 
      });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to upsert user progress', { error, input });
      throw error;
    }
  }

  /**
   * Ensure unique constraint exists for user progress
   */
  private async ensureProgressConstraint(): Promise<void> {
    const query = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'user_progress_unique_constraint'
        ) THEN
          ALTER TABLE user_progress 
          ADD CONSTRAINT user_progress_unique_constraint 
          UNIQUE (user_id, course_id, lesson_id);
        END IF;
      END $$;
    `;

    try {
      await db.query(query);
    } catch (error) {
      logger.warn('Failed to ensure progress constraint', { error });
    }
  }

  /**
   * Get user progress for a course
   */
  async getUserCourseProgress(userId: string, courseId: string): Promise<UserProgressRecord[]> {
    const query = `
      SELECT * FROM user_progress 
      WHERE user_id = $1 AND course_id = $2
      ORDER BY created_at ASC
    `;

    try {
      const result = await db.query<UserProgressRecord>(query, [userId, courseId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get user course progress', { error, userId, courseId });
      throw error;
    }
  }

  /**
   * Track user analytics event
   */
  async trackAnalyticsEvent(input: {
    user_id: string;
    event_type: string;
    event_data?: Record<string, any>;
    session_id?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<UserAnalyticsRecord> {
    const query = `
      INSERT INTO user_analytics (
        user_id, event_type, event_data, session_id, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      input.user_id,
      input.event_type,
      input.event_data ? JSON.stringify(input.event_data) : null,
      input.session_id,
      input.ip_address,
      input.user_agent
    ];

    try {
      const result = await db.query<UserAnalyticsRecord>(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to track analytics event', { error, input });
      throw error;
    }
  }

  /**
   * Store refresh token
   */
  async storeRefreshToken(input: {
    user_id: string;
    token_hash: string;
    expires_at: Date;
  }): Promise<RefreshTokenRecord> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    try {
      const result = await db.query<RefreshTokenRecord>(query, [
        input.user_id,
        input.token_hash,
        input.expires_at
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to store refresh token', { error, userId: input.user_id });
      throw error;
    }
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const query = 'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND NOT revoked AND expires_at > NOW()';
    
    try {
      const result = await db.query<RefreshTokenRecord>(query, [tokenHash]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get refresh token', { error });
      throw error;
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(tokenHash: string): Promise<boolean> {
    const query = 'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE token_hash = $1';
    
    try {
      const result = await db.query(query, [tokenHash]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logger.error('Failed to revoke refresh token', { error });
      throw error;
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const query = 'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true';
    
    try {
      const result = await db.query(query);
      const deletedCount = result.rowCount || 0;
      logger.info('Cleaned up expired refresh tokens', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', { error });
      throw error;
    }
  }

  /**
   * Grant admin privileges to a user by email
   */
  async grantAdminPrivileges(email: string): Promise<UserRecord | null> {
    const query = `
      UPDATE users 
      SET roles = CASE 
        WHEN 'admin' = ANY(roles) THEN roles
        ELSE array_append(roles, 'admin')
      END,
      subscription_type = 'enterprise',
      email_verified = true,
      updated_at = CURRENT_TIMESTAMP
      WHERE email = $1
      RETURNING *
    `;

    try {
      const result = await db.query<UserRecord>(query, [email]);
      const user = result.rows[0] || null;
      
      if (user) {
        logger.info('Admin privileges granted to user', { 
          userId: user.id, 
          email: user.email,
          roles: user.roles 
        });
      } else {
        logger.warn('User not found for admin privileges grant', { email });
      }
      
      return user;
    } catch (error) {
      logger.error('Failed to grant admin privileges', { error, email });
      throw error;
    }
  }

  /**
   * Add role to user
   */
  async addUserRole(userId: string, role: string): Promise<UserRecord | null> {
    const validRoles = ['student', 'instructor', 'admin'];
    
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
    }

    const query = `
      UPDATE users 
      SET roles = CASE 
        WHEN $2 = ANY(roles) THEN roles
        ELSE array_append(roles, $2)
      END,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await db.query<UserRecord>(query, [userId, role]);
      const user = result.rows[0] || null;
      
      if (user) {
        logger.info('Role added to user', { 
          userId: user.id, 
          email: user.email,
          addedRole: role,
          roles: user.roles 
        });
      }
      
      return user;
    } catch (error) {
      logger.error('Failed to add role to user', { error, userId, role });
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeUserRole(userId: string, role: string): Promise<UserRecord | null> {
    const query = `
      UPDATE users 
      SET roles = array_remove(roles, $2),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await db.query<UserRecord>(query, [userId, role]);
      const user = result.rows[0] || null;
      
      if (user) {
        logger.info('Role removed from user', { 
          userId: user.id, 
          email: user.email,
          removedRole: role,
          roles: user.roles 
        });
      }
      
      return user;
    } catch (error) {
      logger.error('Failed to remove role from user', { error, userId, role });
      throw error;
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();