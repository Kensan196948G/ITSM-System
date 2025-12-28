// Jest setup file - runs before all tests
// Ensures correct environment variables are loaded

// Set NODE_ENV to test if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Load environment variables from .env.test
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

// Ensure critical environment variables are set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-for-ci-pipeline-only';
}

if (!process.env.DATABASE_PATH) {
  process.env.DATABASE_PATH = './backend/test_itsm.db';
}

// Silent console output during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
