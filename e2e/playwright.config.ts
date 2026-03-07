import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * Playwright E2E Test Configuration for ITSM-Sec Nexus
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // E2Eテスト前にクリーンなDB環境を準備
  globalSetup: require.resolve('./global-setup'),
  // テスト後にサーバープロセスを確実に停止
  globalTeardown: require.resolve('./global-teardown'),

  // Test directory
  testDir: './tests',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Run tests in parallel within files
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['html', { open: 'on-failure' }], ['list']],

  // Global timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Shared settings for all projects
  use: {
    // Base URL for the frontend (port 5555 to avoid conflicts with other local services)
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5555',

    // API base URL for direct API calls in tests
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },

    // Ignore HTTPS errors for self-signed certificates
    ignoreHTTPSErrors: true,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Locale
    locale: 'ja-JP',

    // Timezone
    timezoneId: 'Asia/Tokyo',

    // Action timeout
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for different browsers
  projects: [
    // Authentication setup - runs before all tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Main browser tests
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use prepared auth state
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results/',

  // Web server configuration (Express backend serves both API and frontend on port 5000)
  webServer: {
    command: 'node backend/server.js',
    url: 'http://localhost:5555/api/v1/health',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ENABLE_HTTPS: 'false',
      PORT: '5555',
      // E2E専用DBを使用（開発用DBとの干渉を防止）
      DATABASE_PATH: path.resolve(__dirname, '..', 'backend', 'itsm_e2e_test.db'),
      ADMIN_PASSWORD: 'admin123',
      MANAGER_PASSWORD: 'manager123',
      ANALYST_PASSWORD: 'analyst123',
      OPERATOR_PASSWORD: 'operator123',
      VIEWER_PASSWORD: 'viewer123',
      E2E_RATE_LIMIT_MAX: '200',
      CORS_ORIGIN: 'http://localhost:5555',
    },
  },
});
