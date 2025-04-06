const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create test-data directory if it doesn't exist
const testDataDir = path.join(__dirname, '__tests__', 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Function to run tests with specific patterns
function runTests(pattern, description) {
  console.log(`\n=== Running ${description} ===\n`);
  try {
    execSync(`npx jest ${pattern} --colors`, { stdio: 'inherit' });
    console.log(`\n✅ ${description} passed!\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${description} failed!\n`);
    return false;
  }
}

// Define test suites
const testSuites = [
  { pattern: '__tests__/api/auth.test.ts', description: 'Authentication API Tests' },
  { pattern: '__tests__/api/reviews.test.ts', description: 'Reviews API Tests' },
  { pattern: '__tests__/api/media.test.ts', description: 'Media API Tests' },
  { pattern: '__tests__/api/cuj-sync.test.ts', description: 'CUJ Sync API Tests' },
  { pattern: '__tests__/unit/scoring.test.ts', description: 'Scoring Unit Tests' },
  { pattern: '__tests__/e2e/login.test.ts', description: 'Login E2E Tests' },
  { pattern: '__tests__/e2e/review-workflow.test.ts', description: 'Review Workflow E2E Tests' },
  { pattern: '__tests__/e2e/media-capture.test.ts', description: 'Media Capture E2E Tests' }
];

// Print test summary
console.log('\n==================================');
console.log('📋 Running Meridian Test Suite');
console.log('==================================\n');
console.log(`Total test suites: ${testSuites.length}`);

// Run all test suites and track results
let passedSuites = 0;

for (const suite of testSuites) {
  if (runTests(suite.pattern, suite.description)) {
    passedSuites++;
  }
}

// Print final summary
console.log('\n==================================');
console.log(`📊 Test Summary: ${passedSuites}/${testSuites.length} suites passed`);
console.log('==================================\n');

// Exit with appropriate code
process.exit(passedSuites === testSuites.length ? 0 : 1);