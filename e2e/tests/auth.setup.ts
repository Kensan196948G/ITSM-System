import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

/**
 * Authentication Setup
 * This file runs before all tests to create authenticated state
 */

const authFile = 'e2e/.auth/user.json';

/**
 * Resolve JWT secret from environment or .env file
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
 * Setup: Authenticate as admin and save storage state
 */
setup('authenticate as admin', async ({ page }) => {
  const jwtSecret = resolveJwtSecret();

  const adminUser = {
    id: 1,
    username: 'admin',
    role: 'admin',
    email: 'admin@itsm.local',
    fullName: 'System Administrator',
  };

  const token = jwt.sign(
    { id: adminUser.id, username: adminUser.username, role: adminUser.role },
    jwtSecret,
    { expiresIn: '24h' }
  );

  // Set up authentication in localStorage
  await page.addInitScript(
    ({ jwtToken, userInfo }) => {
      localStorage.setItem('itsm_auth_token', jwtToken);
      localStorage.setItem('itsm_user_info', JSON.stringify(userInfo));
    },
    { jwtToken: token, userInfo: adminUser }
  );

  // Navigate to the app
  await page.goto('/index.html');

  // Wait for the app container to be visible (confirming login was successful)
  await expect(page.locator('#app-container')).toBeVisible({ timeout: 15000 });

  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Save storage state for reuse
  await page.context().storageState({ path: authFile });
});
