import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

/**
 * JWT Secret resolver - reads from environment or .env file
 */
function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('JWT_SECRET not found (.env missing)');
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const match = lines.find((line) => line.startsWith('JWT_SECRET='));
  if (!match) {
    throw new Error('JWT_SECRET not found in .env');
  }

  return match.replace('JWT_SECRET=', '').trim();
}

/**
 * User types for testing
 */
export interface TestUser {
  id: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  email: string;
  fullName?: string;
}

/**
 * Predefined test users
 */
export const testUsers: Record<string, TestUser> = {
  admin: {
    id: 1,
    username: 'admin',
    role: 'admin',
    email: 'admin@itsm.local',
    fullName: 'System Administrator',
  },
  operator: {
    id: 2,
    username: 'operator',
    role: 'operator',
    email: 'operator@itsm.local',
    fullName: 'IT Operator',
  },
  viewer: {
    id: 3,
    username: 'viewer',
    role: 'viewer',
    email: 'viewer@itsm.local',
    fullName: 'Read Only User',
  },
};

/**
 * Authentication helper class
 */
export class AuthHelper {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = resolveJwtSecret();
  }

  /**
   * Generate JWT token for a test user
   */
  generateToken(user: TestUser, expiresIn: string = '1h'): string {
    return jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      this.jwtSecret,
      { expiresIn }
    );
  }

  /**
   * Authenticate a page by setting localStorage
   */
  async authenticatePage(page: Page, user: TestUser): Promise<void> {
    const token = this.generateToken(user);

    await page.addInitScript(
      ({ jwtToken, userInfo }) => {
        localStorage.setItem('itsm_auth_token', jwtToken);
        localStorage.setItem('itsm_user_info', JSON.stringify(userInfo));
      },
      { jwtToken: token, userInfo: user }
    );
  }

  /**
   * Authenticate and navigate to the app
   */
  async loginAs(page: Page, user: TestUser, navigateTo?: string): Promise<void> {
    await this.authenticatePage(page, user);

    const url = navigateTo || '/index.html';
    await page.goto(url);

    // Wait for app container to be visible
    await expect(page.locator('#app-container')).toBeVisible({ timeout: 15000 });
  }

  /**
   * Perform actual login through the UI (for login flow testing)
   */
  async loginThroughUI(
    page: Page,
    username: string,
    password: string
  ): Promise<boolean> {
    // Navigate to login page
    await page.goto('/index.html');

    // Wait for login screen
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

    // Fill in credentials
    await page.fill('#username', username);
    await page.fill('#password', password);

    // Click login button
    await page.click('button.btn-login');

    // Wait for either success or error
    try {
      await expect(page.locator('#app-container')).toBeVisible({ timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Logout through UI
   */
  async logout(page: Page): Promise<void> {
    await page.click('#logout-btn');
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await expect(page.locator('#app-container')).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current user from localStorage
   */
  async getCurrentUser(page: Page): Promise<TestUser | null> {
    const userInfo = await page.evaluate(() => {
      const stored = localStorage.getItem('itsm_user_info');
      return stored ? JSON.parse(stored) : null;
    });
    return userInfo;
  }
}

/**
 * Custom fixtures for authenticated tests
 */
type AuthFixtures = {
  authHelper: AuthHelper;
  adminPage: Page;
  operatorPage: Page;
  viewerPage: Page;
};

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  authHelper: async ({}, use) => {
    const helper = new AuthHelper();
    await use(helper);
  },

  adminPage: async ({ page, authHelper }, use) => {
    await authHelper.loginAs(page, testUsers.admin);
    await use(page);
  },

  operatorPage: async ({ page, authHelper }, use) => {
    await authHelper.loginAs(page, testUsers.operator);
    await use(page);
  },

  viewerPage: async ({ page, authHelper }, use) => {
    await authHelper.loginAs(page, testUsers.viewer);
    await use(page);
  },
});

export { expect };
