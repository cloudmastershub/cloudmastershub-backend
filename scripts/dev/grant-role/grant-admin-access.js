// Grant Admin Access Script
// Run this in your browser console on cloudmastershub.com

console.log('🔧 Granting admin access to mbuaku@gmail.com...');

// First, let's check current user data
const currentUserStorage = localStorage.getItem('user-storage');
console.log('Current user storage:', currentUserStorage);

// Create admin user data
const adminUserData = {
  state: {
    user: {
      id: 'admin-user-1',
      email: 'mbuaku@gmail.com',
      firstName: 'Admin',
      lastName: 'User',
      avatar: '',
      bio: 'System Administrator',
      roles: ['student', 'instructor', 'admin'],
      subscriptionTier: 'enterprise',
      status: 'active',
      permissions: [
        'manage_users',
        'moderate_content', 
        'view_analytics',
        'manage_settings',
        'manage_payments',
        'system_admin'
      ],
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    isAuthenticated: true,
    loading: false,
    error: null
  },
  version: 0
};

// Update localStorage
localStorage.setItem('user-storage', JSON.stringify(adminUserData));

// Also set auth token
localStorage.setItem('auth-token', 'admin-token-' + Date.now());

// Set user data for middleware
const middlewareUserData = {
  id: 'admin-user-1',
  email: 'mbuaku@gmail.com',
  firstName: 'Admin',
  lastName: 'User',
  roles: ['student', 'instructor', 'admin'],
  subscriptionTier: 'enterprise',
  status: 'active'
};

document.cookie = `user-middleware-data=${encodeURIComponent(JSON.stringify(middlewareUserData))}; path=/; max-age=86400`;

console.log('✅ Admin access granted!');
console.log('📋 You now have access to:');
console.log('  - /dashboard (Student access)');
console.log('  - /instructor (Instructor access)');
console.log('  - /admin/* (Admin access)');
console.log('');
console.log('🔄 Please refresh the page to see the changes.');
console.log('🌐 You can now visit:');
console.log('  - https://cloudmastershub.com/admin');
console.log('  - https://cloudmastershub.com/instructor');