// Jest setup file - runs before all tests
// Ensures correct environment variables are loaded

// Force NODE_ENV to test
process.env.NODE_ENV = 'test';

// Load environment variables from .env.test
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

// Force set critical environment variables to ensure consistency
// These values MUST match those in .env.test and CI workflow
process.env.JWT_SECRET = 'test-secret-key-for-ci-pipeline-only';
process.env.DATABASE_PATH = './backend/test_itsm.db';
process.env.JWT_EXPIRES_IN = '24h';
process.env.PORT = '5000';
process.env.HOST = '0.0.0.0';
process.env.CORS_ORIGIN = '*';
process.env.LOG_LEVEL = 'error';

// Test user passwords (must match test expectations)
process.env.ADMIN_PASSWORD = 'admin123';
process.env.MANAGER_PASSWORD = 'manager123';
process.env.ANALYST_PASSWORD = 'analyst123';
process.env.VIEWER_PASSWORD = 'viewer123';

// Database migrations are handled by globalSetup.js
// See: backend/__tests__/globalSetup.js
// This ensures all tables (including audit_logs, user_activity) are created before tests run

// Silent console output during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
