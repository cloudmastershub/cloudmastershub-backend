#!/usr/bin/env node
/**
 * One-shot populate: set `videoUrl` on every lesson in every section of
 * every course (or a specific course) to a test YouTube URL so lesson
 * playback can be exercised end-to-end before real course content is
 * uploaded through the instructor dashboard.
 *
 * DB-seeded courses ship with `videoUrl: ''` on every lesson (see
 * scripts/seed-database.js:60) — that empty string has been blocking
 * PLAYER-02 playback testing. This is a temporary, reversible populate
 * purely for QA.
 *
 * Usage
 * -----
 *   # Populate every course:
 *   MONGODB_URI="mongodb://admin:...@mongodb:27017/cloudmastershub?authSource=admin" \
 *     node scripts/populate-lesson-videos.js
 *
 *   # Populate one course by slug:
 *   MONGODB_URI="..." node scripts/populate-lesson-videos.js \
 *     --slug cloud-security-fundamentals
 *
 *   # Override the test URL (otherwise uses the default below):
 *   MONGODB_URI="..." node scripts/populate-lesson-videos.js \
 *     --url "https://www.youtube.com/watch?v=xxxxxxxxxxx"
 *
 *   # Dry run (count what would change, make no writes):
 *   MONGODB_URI="..." node scripts/populate-lesson-videos.js --dry-run
 *
 *   # Revert back to empty strings:
 *   MONGODB_URI="..." node scripts/populate-lesson-videos.js --revert
 *
 * Via kubectl (from outside the cluster):
 *   kubectl run populate-videos -n cloudmastershub-dev --rm -i --restart=Never \
 *     --image=node:20-alpine \
 *     --overrides='{
 *       "spec": {
 *         "containers": [{
 *           "name": "populate",
 *           "image": "node:20-alpine",
 *           "command": ["sh","-c","npm i --silent mongodb@6 && node /scripts/populate-lesson-videos.js"],
 *           "env": [{"name":"MONGODB_URI","value":"mongodb://admin:PASSWORD@mongodb:27017/cloudmastershub?authSource=admin"}],
 *           "volumeMounts": [{"name":"scripts","mountPath":"/scripts"}]
 *         }],
 *         "volumes": [{"name":"scripts","configMap":{"name":"populate-videos-script"}}]
 *       }
 *     }'
 */

/* eslint-disable no-console */

// Default test video — provided Apr 23 during PLAYER-02 QA to unblock
// playback testing without requiring every course to have unique content.
// The `&t=811s` timestamp was intentionally stripped: starting every lesson
// 13:31 into the video isn't useful for testing fresh-playback flows.
const DEFAULT_TEST_URL = 'https://www.youtube.com/watch?v=ON5yCMelO3Y';
const EMPTY_URL = '';

function parseArgs(argv) {
  const args = { slug: null, url: null, dryRun: false, revert: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slug' && argv[i + 1]) { args.slug = argv[++i]; }
    else if (a === '--url' && argv[i + 1]) { args.url = argv[++i]; }
    else if (a === '--dry-run') { args.dryRun = true; }
    else if (a === '--revert') { args.revert = true; }
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node populate-lesson-videos.js [--slug <slug>] [--url <url>] [--dry-run] [--revert]');
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI env var is required');
    process.exit(1);
  }

  const targetUrl = args.revert ? EMPTY_URL : (args.url || DEFAULT_TEST_URL);
  const mode = args.revert ? 'REVERT (clearing videoUrl)' : `POPULATE with ${targetUrl}`;
  const scope = args.slug ? `course slug = "${args.slug}"` : 'ALL courses';

  console.log('─'.repeat(60));
  console.log(`Mode  : ${mode}`);
  console.log(`Scope : ${scope}`);
  console.log(`Dry   : ${args.dryRun ? 'yes — no writes' : 'no — will write'}`);
  console.log('─'.repeat(60));

  let MongoClient;
  try { ({ MongoClient } = require('mongodb')); }
  catch { ({ MongoClient } = require('mongoose/node_modules/mongodb')); }

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const dbName = new URL(MONGODB_URI).pathname.slice(1) || 'cloudmastershub';
  const db = client.db(dbName);
  const courses = db.collection('courses');

  const filter = args.slug ? { slug: args.slug } : {};
  const list = await courses
    .find(filter, { projection: { _id: 1, slug: 1, title: 1, curriculum: 1 } })
    .toArray();

  if (list.length === 0) {
    console.error(args.slug
      ? `No course found with slug "${args.slug}"`
      : 'No courses found in the collection — nothing to do.');
    await client.close();
    process.exit(args.slug ? 1 : 0);
  }

  let totalCourses = 0;
  let totalSections = 0;
  let totalLessonsTouched = 0;

  for (const course of list) {
    const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
    let courseTouched = 0;
    let courseSections = 0;

    for (let s = 0; s < curriculum.length; s++) {
      const lessons = Array.isArray(curriculum[s].lessons) ? curriculum[s].lessons : [];
      if (lessons.length === 0) continue;
      courseSections += 1;

      for (let l = 0; l < lessons.length; l++) {
        const current = lessons[l].videoUrl;
        if (current === targetUrl) continue; // already at target value
        courseTouched += 1;
      }
    }

    if (courseTouched === 0) {
      console.log(`· ${course.slug}  —  nothing to change`);
      continue;
    }

    totalCourses += 1;
    totalSections += courseSections;
    totalLessonsTouched += courseTouched;

    if (args.dryRun) {
      console.log(`· ${course.slug}  —  would update ${courseTouched} lesson(s) across ${courseSections} section(s)`);
      continue;
    }

    // Use a positional-all write: for each section, replace all lessons'
    // videoUrl. MongoDB doesn't let `$set` on `arr.$[].field` match nested
    // arrays directly across two levels, so update the whole curriculum.
    const newCurriculum = curriculum.map((section) => ({
      ...section,
      lessons: Array.isArray(section.lessons)
        ? section.lessons.map((lesson) => ({ ...lesson, videoUrl: targetUrl }))
        : section.lessons,
    }));

    const res = await courses.updateOne(
      { _id: course._id },
      { $set: { curriculum: newCurriculum, updatedAt: new Date() } }
    );
    console.log(
      `✓ ${course.slug}  —  updated ${courseTouched} lesson(s) across ${courseSections} section(s)  (matched=${res.matchedCount}, modified=${res.modifiedCount})`
    );
  }

  console.log('─'.repeat(60));
  console.log(`Courses touched       : ${totalCourses}`);
  console.log(`Sections touched      : ${totalSections}`);
  console.log(`Lesson videoUrl writes: ${totalLessonsTouched}${args.dryRun ? ' (dry run — none actually written)' : ''}`);
  console.log('─'.repeat(60));

  await client.close();
}

main().catch((err) => {
  console.error('populate-lesson-videos failed:', err);
  process.exit(1);
});
