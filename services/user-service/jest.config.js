// Bug #2 (Apr 23 follow-up): user-service had no jest config. The
// existing `__tests__/*.test.ts` files parse as TypeScript, but without
// this config jest silently fell back to babel-jest with no TS preset —
// every test failed with "Missing semicolon" on TS annotations, hidden by
// `--passWithNoTests` in the test script. Tests have effectively never
// run in CI. Wiring ts-jest (already in devDependencies) fixes it for
// this service and unblocks regression tests for the getUserCourses bug.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
