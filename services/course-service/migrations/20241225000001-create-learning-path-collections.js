module.exports = {
  async up(db, client) {
    // Create learning_paths collection
    await db.createCollection('learning_paths', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['title', 'description', 'category', 'level', 'instructorId', 'createdAt'],
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
            shortDescription: { 
              bsonType: 'string',
              maxLength: 500
            },
            category: { 
              bsonType: 'string',
              enum: ['aws', 'azure', 'gcp', 'multicloud', 'devops', 'security', 'data', 'architecture']
            },
            level: { 
              bsonType: 'string',
              enum: ['beginner', 'intermediate', 'advanced', 'expert']
            },
            thumbnail: { bsonType: 'string' },
            instructorId: { bsonType: 'string' },
            
            // Pricing
            price: { 
              bsonType: 'double',
              minimum: 0
            },
            originalPrice: { 
              bsonType: 'double',
              minimum: 0
            },
            currency: { 
              bsonType: 'string',
              enum: ['USD', 'EUR', 'GBP']
            },
            isFree: { bsonType: 'bool' },
            
            // Content structure
            totalSteps: { 
              bsonType: 'int',
              minimum: 0
            },
            totalCourses: { 
              bsonType: 'int',
              minimum: 0
            },
            totalLabs: { 
              bsonType: 'int',
              minimum: 0
            },
            estimatedDurationHours: { 
              bsonType: 'double',
              minimum: 0
            },
            
            // Learning outcomes
            objectives: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            skills: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            prerequisites: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            outcomes: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            
            // Engagement and quality
            rating: { 
              bsonType: 'double',
              minimum: 0,
              maximum: 5
            },
            reviewCount: { 
              bsonType: 'int',
              minimum: 0
            },
            enrollmentCount: { 
              bsonType: 'int',
              minimum: 0
            },
            completionRate: { 
              bsonType: 'double',
              minimum: 0,
              maximum: 100
            },
            tags: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            
            // Publishing and status
            status: { 
              bsonType: 'string',
              enum: ['draft', 'under_review', 'published', 'archived']
            },
            isPublished: { bsonType: 'bool' },
            publishedAt: { bsonType: 'date' },
            
            // SEO and metadata
            slug: { 
              bsonType: 'string',
              pattern: '^[a-z0-9-]+$'
            },
            metaDescription: { 
              bsonType: 'string',
              maxLength: 160
            },
            keywords: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            
            // Features
            includesCertificate: { bsonType: 'bool' },
            hasHandsOnLabs: { bsonType: 'bool' },
            supportLevel: { 
              bsonType: 'string',
              enum: ['basic', 'standard', 'premium']
            },
            
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create pathway_steps collection
    await db.createCollection('pathway_steps', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['pathId', 'order', 'type', 'title', 'isRequired', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            pathId: { bsonType: 'objectId' },
            order: { 
              bsonType: 'int',
              minimum: 1
            },
            type: { 
              bsonType: 'string',
              enum: ['course', 'lab', 'milestone', 'assessment', 'project', 'reading', 'video', 'discussion']
            },
            title: { 
              bsonType: 'string',
              minLength: 1,
              maxLength: 200
            },
            description: { 
              bsonType: 'string',
              maxLength: 1000
            },
            
            // Content references
            courseId: { bsonType: 'string' },
            labId: { bsonType: 'string' },
            
            // Step configuration
            isRequired: { bsonType: 'bool' },
            isLocked: { bsonType: 'bool' },
            estimatedTimeMinutes: { 
              bsonType: 'int',
              minimum: 0
            },
            
            // Dependencies and flow
            prerequisites: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            unlocks: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            
            // Content metadata
            difficulty: { 
              bsonType: 'string',
              enum: ['beginner', 'intermediate', 'advanced', 'expert']
            },
            skills: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create learning_path_progress collection
    await db.createCollection('learning_path_progress', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'pathId', 'enrolledAt', 'enrollmentType', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            userId: { bsonType: 'string' },
            pathId: { bsonType: 'objectId' },
            
            // Enrollment details
            enrolledAt: { bsonType: 'date' },
            enrollmentType: { 
              bsonType: 'string',
              enum: ['free', 'purchased', 'subscription']
            },
            
            // Progress tracking
            progress: { 
              bsonType: 'double',
              minimum: 0,
              maximum: 100
            },
            currentStepId: { bsonType: 'string' },
            completedSteps: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            skippedSteps: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            
            // Time tracking
            totalTimeSpentMinutes: { 
              bsonType: 'int',
              minimum: 0
            },
            lastAccessedAt: { bsonType: 'date' },
            estimatedCompletionDate: { bsonType: 'date' },
            
            // Completion
            isCompleted: { bsonType: 'bool' },
            completedAt: { bsonType: 'date' },
            finalScore: { 
              bsonType: 'double',
              minimum: 0,
              maximum: 100
            },
            
            // Learning analytics
            strengths: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            weaknesses: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            recommendedNextPaths: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create learning_path_enrollments collection
    await db.createCollection('learning_path_enrollments', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['pathId', 'userId', 'enrollmentType', 'enrolledAt', 'isActive', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            pathId: { bsonType: 'objectId' },
            userId: { bsonType: 'string' },
            enrollmentType: { 
              bsonType: 'string',
              enum: ['free', 'purchased', 'subscription']
            },
            paymentId: { bsonType: 'string' },
            enrolledAt: { bsonType: 'date' },
            expiresAt: { bsonType: 'date' },
            isActive: { bsonType: 'bool' },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create learning_path_reviews collection
    await db.createCollection('learning_path_reviews', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['pathId', 'userId', 'rating', 'content', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            pathId: { bsonType: 'objectId' },
            userId: { bsonType: 'string' },
            rating: { 
              bsonType: 'int',
              minimum: 1,
              maximum: 5
            },
            title: { 
              bsonType: 'string',
              maxLength: 100
            },
            content: { 
              bsonType: 'string',
              minLength: 1,
              maxLength: 2000
            },
            helpful: { 
              bsonType: 'int',
              minimum: 0
            },
            verified: { bsonType: 'bool' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create pathway_milestones collection
    await db.createCollection('pathway_milestones', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['pathId', 'title', 'order', 'requiredSteps', 'createdAt'],
          properties: {
            _id: { bsonType: 'objectId' },
            pathId: { bsonType: 'objectId' },
            title: { 
              bsonType: 'string',
              minLength: 1,
              maxLength: 200
            },
            description: { 
              bsonType: 'string',
              maxLength: 1000
            },
            order: { 
              bsonType: 'int',
              minimum: 1
            },
            requiredSteps: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            rewards: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                properties: {
                  type: { 
                    bsonType: 'string',
                    enum: ['badge', 'certificate', 'points', 'unlock']
                  },
                  title: { bsonType: 'string' },
                  description: { bsonType: 'string' },
                  iconUrl: { bsonType: 'string' },
                  value: { bsonType: 'int' },
                  unlocksContent: {
                    bsonType: 'array',
                    items: { bsonType: 'string' }
                  }
                }
              }
            },
            completedBy: {
              bsonType: 'array',
              items: { bsonType: 'string' }
            },
            createdAt: { bsonType: 'date' }
          }
        }
      }
    });

    // Create indexes for better performance
    
    // Learning paths indexes
    await db.collection('learning_paths').createIndex({ category: 1 });
    await db.collection('learning_paths').createIndex({ level: 1 });
    await db.collection('learning_paths').createIndex({ instructorId: 1 });
    await db.collection('learning_paths').createIndex({ isPublished: 1 });
    await db.collection('learning_paths').createIndex({ isFree: 1 });
    await db.collection('learning_paths').createIndex({ status: 1 });
    await db.collection('learning_paths').createIndex({ tags: 1 });
    await db.collection('learning_paths').createIndex({ rating: -1 });
    await db.collection('learning_paths').createIndex({ enrollmentCount: -1 });
    await db.collection('learning_paths').createIndex({ createdAt: -1 });
    await db.collection('learning_paths').createIndex({ publishedAt: -1 });
    await db.collection('learning_paths').createIndex({ slug: 1 }, { unique: true });
    await db.collection('learning_paths').createIndex({ title: 'text', description: 'text', shortDescription: 'text' });

    // Pathway steps indexes
    await db.collection('pathway_steps').createIndex({ pathId: 1, order: 1 });
    await db.collection('pathway_steps').createIndex({ pathId: 1 });
    await db.collection('pathway_steps').createIndex({ type: 1 });
    await db.collection('pathway_steps').createIndex({ courseId: 1 });
    await db.collection('pathway_steps').createIndex({ labId: 1 });
    await db.collection('pathway_steps').createIndex({ isRequired: 1 });

    // Learning path progress indexes
    await db.collection('learning_path_progress').createIndex({ userId: 1 });
    await db.collection('learning_path_progress').createIndex({ pathId: 1 });
    await db.collection('learning_path_progress').createIndex({ userId: 1, pathId: 1 }, { unique: true });
    await db.collection('learning_path_progress').createIndex({ enrollmentType: 1 });
    await db.collection('learning_path_progress').createIndex({ isCompleted: 1 });
    await db.collection('learning_path_progress').createIndex({ lastAccessedAt: -1 });
    await db.collection('learning_path_progress').createIndex({ completedAt: -1 });

    // Learning path enrollments indexes
    await db.collection('learning_path_enrollments').createIndex({ userId: 1 });
    await db.collection('learning_path_enrollments').createIndex({ pathId: 1 });
    await db.collection('learning_path_enrollments').createIndex({ userId: 1, pathId: 1 });
    await db.collection('learning_path_enrollments').createIndex({ enrollmentType: 1 });
    await db.collection('learning_path_enrollments').createIndex({ isActive: 1 });
    await db.collection('learning_path_enrollments').createIndex({ paymentId: 1 });
    await db.collection('learning_path_enrollments').createIndex({ enrolledAt: -1 });
    await db.collection('learning_path_enrollments').createIndex({ expiresAt: 1 });

    // Learning path reviews indexes
    await db.collection('learning_path_reviews').createIndex({ pathId: 1 });
    await db.collection('learning_path_reviews').createIndex({ userId: 1 });
    await db.collection('learning_path_reviews').createIndex({ pathId: 1, userId: 1 }, { unique: true });
    await db.collection('learning_path_reviews').createIndex({ rating: 1 });
    await db.collection('learning_path_reviews').createIndex({ verified: 1 });
    await db.collection('learning_path_reviews').createIndex({ createdAt: -1 });
    await db.collection('learning_path_reviews').createIndex({ helpful: -1 });

    // Pathway milestones indexes
    await db.collection('pathway_milestones').createIndex({ pathId: 1, order: 1 });
    await db.collection('pathway_milestones').createIndex({ pathId: 1 });
    await db.collection('pathway_milestones').createIndex({ completedBy: 1 });

    console.log('Learning path collections and indexes created successfully');
  },

  async down(db, client) {
    // Drop collections in reverse order
    await db.dropCollection('pathway_milestones');
    await db.dropCollection('learning_path_reviews');
    await db.dropCollection('learning_path_enrollments');
    await db.dropCollection('learning_path_progress');
    await db.dropCollection('pathway_steps');
    await db.dropCollection('learning_paths');
    
    console.log('Learning path collections dropped successfully');
  }
};