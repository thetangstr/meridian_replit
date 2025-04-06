# Meridian Test Suite

This folder contains a comprehensive set of automated tests for the Meridian application, covering all core CUJs (Critical User Journeys).

## Test Structure

The tests are organized into the following categories:

- `api/`: API integration tests using Supertest
- `unit/`: Unit tests for utility functions and business logic
- `e2e/`: End-to-end tests using Puppeteer
- `test-data/`: Test fixtures and data files

## Core CUJs Tested

1. **Authentication**
   - User login and authentication
   - Session management

2. **Reviews**
   - Creating new reviews
   - Updating review status
   - Managing task evaluations
   - Managing category evaluations
   - Generating reports

3. **Media Handling**
   - Uploading photos and videos
   - Validating media duration
   - Storing media in Firebase
   - Retrieving and displaying media

4. **CUJ Data Sync**
   - Synchronizing CUJ data
   - Managing CUJ database versions
   - CUJ categorization and linking

5. **Scoring System**
   - Task score calculation
   - Category score calculation 
   - Overall score calculation

## Running Tests

You can run all tests with:

```bash
./test.sh
```

Or run specific test categories:

```bash
# Run API tests only
npx jest __tests__/api

# Run unit tests only
npx jest __tests__/unit

# Run E2E tests only
npx jest __tests__/e2e

# Run a specific test file
npx jest __tests__/api/reviews.test.ts
```

## Firebase Configuration

The media tests require Firebase configuration. Make sure you have the following environment variables set:

- `FIREBASE_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

## CI/CD Integration

The tests are designed to be run as part of your CI/CD pipeline. The main `test.sh` script returns the appropriate exit code (0 for success, 1 for failures) which can be used to determine build success/failure.
