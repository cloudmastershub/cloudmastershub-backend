#!/usr/bin/env npx ts-node

/**
 * Test Frontend API Integration
 * 
 * This script tests the learning paths API from the frontend perspective
 */

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch;

const API_BASE = 'https://api.cloudmastershub.com/api';

async function testLearningPathsAPI() {
  console.log('🔍 Testing Learning Paths API Integration');
  console.log('=========================================\n');

  try {
    console.log('📡 Making request to:', `${API_BASE}/paths`);
    
    const response = await fetch(`${API_BASE}/paths`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('📋 Response Headers:');
    response.headers.forEach((value, key) => {
      console.log(`   ${key}: ${value}`);
    });

    const rawText = await response.text();
    console.log('\n📄 Raw Response (first 500 chars):');
    console.log(rawText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(rawText);
      console.log('\n✅ Valid JSON Response');
    } catch (parseError) {
      console.log('\n❌ Invalid JSON Response');
      console.log('Parse Error:', parseError);
      return;
    }

    console.log('\n🔍 Response Structure Analysis:');
    console.log('Response type:', typeof data);
    console.log('Response keys:', Object.keys(data));

    if (data.success !== undefined) {
      console.log('✅ Has success field:', data.success);
    }

    if (data.data) {
      console.log('✅ Has data field:', typeof data.data);
      console.log('Data keys:', Object.keys(data.data));

      if (data.data.paths) {
        console.log('✅ Has paths array:', Array.isArray(data.data.paths));
        console.log('📊 Number of paths:', data.data.paths.length);
        
        if (data.data.paths.length > 0) {
          console.log('\n📝 First Learning Path Details:');
          const firstPath = data.data.paths[0];
          console.log('   ID:', firstPath._id || firstPath.id);
          console.log('   Title:', firstPath.title);
          console.log('   Category:', firstPath.category);
          console.log('   Level:', firstPath.level);
          console.log('   Status:', firstPath.status);
          console.log('   Published:', firstPath.isPublished);
          console.log('   Total Steps:', firstPath.totalSteps);
          console.log('   Total Courses:', firstPath.totalCourses);
          console.log('   Total Labs:', firstPath.totalLabs);
          console.log('   Estimated Duration:', firstPath.estimatedDurationHours);
          console.log('   Price:', firstPath.price);
          console.log('   Is Free:', firstPath.isFree);
          console.log('   Tags:', firstPath.tags?.slice(0, 5));
        }

        if (data.data.total !== undefined) {
          console.log('📊 Total count:', data.data.total);
        }
        if (data.data.page !== undefined) {
          console.log('📄 Current page:', data.data.page);
        }
        if (data.data.totalPages !== undefined) {
          console.log('📚 Total pages:', data.data.totalPages);
        }
      } else {
        console.log('❌ No paths array found in data');
      }
    } else {
      console.log('❌ No data field found');
    }

    console.log('\n🎯 Frontend Integration Assessment:');
    
    if (data.success && data.data && data.data.paths && Array.isArray(data.data.paths)) {
      console.log('✅ Response structure matches frontend expectations');
      console.log('✅ Frontend should be able to process this response');
      
      if (data.data.paths.length === 0) {
        console.log('⚠️ No learning paths returned - empty state will show');
      } else if (data.data.paths.length === 1) {
        console.log('⚠️ Only 1 learning path returned - may look sparse');
        console.log('💡 Consider adding more learning paths for better UX');
      } else {
        console.log('✅ Multiple learning paths returned - good UX');
      }
    } else {
      console.log('❌ Response structure does NOT match frontend expectations');
      console.log('🔧 Frontend may not display paths correctly');
    }

  } catch (error: any) {
    console.error('💥 Error testing API:', error?.message || 'Unknown error');
  }
}

// Test individual path endpoint
async function testIndividualPath() {
  console.log('\n🔍 Testing Individual Path Endpoint');
  console.log('===================================\n');

  try {
    const response = await fetch(`${API_BASE}/paths/kubernetes-specialist-learning-path`);
    console.log('📊 Response Status:', response.status, response.statusText);

    if (response.status === 500) {
      console.log('❌ Individual path endpoint returning 500 error');
      console.log('🔧 This explains why the verification script showed failures');
      
      const errorText = await response.text();
      console.log('Error response:', errorText.substring(0, 200));
    } else {
      const data = await response.json() as any;
      console.log('✅ Individual path endpoint working');
      console.log('Path title:', data.data?.title || data.title);
    }
  } catch (error: any) {
    console.error('💥 Error testing individual path:', error?.message || 'Unknown error');
  }
}

async function main() {
  await testLearningPathsAPI();
  await testIndividualPath();
  
  console.log('\n🎯 SUMMARY & RECOMMENDATIONS');
  console.log('============================');
  console.log('1. Check https://cloudmastershub.com/paths to see current display');
  console.log('2. If showing "No Learning Paths Available", there may be a frontend issue');
  console.log('3. If showing 1 path, that\'s correct but could use more paths');
  console.log('4. Individual path endpoint (500 error) needs fixing in Course Service');
  console.log('5. Consider adding more learning paths via admin interface');
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;