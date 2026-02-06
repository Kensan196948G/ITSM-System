import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from '../fixtures/auth';

/**
 * Login/Logout Flow Tests
 * Tests authentication flows through UI interaction
 */

test.describe('Login/Logout Flow', () => {
  let authHelper: AuthHelper;

  test.beforeEach(() => {
    authHelper = new AuthHelper();
  });

  test.describe('Login Tests', () => {
    // Skip auth setup for these tests since we test login flow
    test.use({ storageState: { cookies: [], origins: [] } });

    test('should display login screen initially', async ({ page }) => {
      await page.goto('/index.html');

      // Login screen should be visible
      await expect(page.locator('#login-screen')).toBeVisible();

      // Login form elements should be present
      await expect(page.locator('#login-form')).toBeVisible();
      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.locator('#login-form button.btn-login')).toBeVisible();

      // App container should be hidden
      await expect(page.locator('#app-container')).toBeHidden();
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      const success = await authHelper.loginThroughUI(page, 'admin', 'admin123');

      expect(success).toBe(true);

      // App container should now be visible
      await expect(page.locator('#app-container')).toBeVisible();

      // Login screen should be hidden
      await expect(page.locator('#login-screen')).toBeHidden();

      // User info should be displayed
      await expect(page.locator('#current-user')).toContainText('admin');
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/index.html');
      await expect(page.locator('#login-screen')).toBeVisible();

      await page.fill('#username', 'invalid_user');
      await page.fill('#password', 'wrong_password');
      await page.click('#login-form button.btn-login');

      // Should show error message or stay on login screen
      await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });
    });

    test('should require username field', async ({ page }) => {
      await page.goto('/index.html');
      await expect(page.locator('#login-screen')).toBeVisible();

      // Only fill password
      await page.fill('#password', 'admin123');
      await page.click('#login-form button.btn-login');

      // Should stay on login screen (HTML5 validation)
      await expect(page.locator('#login-screen')).toBeVisible();
    });

    test('should require password field', async ({ page }) => {
      await page.goto('/index.html');
      await expect(page.locator('#login-screen')).toBeVisible();

      // Only fill username
      await page.fill('#username', 'admin');
      await page.click('#login-form button.btn-login');

      // Should stay on login screen (HTML5 validation)
      await expect(page.locator('#login-screen')).toBeVisible();
    });
  });

  test.describe('Logout Tests', () => {
    test('should logout successfully', async ({ page }) => {
      // First login
      await authHelper.loginAs(page, testUsers.admin);

      // Verify logged in
      await expect(page.locator('#app-container')).toBeVisible();

      // Handle native confirm dialog before clicking logout
      page.on('dialog', dialog => dialog.accept());

      // Click logout button
      await page.click('#logout-btn');

      // Login screen should appear
      await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

      // App container should be hidden
      await expect(page.locator('#app-container')).toBeHidden();
    });

    test('should clear session data on logout', async ({ page }) => {
      // Login first
      await authHelper.loginAs(page, testUsers.admin);

      // Handle native confirm dialog before clicking logout
      page.on('dialog', dialog => dialog.accept());

      // Logout
      await page.click('#logout-btn');
      await expect(page.locator('#login-screen')).toBeVisible();

      // Check localStorage is cleared
      const token = await page.evaluate(() => localStorage.getItem('itsm_auth_token'));
      const userInfo = await page.evaluate(() => localStorage.getItem('itsm_user_info'));

      expect(token).toBeNull();
      expect(userInfo).toBeNull();
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session on page refresh', async ({ page }) => {
      // Login
      await authHelper.loginAs(page, testUsers.admin);
      await expect(page.locator('#app-container')).toBeVisible();

      // Refresh page
      await page.reload();

      // Should still be logged in
      await expect(page.locator('#app-container')).toBeVisible();
      await expect(page.locator('#current-user')).toContainText('admin');
    });
  });
});
