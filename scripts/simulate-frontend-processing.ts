#!/usr/bin/env npx ts-node

/**
 * Simulate Frontend Processing
 * 
 * This script simulates exactly how the frontend processes the learning paths API response
 */

// Use built-in fetch for Node.js 18+
const fetch = globalThis.fetch;

// Simulate frontend processing logic
const getGradient = (category: string, level: string): string => {
  const gradients: Record<string, string> = {
    'cloud': 'from-blue-500 to-cyan-500',
    'devops': 'from-purple-500 to-pink-500',
    'aws': 'from-orange-500 to-red-500',
    'azure': 'from-blue-500 to-indigo-500',
    'gcp': 'from-green-500 to-teal-500',
    'kubernetes': 'from-indigo-500 to-purple-500',
    'security': 'from-red-500 to-orange-500',
    'beginner': 'from-green-500 to-teal-500',
    'intermediate': 'from-blue-500 to-purple-500',
    'advanced': 'from-purple-500 to-pink-500',
  };
  return gradients[category?.toLowerCase()] || gradients[level] || 'from-gray-500 to-gray-600';
};

const getIcon = (category: string, index: number): string => {
  const categoryIcons: Record<string, string> = {
    'devops': 'Briefcase',
    'cloud': 'Trophy',
    'security': 'CheckCircle',
    'kubernetes': 'Award',
  };
  const fallbackIcons = ['Briefcase', 'Trophy', 'Target', 'TrendingUp', 'Award', 'CheckCircle'];
  return categoryIcons[category?.toLowerCase()] || fallbackIcons[index % fallbackIcons.length];
};

