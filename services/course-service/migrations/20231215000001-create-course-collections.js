module.exports = {
  async up(db, client) {
    // Create courses collection
    await db.createCollection('courses', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['title', 'description', 'category', 'difficulty', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            title: { 
              bsonType: 'string',
              minLength: 1,
              maxLength: 200
            },
            description: { 
              bsonType: 'string',
              minLength: 1,
              maxLength: 5000
            },
            category: { 
              bsonType: 'string',
              enum: ['aws', 'azure', 'gcp', 'devops', 'security', 'architecture']
            },
            subcategory: { bsonType: 'string' },
            difficulty: { 
              bsonType: 'string',
              enum: ['beginner', 'intermediate', 'advanced', 'expert']
            },
            duration_minutes: { 
              bsonType: 'int',
              minimum: 0
            },
            prerequisites: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            learning_objectives: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            thumbnail_url: { bsonType: 'string' },
            video_url: { bsonType: 'string' },
            instructor: {
              bsonType: 'object',
              properties: {
                name: { bsonType: 'string' },
                bio: { bsonType: 'string' },
                avatar_url: { bsonType: 'string' }
              }
            },
            price: {
              bsonType: 'object',
              properties: {
                amount: { bsonType: 'double', minimum: 0 },
                currency: { bsonType: 'string', enum: ['USD', 'EUR', 'GBP'] }
              }
            },
            is_published: { bsonType: 'bool' },
            is_free: { bsonType: 'bool' },
            tags: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            rating: {
              bsonType: 'object',
              properties: {
                average: { bsonType: 'double', minimum: 0, maximum: 5 },
                count: { bsonType: 'int', minimum: 0 }
              }
            },
            enrollment_count: { bsonType: 'int', minimum: 0 },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create lessons collection
    await db.createCollection('lessons', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['course_id', 'title', 'order', 'type', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            course_id: { bsonType: 'objectId' },
            title: { 
              bsonType: 'string',
              minLength: 1,
              maxLength: 200
            },
            description: { bsonType: 'string' },
            order: { bsonType: 'int', minimum: 1 },
            type: { 
              bsonType: 'string',
              enum: ['video', 'text', 'quiz', 'lab', 'exercise']
            },
            duration_minutes: { bsonType: 'int', minimum: 0 },
            content: {
              bsonType: 'object',
              properties: {
                video_url: { bsonType: 'string' },
                transcript: { bsonType: 'string' },
                slides_url: { bsonType: 'string' },
                notes: { bsonType: 'string' },
                resources: {
                  bsonType: 'array',
                  items: {
                    bsonType: 'object',
                    properties: {
                      title: { bsonType: 'string' },
                      url: { bsonType: 'string' },
                      type: { bsonType: 'string' }
                    }
                  }
                }
              }
            },
            is_preview: { bsonType: 'bool' },
            is_published: { bsonType: 'bool' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create user_sessions collection (for tracking user interactions)
    await db.createCollection('user_sessions', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['user_id', 'session_type', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            user_id: { bsonType: 'string' },
            course_id: { bsonType: 'objectId' },
            lesson_id: { bsonType: 'objectId' },
            session_type: { 
              bsonType: 'string',
              enum: ['course_view', 'lesson_start', 'lesson_complete', 'quiz_attempt', 'lab_start']
            },
            session_data: { bsonType: 'object' },
            duration_seconds: { bsonType: 'int', minimum: 0 },
            ip_address: { bsonType: 'string' },
            user_agent: { bsonType: 'string' },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create content_versions collection (for version control)
    await db.createCollection('content_versions', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['resource_id', 'resource_type', 'version', 'content', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            resource_id: { bsonType: 'objectId' },
            resource_type: { 
              bsonType: 'string',
              enum: ['course', 'lesson']
            },
            version: { bsonType: 'int', minimum: 1 },
            content: { bsonType: 'object' },
            changes_summary: { bsonType: 'string' },
            created_by: { bsonType: 'string' },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create indexes for better performance
    
    // Courses indexes
    await db.collection('courses').createIndex({ category: 1 });
    await db.collection('courses').createIndex({ difficulty: 1 });
    await db.collection('courses').createIndex({ is_published: 1 });
    await db.collection('courses').createIndex({ is_free: 1 });
    await db.collection('courses').createIndex({ tags: 1 });
    await db.collection('courses').createIndex({ 'rating.average': -1 });
    await db.collection('courses').createIndex({ enrollment_count: -1 });
    await db.collection('courses').createIndex({ createdAt: -1 });
    await db.collection('courses').createIndex({ title: 'text', description: 'text' });

    // Lessons indexes
    await db.collection('lessons').createIndex({ course_id: 1, order: 1 });
    await db.collection('lessons').createIndex({ course_id: 1 });
    await db.collection('lessons').createIndex({ type: 1 });
    await db.collection('lessons').createIndex({ is_published: 1 });

    // User sessions indexes
    await db.collection('user_sessions').createIndex({ user_id: 1 });
    await db.collection('user_sessions').createIndex({ course_id: 1 });
    await db.collection('user_sessions').createIndex({ session_type: 1 });
    await db.collection('user_sessions').createIndex({ createdAt: -1 });
    await db.collection('user_sessions').createIndex({ user_id: 1, createdAt: -1 });

    // Content versions indexes
    await db.collection('content_versions').createIndex({ resource_id: 1, version: -1 });
    await db.collection('content_versions').createIndex({ resource_type: 1 });
    await db.collection('content_versions').createIndex({ created_by: 1 });
    await db.collection('content_versions').createIndex({ createdAt: -1 });

    console.log('Course service collections and indexes created successfully');
  },

  async down(db, client) {
    // Drop collections in reverse order
    await db.dropCollection('content_versions');
    await db.dropCollection('user_sessions');
    await db.dropCollection('lessons');
    await db.dropCollection('courses');
    
    console.log('Course service collections dropped successfully');
  }
};