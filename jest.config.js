/**
 * Jest Configuration - Root Level
 *
 * このファイルはプロジェクトルートに配置され、
 * Jest が正しく globalSetup と setupFiles を見つけられるようにします。
 *
 * @see config/jest/jest.config.js (元の設定ファイル)
 */
module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/backend/__tests__/globalSetup.js',
  setupFiles: ['<rootDir>/backend/__tests__/setup.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'backend/**/*.js',
    '!backend/node_modules/**',
    '!backend/__tests__/**',
    '!backend/migrations/**',
    '!backend/scripts/**',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/WebUI-Sample/'],
  verbose: true,
  maxWorkers: 1, // データベースロック対策（SQLite安全性優先）
  testTimeout: 60000, // 60秒 (DB初期化 + Rate Limitingテスト対応)
};
