module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/backend/__tests__/globalSetup.js',
  setupFiles: ['<rootDir>/backend/__tests__/setup.js'],
  testMatch: ['**/__tests__/e2e/**/*.e2e.test.js'],
  verbose: true,
  maxWorkers: 1, // データベースロック対策
  testTimeout: 30000 // E2Eテストはタイムアウトを長めに設定
};
