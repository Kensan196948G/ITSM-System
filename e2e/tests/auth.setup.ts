import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Authentication Setup
 * JWT移行後はlocalStorageにトークンを保存しないため、
 * UI経由の実ログインで認証状態を確立する
 */

const authFile = 'e2e/.auth/user.json';

/**
 * Setup: Authenticate as admin via UI login and save storage state
 */
setup('authenticate as admin', async ({ page }) => {
  // Navigate to login page
  await page.goto('/index.html');

  // Wait for login screen
  await expect(page.locator('#login-screen')).toBeVisible({ timeout: 15000 });

  // Perform actual login through the UI
  await page.fill('#username', 'admin');
  await page.fill('#password', 'admin123');
  await page.click('#login-form button.btn-login');

  // Wait for the app container to be visible (confirming login was successful)
  await expect(page.locator('#app-container')).toBeVisible({ timeout: 15000 });

  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Save storage state (cookies including HttpOnly refresh token) for reuse
  await page.context().storageState({ path: authFile });
});
