const mongoose = require('mongoose');

// MongoDB connection string - using the same as in the backend services
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudmastershub';

// User Schema (simplified version matching the user service)
const userSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  roles: [String],
  subscription: String,
  isActive: { type: Boolean, default: true },
  emailVerified: { type: Boolean, default: false },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

async function checkUsers() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('URI:', MONGODB_URI);
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB successfully!\n');
    
    // Get total user count
    const totalCount = await User.countDocuments();
    console.log(`Total users in database: ${totalCount}`);
    
    // Get users grouped by subscription
    const subscriptionCounts = await User.aggregate([
      {
        $group: {
          _id: '$subscription',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\nUsers by subscription tier:');
    subscriptionCounts.forEach(item => {
      console.log(`  ${item._id || 'null/free'}: ${item.count} users`);
    });
    
    // Get users grouped by role
    const roleCounts = await User.aggregate([
      { $unwind: { path: '$roles', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$roles',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\nUsers by role:');
    roleCounts.forEach(item => {
      console.log(`  ${item._id || 'no role'}: ${item.count} users`);
    });
    
    // Get sample of users (first 5)
    const sampleUsers = await User.find()
      .select('email firstName lastName roles subscription isActive createdAt')
      .limit(5)
      .lean();
    
    console.log('\nSample users (first 5):');
    sampleUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. Email: ${user.email}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Roles: ${user.roles?.join(', ') || 'none'}`);
      console.log(`   Subscription: ${user.subscription || 'null/free'}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Created: ${user.createdAt}`);
    });
    
    // Check for recent users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });
    
    console.log(`\nUsers created in last 7 days: ${recentUsers}`);
    
    // Check active vs inactive users
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    console.log(`\nActive users: ${activeUsers}`);
    console.log(`Inactive users: ${inactiveUsers}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed.');
  }
}

// Run the check
checkUsers();