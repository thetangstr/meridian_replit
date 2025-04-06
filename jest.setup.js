// This file runs before Jest starts
// Set up any global test configurations or mocks here

// Increase test timeout to handle Puppeteer tests
jest.setTimeout(30000);

// Create a global API test URL
process.env.API_URL = process.env.API_URL || 'http://localhost:5000';