const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// MongoDB connection URL
const mongoUrl = process.env.MONGODB_URL || 'mongodb://mongodb:27017/cloudmastershub';

// User Schema matching the user service
const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true
  },
  bio: { 
    type: String,
    maxlength: 500
  },
  avatar: { 
    type: String 
  },
  subscription: { 
    type: String, 
    enum: ['free', 'individual', 'professional', 'enterprise'],
    default: 'free'
  },
  roles: [{ 
    type: String, 
    enum: ['student', 'instructor', 'admin'],
    default: 'student'
  }],
  emailVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  referredBy: String,
  referralDate: Date,
  referralCode: String
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

// Test users to seed
const testUsers = [
  {
    email: 'admin@cloudmastershub.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['admin', 'student'],
    subscription: 'enterprise',
    emailVerified: true,
    isActive: true,
    bio: 'Platform administrator',
    lastLogin: new Date()
  },
  {
    email: 'instructor@cloudmastershub.com',
    firstName: 'Jane',
    lastName: 'Smith',
    roles: ['instructor', 'student'],
    subscription: 'professional',
    emailVerified: true,
    isActive: true,
    bio: 'Cloud computing instructor specializing in AWS and Azure',
    lastLogin: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
  },
  {
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    roles: ['student'],
    subscription: 'individual',
    emailVerified: true,
    isActive: true,
    bio: 'Learning cloud technologies',
    lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    email: 'alice.johnson@example.com',
    firstName: 'Alice',
    lastName: 'Johnson',
    roles: ['student'],
    subscription: 'free',
    emailVerified: true,
    isActive: true,
    lastLogin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
  },
  {
    email: 'bob.wilson@example.com',
    firstName: 'Bob',
    lastName: 'Wilson',
    roles: ['student'],
    subscription: 'free',
    emailVerified: false,
    isActive: true
  },
  {
    email: 'suspended.user@example.com',
    firstName: 'Suspended',
    lastName: 'Account',
    roles: ['student'],
    subscription: 'free',
    emailVerified: true,
    isActive: false,
    bio: 'This account has been suspended'
  }
];

async function seedUsers() {
  try {
    console.log('Connecting to MongoDB:', mongoUrl);
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB successfully');
    
    // Check existing users
    const existingCount = await User.countDocuments();
    console.log(`\nExisting users in database: ${existingCount}`);
    
    // Seed test users
    console.log('\nSeeding test users...');
    let seededCount = 0;
    let skippedCount = 0;
    
    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const exists = await User.findOne({ email: userData.email });
        if (exists) {
          console.log(`  ⏭️  Skipping ${userData.email} (already exists)`);
          skippedCount++;
          continue;
        }
        
        // Create new user
        const user = new User(userData);
        await user.save();
        console.log(`  ✅ Created ${userData.email} (${userData.roles.join(', ')})`);
        seededCount++;
      } catch (error) {
        console.error(`  ❌ Failed to create ${userData.email}:`, error.message);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Seeded: ${seededCount} users`);
    console.log(`  - Skipped: ${skippedCount} users (already existed)`);
    
    // Get final count
    const finalCount = await User.countDocuments();
    console.log(`  - Total users in database: ${finalCount}`);
    
    // Display user distribution
    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: '$subscription',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📈 Users by subscription:');
    subscriptionStats.forEach(stat => {
      console.log(`  - ${stat._id}: ${stat.count} users`);
    });
    
    const roleStats = await User.aggregate([
      { $unwind: '$roles' },
      {
        $group: {
          _id: '$roles',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n👥 Users by role:');
    roleStats.forEach(stat => {
      console.log(`  - ${stat._id}: ${stat.count} users`);
    });
    
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run the seeding
seedUsers();