async function simulateFrontendProcessing() {
  console.log('🧪 Simulating Frontend Learning Path Processing');
  console.log('==============================================\n');

  try {
    // Step 1: Fetch API (same as frontend)
    console.log('1️⃣ Fetching data from API...');
    const response = await fetch('https://api.cloudmastershub.com/api/paths?limit=50&sortBy=newest');
    const apiResponse = await response.json() as any;

    console.log('✅ API Response received');
    console.log('Success:', apiResponse.success);
    console.log('Has data:', !!apiResponse.data);
    console.log('Has paths:', !!apiResponse.data?.paths);
    console.log('Paths count:', apiResponse.data?.paths?.length || 0);

    // Step 2: Process response (same as frontend logic)
    console.log('\n2️⃣ Processing response...');
    
    if (apiResponse && apiResponse.paths !== undefined) {
      console.log('✅ Found paths in response:', apiResponse.paths.length);
      // This shouldn't happen with our API structure, but test it
    } else if (apiResponse && apiResponse.data && apiResponse.data.paths !== undefined) {
      console.log('✅ Found paths in response.data:', apiResponse.data.paths.length);
      
      // Step 3: Transform data (same as frontend)
      console.log('\n3️⃣ Transforming data...');
      const transformedPaths = apiResponse.data.paths.map((path: any, index: number) => {
        const transformed = {
          ...path,
          gradient: getGradient(path.category, path.level),
          icon: getIcon(path.category, index),
          outcomes: path.objectives || path.tags?.filter((tag: string) => tag.includes('Engineer') || tag.includes('Architect')) || [],
          averageSalary: '$' + (100 + Math.floor(index * 10)) + 'K',
          jobTitles: path.tags?.slice(0, 4) || [],
          href: `/paths/${path.id || path._id}`
        };
        
        console.log(`   📝 Transformed path ${index + 1}:`);
        console.log(`      Title: ${transformed.title}`);
        console.log(`      ID: ${transformed.id || transformed._id}`);
        console.log(`      Href: ${transformed.href}`);
        console.log(`      Category: ${transformed.category}`);
        console.log(`      Level: ${transformed.level}`);
        console.log(`      Published: ${transformed.isPublished}`);
        console.log(`      Status: ${transformed.status}`);
        console.log(`      Total Steps: ${transformed.totalSteps}`);
        console.log(`      Total Courses: ${transformed.totalCourses}`);
        console.log(`      Total Labs: ${transformed.totalLabs}`);
        console.log(`      Price: ${transformed.price}`);
        console.log(`      Is Free: ${transformed.isFree}`);
        console.log(`      Tags: ${JSON.stringify(transformed.tags)}`);
        console.log(`      Gradient: ${transformed.gradient}`);
        console.log(`      Icon: ${transformed.icon}`);
        console.log(`      Outcomes: ${JSON.stringify(transformed.outcomes)}`);
        
        return transformed;
      });

      console.log(`\n✅ Successfully transformed ${transformedPaths.length} paths`);

      // Step 4: Calculate stats (same as frontend)
      console.log('\n4️⃣ Calculating stats...');
      const totalCourses = transformedPaths.reduce((sum: number, path: any) => sum + (path.totalCourses || 0), 0);
      const totalLabs = transformedPaths.reduce((sum: number, path: any) => sum + (path.totalLabs || 0), 0);
      
      const stats = {
        totalPaths: apiResponse.data.total || 0,
        totalCourses: totalCourses || 0,
        totalLabs: totalLabs || 0,
        successRate: 92
      };

      console.log('   Stats:', JSON.stringify(stats, null, 2));

      // Step 5: Check if any filtering might be happening
      console.log('\n5️⃣ Checking for potential filtering issues...');
      
      transformedPaths.forEach((path: any, index: number) => {
        const issues = [];
        
        if (!path.isPublished && path.status !== 'published') {
          issues.push('Not published');
        }
        if (path.totalSteps === 0) {
          issues.push('No steps');
        }
        if (path.totalCourses === 0) {
          issues.push('No courses');
        }
        if (path.totalLabs === 0) {
          issues.push('No labs');
        }
        if (!path.tags || path.tags.length === 0) {
          issues.push('No tags');
        }
        if (!path.description || path.description.trim() === '') {
          issues.push('No description');
        }

        if (issues.length > 0) {
          console.log(`   ⚠️ Path ${index + 1} (${path.title}) has issues: ${issues.join(', ')}`);
        } else {
          console.log(`   ✅ Path ${index + 1} (${path.title}) looks good`);
        }
      });

      console.log('\n🎯 FRONTEND DISPLAY ASSESSMENT:');
      if (transformedPaths.length === 0) {
        console.log('❌ No paths to display - Empty state will show');
      } else {
        console.log(`✅ ${transformedPaths.length} path(s) will be displayed`);
        console.log('📋 Each path should render as a card with the following:');
        transformedPaths.forEach((path: any, index: number) => {
          console.log(`   ${index + 1}. "${path.title}" - ${path.category} (${path.level})`);
        });
      }

    } else {
      console.log('❌ No valid paths structure found in response');
      console.log('Response structure:', Object.keys(apiResponse));
    }

  } catch (error: any) {
    console.error('💥 Error in simulation:', error?.message || 'Unknown error');
  }
}

async function main() {
  await simulateFrontendProcessing();
  
  console.log('\n🎯 RECOMMENDATIONS:');
  console.log('==================');
  console.log('1. If frontend shows "No Learning Paths Available":');
  console.log('   - Check browser console for JavaScript errors');
  console.log('   - Verify network requests in DevTools');
  console.log('   - Check if API client authentication is interfering');
  console.log('');
  console.log('2. If paths are transformed correctly but not displaying:');
  console.log('   - Check React component state updates');
  console.log('   - Verify no client-side filtering is removing paths');
  console.log('   - Check CSS/styling issues hiding content');
  console.log('');
  console.log('3. To improve path quality:');
  console.log('   - Add steps/courses/labs to existing path');
  console.log('   - Add more learning paths via admin interface');
  console.log('   - Update path metadata (tags, objectives, etc.)');
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;