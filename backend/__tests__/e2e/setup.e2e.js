/**
 * E2E Test Setup
 * E2Eテスト専用のセットアップファイル
 * nodemailer と axios をモックしてCI環境での実行を可能にする
 *
 * Note: This file is loaded via setupFilesAfterEnv in jest.config.e2e.js
 * The base setup.js is loaded via setupFiles before this file.
 *
 * IMPORTANT: jest.mock() calls are hoisted by Jest to the top of the file,
 * so they will be executed before any require() calls even though they
 * appear after them in the source code.
 */

// Mock nodemailer before any services are loaded
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      response: '250 OK'
    }),
    verify: jest.fn().mockImplementation((callback) => {
      if (callback) callback(null, true);
      return Promise.resolve(true);
    })
  })
}));

// Mock axios for webhook tests
jest.mock('axios', () => ({
  post: jest.fn().mockImplementation((url) =>
    Promise.resolve({
      status: 200,
      data: { ok: true }
    })
  ),
  get: jest.fn().mockImplementation(() =>
    Promise.resolve({
      status: 200,
      data: {}
    })
  ),
  create: jest.fn().mockReturnValue({
    post: jest.fn().mockResolvedValue({ status: 200, data: { ok: true } }),
    get: jest.fn().mockResolvedValue({ status: 200, data: {} })
  }),
  defaults: {
    headers: {
      common: {}
    }
  }
}));

// Set E2E-specific environment variables BEFORE importing server
process.env.SMTP_HOST = 'mock-smtp.test';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASSWORD = 'test-password';
process.env.SMTP_FROM = 'ITSM Test <test@itsm.test>';

// Import server to trigger initDb() which seeds default users
// This import happens AFTER mocks are set up (due to Jest hoisting)
const { dbReady } = require('../../server');

// Global beforeAll to ensure database is ready before ANY test file runs
// This is critical because server.js's initDb() seeds the default users
beforeAll(async () => {
  try {
    // Wait for database initialization (migrations + seed data)
    // dbReady is a Promise returned by initDb() in server.js
    if (dbReady && typeof dbReady.then === 'function') {
      await dbReady;
    }
    // Additional wait to ensure all async DB operations complete
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    // Log error but don't fail - some tests might not need full DB
    console.error('[E2E Setup] DB init warning:', error.message);
  }
}, 120000); // 120 second timeout for DB initialization

// Suppress console warnings for cleaner test output
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  // Suppress expected warnings in E2E tests
  if (
    message.includes('SMTP') ||
    message.includes('Webhook') ||
    message.includes('not configured')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};
