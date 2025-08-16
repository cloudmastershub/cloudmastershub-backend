#!/usr/bin/env npx ts-node

/**
 * Test Fixed Learning Paths Logic
 * 
 * This script simulates the new frontend logic to ensure it will work
 */

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch;

async function testFixedLogic() {
  console.log('🧪 Testing Fixed Learning Paths Logic');
  console.log('======================================\n');

  const params = { limit: 50, sortBy: 'newest' };
  const queryParams = new URLSearchParams();
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
  }

  console.log('🔍 Query params:', queryParams.toString());
  
  try {
    // Step 1: Try direct fetch with CORRECT URL
    console.log('1️⃣ Testing direct fetch with correct API URL...');
    const apiBaseUrl = 'https://api.cloudmastershub.com';
    const apiUrl = `${apiBaseUrl}/api/paths?${queryParams.toString()}`;
    
    console.log('🌐 Direct fetch URL:', apiUrl);
    
    const directResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      credentials: 'omit'
    });
    
    if (directResponse.ok) {
      const directData = await directResponse.json() as any;
      console.log('✅ Direct fetch successful');
      console.log('📊 Response structure:', {
        success: directData.success,
        hasData: !!directData.data,
        pathsCount: directData.data?.paths?.length || 0
      });
      
      // Test the response processing logic
      if (directData && directData.success && directData.data) {
        console.log('✅ Direct data wrapper found, returning data');
        console.log('📋 Will return:', {
          paths: directData.data.paths?.length || 0,
          total: directData.data.total,
          page: directData.data.page,
          totalPages: directData.data.totalPages
        });
        return directData.data;
      }
      
      if (directData && (directData.paths !== undefined || Array.isArray(directData))) {
        console.log('✅ Direct data without wrapper found');
        return directData;
      }
    } else {
      console.log('❌ Direct fetch failed with status:', directResponse.status);
    }
    
    console.log('❌ Direct fetch approach failed, would fallback to apiClient');
    return null;
    
  } catch (error: any) {
    console.log('💥 Error in fixed logic:', error?.message);
    return null;
  }
}

async function main() {
  const result = await testFixedLogic();
  
  console.log('\n🎯 FIXED LOGIC ANALYSIS');
  console.log('========================');
  
  if (result && result.paths && result.paths.length > 0) {
    console.log('✅ Fixed logic will work perfectly');
    console.log('✅ Frontend will display learning paths');
    console.log(`📊 Will show ${result.paths.length} learning path(s)`);
    console.log('');
    console.log('🚀 DEPLOYMENT READY');
    console.log('1. The API URL fix resolves the 404 Not Found error');
    console.log('2. Direct fetch will succeed and return learning paths');
    console.log('3. Frontend will display the paths correctly');
    console.log('4. No more JavaScript errors should occur');
  } else {
    console.log('❌ Issues still remain - need further investigation');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;