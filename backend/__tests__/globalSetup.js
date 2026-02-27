/**
 * Global Setup for Jest
 * Ensures the test database is migrated to the latest version before running tests.
 *
 * このファイルはJestのテスト実行前に一度だけ実行され、
 * テスト用データベースの初期化（マイグレーション）を担当します。
 * server.js の initDb() はテスト環境ではマイグレーションをスキップし、
 * シードデータの投入のみを行います。
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
process.env.OPERATOR_PASSWORD = 'operator123';

const fs = require('fs');
const path = require('path');
const knex = require('knex');
const knexConfig = require('../../knexfile');

module.exports = async () => {
  console.log('\n[Global Setup] Starting test database synchronization...');

  // Database path
  const dbPath = path.resolve(__dirname, '../test_itsm.db');

  // Remove existing test DB and associated WAL/SHM files to start fresh
  const filesToRemove = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  for (const filePath of filesToRemove) {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[Global Setup] Removed: ${path.basename(filePath)}`);
      } catch (e) {
        console.warn(
          `[Global Setup] Could not remove ${path.basename(filePath)} (it might be locked).`
        );
      }
    }
  }

  const db = knex(knexConfig.test);

  try {
    // Force-release any stale migration locks from previous failed runs
    try {
      await db.schema.hasTable('knex_migrations_lock').then(async (exists) => {
        if (exists) {
          await db('knex_migrations_lock').update({ is_locked: 0 });
          console.log('[Global Setup] Cleared stale migration lock.');
        }
      });
    } catch (_) {
      // Lock table may not exist yet on first run - this is fine
    }

    console.log('[Global Setup] Running migrations...');
    await db.migrate.latest();
    console.log('[Global Setup] Migrations complete.');

    // Close migration knex connection before seeding
    await db.destroy();

    // Seed initial data using db.js in this isolated globalSetup process.
    // This avoids sqlite3 connection contention that occurs when multiple
    // test files each try to seed via their own sqlite3.Database instance.
    console.log('[Global Setup] Seeding initial data...');
    const { initDb } = require('../db');
    await initDb();
    console.log('[Global Setup] Initial data seeded.');

    // Clean up db.js's knex connection pool
    const knexInstance = require('../knex');
    await knexInstance.destroy();
  } catch (error) {
    console.error('[Global Setup] Error during database synchronization:', error);
    process.exit(1);
  } finally {
    // db may already be destroyed above; safe to call again
    try {
      await db.destroy();
    } catch (_) {
      /* already destroyed */
    }
  }

  console.log('[Global Setup] Test database is ready.\n');
};
