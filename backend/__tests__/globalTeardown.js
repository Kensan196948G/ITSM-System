/**
 * Global Teardown for Jest
 * Ensures proper cleanup after all tests complete.
 *
 * This file handles cleanup when server.js auto-starts during tests.
 * Server.js now exports startServer and skips auto-start when JEST_WORKER_ID is set.
 */

module.exports = async () => {
  console.log('\n[Global Teardown] Starting cleanup...');

  // Give time for any pending async operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Stop any cron jobs that might be running
  try {
    const cron = require('node-cron');
    const tasks = cron.getTasks();
    if (tasks && tasks.size > 0) {
      tasks.forEach((task) => task.stop());
      console.log('[Global Teardown] Stopped cron jobs.');
    }
  } catch (e) {
    // node-cron may not be loaded
  }

  // Close the shared knex instance used by the application
  try {
    const knexInstance = require('../knex');
    if (knexInstance && typeof knexInstance.destroy === 'function') {
      await knexInstance.destroy();
      console.log('[Global Teardown] Shared knex instance closed.');
    }
  } catch (e) {
    console.log('[Global Teardown] Could not close shared knex instance:', e.message);
  }

  // Also try to close any db.js connections (legacy sqlite3)
  try {
    const { db } = require('../db');
    if (db && typeof db.close === 'function') {
      await new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log('[Global Teardown] Legacy db connection closed.');
    }
  } catch (e) {
    // May not exist or already closed
  }

  // Wait for any remaining file handles to be released
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Force close any remaining handles
  // This helps prevent "Cannot log after tests are done" errors
  // eslint-disable-next-line no-underscore-dangle
  if (global.__originalConsole) {
    // eslint-disable-next-line no-underscore-dangle
    global.console = global.__originalConsole;
  }

  console.log('[Global Teardown] Cleanup complete.\n');
};
