/**
 * Direct MongoDB cleanup for seeded courses
 * This script directly removes all seeded courses from MongoDB
 */

// Use this script in MongoDB shell or copy commands to run in pod
const seededInstructorIds = [
  'instructor-1', 'instructor-2', 'instructor-3', 'instructor-4', 'instructor-5',
  'instructor-aws-101', 'instructor-azure-201', 'instructor-gcp-301',
  'instructor-multicloud-401', 'instructor-k8s-301'
];

const seededInstructorNames = [
  'Jane Smith', 'John Doe', 'Sarah Wilson', 'Mike Chen', 'Dr. Emily Rodriguez'
];

// MongoDB commands to run in MongoDB pod:
console.log('Run these commands in MongoDB pod:');
console.log('kubectl exec -it deployment/mongodb -n cloudmastershub-dev -- mongosh cloudmastershub');
console.log('');
console.log('// Then run in MongoDB shell:');
console.log(`
// Find seeded courses first
db.courses.find({
  $or: [
    { "instructor.id": { $in: ${JSON.stringify(seededInstructorIds)} } },
    { "instructor.name": { $in: ${JSON.stringify(seededInstructorNames)} } }
  ]
}).count();

// Show what will be deleted
db.courses.find({
  $or: [
    { "instructor.id": { $in: ${JSON.stringify(seededInstructorIds)} } },
    { "instructor.name": { $in: ${JSON.stringify(seededInstructorNames)} } }
  ]
}, { title: 1, "instructor.name": 1, "instructor.id": 1 });

// DELETE all seeded courses
db.courses.deleteMany({
  $or: [
    { "instructor.id": { $in: ${JSON.stringify(seededInstructorIds)} } },
    { "instructor.name": { $in: ${JSON.stringify(seededInstructorNames)} } }
  ]
});

// Verify cleanup
db.courses.find({}).count();
db.courses.find({}, { title: 1, "instructor.name": 1, "instructor.id": 1 });

// Exit MongoDB shell
exit;
`);