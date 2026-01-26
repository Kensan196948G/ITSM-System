/**
 * Jest Configuration - API E2E Tests
 *
 * API エンドポイントのエンドツーエンドテスト用設定
 */
module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/backend/__tests__/globalSetup.js',
  setupFiles: ['<rootDir>/backend/__tests__/setup.js'],
  testMatch: ['**/backend/__tests__/e2e/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  maxWorkers: 1,
  testTimeout: 60000, // E2Eテストは長めのタイムアウト
};
