#!/usr/bin/env npx ts-node

/**
 * Test Authenticated vs Public API Access
 * 
 * This script tests whether authentication interferes with public learning paths endpoint
 */

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch;

const API_BASE = 'https://api.cloudmastershub.com/api';

async function testPublicAccess() {
  console.log('🔓 Testing Public Access (No Auth Headers)');
  console.log('==========================================\n');

  try {
    const response = await fetch(`${API_BASE}/paths`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json() as any;
      console.log('✅ Public access successful');
      console.log('📊 Paths returned:', data.data?.paths?.length || 0);
      return { success: true, pathCount: data.data?.paths?.length || 0 };
    } else {
      console.log('❌ Public access failed');
      return { success: false, status: response.status };
    }
  } catch (error: any) {
    console.log('💥 Error in public access:', error?.message);
    return { success: false, error: error?.message };
  }
}

async function testWithAuth() {
  console.log('🔐 Testing With Authentication Headers');
  console.log('=====================================\n');

  // Try with various auth header patterns that might interfere
  const authTests = [
    { name: 'Invalid JWT', header: 'Bearer invalid-token' },
    { name: 'Empty Bearer', header: 'Bearer ' },
    { name: 'Malformed', header: 'InvalidToken' }
  ];

  for (const test of authTests) {
    try {
      console.log(`🧪 Testing: ${test.name}`);
      
      const response = await fetch(`${API_BASE}/paths`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': test.header
        }
      });

      console.log(`   📊 Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json() as any;
        console.log(`   ✅ Auth test passed - Paths: ${data.data?.paths?.length || 0}`);
      } else {
        console.log(`   ❌ Auth test failed`);
        
        // Check if it's an auth error
        if (response.status === 401) {
          console.log(`   🔒 Authentication required - public endpoint should not require auth!`);
        }
      }
    } catch (error: any) {
      console.log(`   💥 Error: ${error?.message}`);
    }
    console.log('');
  }
}

async function testCorsAndOptions() {
  console.log('🌐 Testing CORS and OPTIONS');
  console.log('===========================\n');

  try {
    // Test OPTIONS request
    const optionsResponse = await fetch(`${API_BASE}/paths`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://cloudmastershub.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    console.log('📊 OPTIONS Status:', optionsResponse.status);
    console.log('📋 CORS Headers:');
    optionsResponse.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('access-control')) {
        console.log(`   ${key}: ${value}`);
      }
    });

    // Test with Origin header (simulating frontend request)
    const corsResponse = await fetch(`${API_BASE}/paths`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': 'https://cloudmastershub.com'
      }
    });

    console.log('\n📊 CORS GET Status:', corsResponse.status);
    if (corsResponse.ok) {
      const data = await corsResponse.json() as any;
      console.log('✅ CORS request successful');
      console.log('📊 Paths returned:', data.data?.paths?.length || 0);
    }

  } catch (error: any) {
    console.log('💥 CORS test error:', error?.message);
  }
}

async function main() {
  console.log('🔍 Learning Paths Authentication Analysis');
  console.log('=========================================\n');

  const publicResult = await testPublicAccess();
  await testWithAuth();
  await testCorsAndOptions();

  console.log('\n🎯 DIAGNOSIS AND RECOMMENDATIONS');
  console.log('=================================');
  
  if (publicResult.success && publicResult.pathCount > 0) {
    console.log('✅ API is working correctly for public access');
    console.log('✅ Learning paths are available via API');
    console.log('');
    console.log('🔍 Frontend Issue Likely Causes:');
    console.log('1. Authentication header interference');
    console.log('2. React component state management issue');
    console.log('3. Browser console errors preventing render');
    console.log('4. CSS/styling hiding the content');
    console.log('');
    console.log('🛠️ Debugging Steps:');
    console.log('1. Open https://cloudmastershub.com/paths in browser');
    console.log('2. Open DevTools (F12) → Console tab');
    console.log('3. Look for JavaScript errors or failed network requests');
    console.log('4. Check Network tab for API call to /api/paths');
    console.log('5. Verify response data in network request');
    console.log('');
    console.log('🔧 Potential Fixes:');
    console.log('1. Make /api/paths truly public (no auth required)');
    console.log('2. Fix authentication header handling for public endpoints');
    console.log('3. Add error boundary to catch React rendering errors');
    console.log('4. Improve frontend error handling and logging');
  } else {
    console.log('❌ API has issues that need to be resolved first');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;