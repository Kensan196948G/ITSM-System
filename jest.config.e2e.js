/**
 * Jest Configuration - API E2E Tests
 *
 * API エンドポイントのエンドツーエンドテスト用設定
 */
module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/backend/__tests__/globalSetup.js',
  globalTeardown: '<rootDir>/backend/__tests__/globalTeardown.js',
  setupFiles: ['<rootDir>/backend/__tests__/setup.js'],
  setupFilesAfterEnv: ['<rootDir>/backend/__tests__/e2e/setup.e2e.js'],
  testMatch: ['**/backend/__tests__/e2e/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  maxWorkers: 1,
  testTimeout: 60000, // E2Eテストは長めのタイムアウト
};
