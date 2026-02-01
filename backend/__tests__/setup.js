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

// Test環境専用ポート設定（本番サーバーとの競合回避）
process.env.PORT = '5100'; // テスト専用ポート
process.env.HTTPS_PORT = '5543'; // 本番6443と競合しない
process.env.HTTP_PORT = '5180'; // 本番8080と競合しない
process.env.ENABLE_HTTPS = 'false'; // テスト環境ではHTTPのみ

process.env.HOST = '0.0.0.0';
process.env.CORS_ORIGIN = '*';
process.env.LOG_LEVEL = 'error';

// Disable scheduler in test environment to prevent async operations after Jest teardown
process.env.SCHEDULER_ENABLED = 'false';

// Test user passwords (must match test expectations)
process.env.ADMIN_PASSWORD = 'admin123';
process.env.MANAGER_PASSWORD = 'manager123';
process.env.ANALYST_PASSWORD = 'analyst123';
process.env.VIEWER_PASSWORD = 'viewer123';

// Database migrations are handled by globalSetup.js
// See: backend/__tests__/globalSetup.js
// This ensures all tables (including audit_logs, user_activity) are created before tests run

// Suppress console output during tests to prevent "Cannot log after tests are done" errors
// This is necessary because server.js auto-starts and may log after Jest environment teardown
const originalConsole = { ...console };

// Store original console methods for potential restoration
// eslint-disable-next-line no-underscore-dangle
global.__originalConsole = originalConsole;

// Replace console methods with silent versions in test environment
// This prevents errors when server logs after Jest teardown
global.console = {
  ...console,
  log: (...args) => {
    // Only log if Jest environment is still active
    if (process.env.JEST_WORKER_ID !== undefined) {
      // Suppress server startup logs in tests
      const message = args.join(' ');
      if (
        message.includes('Server running') ||
        message.includes('API Documentation') ||
        message.includes('[Scheduler]') ||
        message.includes('[Cache]')
      ) {
        return; // Suppress these specific logs
      }
    }
    originalConsole.log(...args);
  },
  debug: originalConsole.debug,
  info: originalConsole.info,
  warn: originalConsole.warn,
  error: originalConsole.error // Keep errors visible
};
