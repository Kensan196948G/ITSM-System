/**
 * Global Setup for Jest
 * Ensures the test database is migrated to the latest version before running tests.
 */

// Load test environment variables FIRST before any other imports
process.env.NODE_ENV = 'test';
require('dotenv').config({ path: '.env.test' });
// Force test database path
process.env.DATABASE_PATH = './backend/test_itsm.db';
// Force JWT secret for test environment
process.env.JWT_SECRET = 'test-secret-key-for-ci-pipeline-only';
// Test user passwords (must match test expectations)
process.env.ADMIN_PASSWORD = 'admin123';
process.env.MANAGER_PASSWORD = 'manager123';
process.env.ANALYST_PASSWORD = 'analyst123';
process.env.VIEWER_PASSWORD = 'viewer123';

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const knexConfig = require('../../knexfile');

module.exports = async () => {
  console.log('\n[Global Setup] Starting test database synchronization...');

  // Database path
  const dbPath = path.resolve(__dirname, '../test_itsm.db');

  // Optional: Remove existing test DB to start fresh each full run
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
      console.log('[Global Setup] Removed old test database.');
    } catch (e) {
      console.warn('[Global Setup] Could not remove old test database (it might be locked).');
    }
  }

  const db = knex(knexConfig.test);

  try {
    console.log('[Global Setup] Running migrations...');
    await db.migrate.latest();
    console.log('[Global Setup] Migrations complete.');

    // Optional: Run seeds if needed
    // await db.seed.run();
  } catch (error) {
    console.error('[Global Setup] Error during database synchronization:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }

  console.log('[Global Setup] Test database is ready.\n');
};
