# Meridian - Car Evaluation Platform

A sophisticated car evaluation web application that leverages advanced technology to streamline multi-persona vehicle assessments through an intelligent, user-centric platform.

## Features

- **Review Management**: Create and manage detailed car evaluations across multiple categories
- **Task-Based Assessments**: Evaluate specific tasks based on defined criteria and scoring rubrics
- **Media Capture**: Record photos and videos (up to 2 minutes) with validation and proper orientation support
- **Firebase Integration**: Store and retrieve media files securely with cloud storage
- **Category Analysis**: Generate insights with strengths, weaknesses, and opportunities
- **CUJ Database**: Synchronize Critical User Journey data from external sources
- **Report Generation**: Export comprehensive reports in multiple formats
- **User Roles**: Admin and reviewer functionality with appropriate permissions

## Tech Stack

- **Frontend**: React (TypeScript) with Tailwind CSS and shadcn components
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Drizzle ORM
- **Media Storage**: Firebase Storage with local fallback
- **Testing**: Jest, Supertest, and Puppeteer for comprehensive test coverage

## Getting Started

1. Clone the repository
2. Install dependencies with npm
3. Set up environment variables (see below)
4. Start the development server

## Environment Variables

Create a .env file with the following variables:

- Database (provided by PostgreSQL setup)
  - DATABASE_URL: PostgreSQL connection string

- Firebase (required for media storage)
  - FIREBASE_API_KEY: Firebase API key
  - FIREBASE_PROJECT_ID: Firebase project ID
  - FIREBASE_AUTH_DOMAIN: Firebase auth domain
  - FIREBASE_STORAGE_BUCKET: Firebase storage bucket
  - FIREBASE_MESSAGING_SENDER_ID: Firebase messaging sender ID
  - FIREBASE_APP_ID: Firebase app ID

## Testing

A comprehensive test suite is included for all core CUJs:

- Run all tests with: ./test.sh
- Run specific test categories: 
  - API tests: npx jest __tests__/api
  - Unit tests: npx jest __tests__/unit
  - E2E tests: npx jest __tests__/e2e

See the test documentation in __tests__/README.md for more details.

## Deployment

The application is ready for deployment.

## License

This project is licensed under the MIT License.
