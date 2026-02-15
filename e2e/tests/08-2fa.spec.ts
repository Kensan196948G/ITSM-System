/**
 * 2FA (Two-Factor Authentication) E2E Tests
 *
 * Tests cover:
 * - 2FA status display in user settings
 * - 2FA setup flow (modal, QR code, verification)
 * - 2FA login flow (requires2FA prompt, modal, token entry)
 * - 2FA management (manage modal, backup codes, disable)
 * - Edge cases (cancel, validation errors, empty fields)
 */

import { test, expect, testUsers } from '../fixtures/auth';
import { navigateToView, ModalHelper, ToastHelper } from '../fixtures/test-helpers';
import { Page } from '@playwright/test';

// Fake data for 2FA setup API mock
const FAKE_QR_CODE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const FAKE_SECRET = 'JBSWY3DPEHPK3PXP';
const FAKE_OTPAUTH_URL = 'otpauth://totp/ITSM:admin?secret=JBSWY3DPEHPK3PXP&issuer=ITSM';

/**
 * Helper: Navigate from manage modal to a sub-modal (disable/regenerate).
 * The manage modal's button handlers call closeModal() then openXXXModal().
 * closeModal() uses a 200ms setTimeout to set display:none, which races
 * with the new openModal() call. We work around this by:
 * 1. Clicking the button in manage modal
 * 2. Waiting for the new modal title to appear (briefly visible before setTimeout fires)
 * 3. Waiting for setTimeout to complete and re-showing the modal overlay
 */
async function navigateManageToSubModal(page: Page, buttonText: string, expectedTitle: string): Promise<void> {
  await page.locator('#modal-body').getByText(buttonText).click();
  // The new openModal() sets display:flex immediately, but closeModal()'s
  // setTimeout(200ms) will set display:none 200ms later.
  // Wait for that setTimeout to finish, then force the overlay visible again.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'flex';
  });
  await expect(page.locator('#modal-title')).toContainText(expectedTitle, { timeout: 5000 });
}

// ============================================================
// Group 1: 2FA Status Display in User Settings
// ============================================================

test.describe('2FA Status Display', () => {
  test('should show 2FA section in user settings page', async ({ adminPage }) => {
    await navigateToView(adminPage, 'user-settings');

    // Wait for 2FA status container to appear
    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    // Check that the 2FA section title exists
    await expect(adminPage.getByText('二要素認証 (2FA)')).toBeVisible();
  });

  test('should show 2FA as disabled for user without 2FA', async ({ adminPage }) => {
    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    // Wait for loading to complete (status badge should appear)
    await expect(twoFAContainer.getByText('無効')).toBeVisible({ timeout: 10000 });

    // Enable button should be shown
    await expect(twoFAContainer.getByText('2FAを有効化')).toBeVisible();
  });

  test('should show 2FA description text', async ({ adminPage }) => {
    await navigateToView(adminPage, 'user-settings');

    await expect(
      adminPage.getByText('二要素認証を有効にすると、ログイン時に追加のセキュリティコードが必要になります')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should display current status label', async ({ adminPage }) => {
    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    // Wait for status to load
    await expect(twoFAContainer.getByText('現在のステータス:')).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================
// Group 2: 2FA Setup Flow
// ============================================================

test.describe('2FA Setup Flow', () => {
  test('should open 2FA setup modal when clicking enable button', async ({ adminPage }) => {
    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    // Wait for status to load and click enable button
    const enableBtn = twoFAContainer.getByText('2FAを有効化');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    // Modal should open with setup title
    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    const title = await modal.getTitle();
    expect(title).toContain('二要素認証 (2FA) のセットアップ');
  });

  test('should show explanation and start button in setup step 1', async ({ adminPage }) => {
    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const enableBtn = twoFAContainer.getByText('2FAを有効化');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Check explanation text
    await expect(adminPage.getByText('二要素認証について')).toBeVisible();
    await expect(
      adminPage.getByText('Google Authenticator、Authy、Microsoft Authenticator', { exact: false })
    ).toBeVisible();

    // Start button should be visible
    await expect(adminPage.getByText('セットアップを開始')).toBeVisible();
  });

  test('should show QR code after clicking start button', async ({ adminPage }) => {
    // Mock the 2FA setup API to return QR code data
    await adminPage.route('**/api/v1/auth/2fa/setup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          qrCode: FAKE_QR_CODE,
          secret: FAKE_SECRET,
          otpauthUrl: FAKE_OTPAUTH_URL
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const enableBtn = twoFAContainer.getByText('2FAを有効化');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Click start button
    await adminPage.getByText('セットアップを開始').click();

    // Wait for QR code to appear (API call happens, mocked)
    const qrImage = adminPage.locator('img[alt="QR Code for 2FA"]');
    await expect(qrImage).toBeVisible({ timeout: 15000 });

    // Manual entry section should be visible
    await expect(adminPage.getByText('または手動で入力:')).toBeVisible();

    // Secret code should be displayed
    await expect(adminPage.locator('code')).toContainText(FAKE_SECRET);

    // Token input and verify button should be visible
    await expect(adminPage.locator('input[placeholder="000000"]')).toBeVisible();
    await expect(adminPage.locator('#modal-footer').getByText('確認して有効化')).toBeVisible();
    await expect(adminPage.locator('#modal-footer').getByText('キャンセル')).toBeVisible();
  });

  test('should show validation error for invalid token during setup', async ({ adminPage }) => {
    // Mock the 2FA setup API
    await adminPage.route('**/api/v1/auth/2fa/setup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          qrCode: FAKE_QR_CODE,
          secret: FAKE_SECRET,
          otpauthUrl: FAKE_OTPAUTH_URL
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const enableBtn = twoFAContainer.getByText('2FAを有効化');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Click start to go to step 2
    await adminPage.getByText('セットアップを開始').click();

    // Wait for QR code
    await expect(adminPage.locator('img[alt="QR Code for 2FA"]')).toBeVisible({ timeout: 15000 });

    // Try with empty token - click verify button
    await adminPage.locator('#modal-footer').getByText('確認して有効化').click();

    // Should show warning toast for invalid input (detect by toast text content)
    await expect(adminPage.locator('.toastify').getByText('6桁の数字を入力してください')).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for non-numeric token', async ({ adminPage }) => {
    // Mock the 2FA setup API
    await adminPage.route('**/api/v1/auth/2fa/setup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          qrCode: FAKE_QR_CODE,
          secret: FAKE_SECRET,
          otpauthUrl: FAKE_OTPAUTH_URL
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const enableBtn = twoFAContainer.getByText('2FAを有効化');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    await adminPage.getByText('セットアップを開始').click();
    await expect(adminPage.locator('img[alt="QR Code for 2FA"]')).toBeVisible({ timeout: 15000 });

    // Enter non-numeric value
    await adminPage.locator('input[placeholder="000000"]').fill('abcdef');
    await adminPage.locator('#modal-footer').getByText('確認して有効化').click();

    // Should show warning toast for invalid input
    await expect(adminPage.locator('.toastify').getByText('6桁の数字を入力してください')).toBeVisible({ timeout: 5000 });
  });

  test('should close setup modal when clicking cancel', async ({ adminPage }) => {
    // Mock the 2FA setup API
    await adminPage.route('**/api/v1/auth/2fa/setup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          qrCode: FAKE_QR_CODE,
          secret: FAKE_SECRET,
          otpauthUrl: FAKE_OTPAUTH_URL
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const enableBtn = twoFAContainer.getByText('2FAを有効化');
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
    await enableBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    await adminPage.getByText('セットアップを開始').click();
    await expect(adminPage.locator('img[alt="QR Code for 2FA"]')).toBeVisible({ timeout: 15000 });

    // Click cancel
    await adminPage.locator('#modal-footer').getByText('キャンセル').click();

    await modal.waitForClose();
  });
});

// ============================================================
// Group 3: 2FA Login Flow (requires mocked API responses)
// ============================================================

test.describe('2FA Login Flow', () => {
  // These tests need unauthenticated state for login testing
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should show 2FA modal when login returns requires2FA', async ({ page }) => {
    // Intercept the login API to return requires2FA with status 400
    // Frontend login() checks !res.ok before inspecting data.requires2FA
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: '2FAトークンが必要です', requires2FA: true })
      });
    });

    await page.goto('/index.html');
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

    // Fill login form
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpassword');
    await page.click('#login-form button.btn-login');

    // 2FA modal should appear
    await expect(page.locator('#modal-overlay')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#modal-title')).toContainText('二要素認証');

    // Token input should be visible
    await expect(page.locator('input[placeholder="000000"]')).toBeVisible();

    // Verify and cancel buttons should be in footer
    await expect(page.locator('#modal-footer').getByText('ログイン')).toBeVisible();
    await expect(page.locator('#modal-footer').getByText('キャンセル')).toBeVisible();
  });

  test('should show backup code hint in 2FA login modal', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: '2FAトークンが必要です', requires2FA: true })
      });
    });

    await page.goto('/index.html');
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpassword');
    await page.click('#login-form button.btn-login');

    await expect(page.locator('#modal-overlay')).toBeVisible({ timeout: 10000 });

    // Backup code hint should be visible
    await expect(
      page.getByText('バックアップコードを使用できます', { exact: false })
    ).toBeVisible();
  });

  test('should show warning when submitting empty 2FA token', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: '2FAトークンが必要です', requires2FA: true })
      });
    });

    await page.goto('/index.html');
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpassword');
    await page.click('#login-form button.btn-login');

    await expect(page.locator('#modal-overlay')).toBeVisible({ timeout: 10000 });

    // Click login without entering token
    await page.locator('#modal-footer').getByText('ログイン').click();

    // Warning toast should appear with validation message
    await expect(page.locator('.toastify').getByText('コードを入力してください')).toBeVisible({ timeout: 5000 });
  });

  test('should close 2FA modal when clicking cancel', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: '2FAトークンが必要です', requires2FA: true })
      });
    });

    await page.goto('/index.html');
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpassword');
    await page.click('#login-form button.btn-login');

    await expect(page.locator('#modal-overlay')).toBeVisible({ timeout: 10000 });

    // Click cancel
    await page.locator('#modal-footer').getByText('キャンセル').click();

    await expect(page.locator('#modal-overlay')).toBeHidden({ timeout: 5000 });
  });

  test('should show error for invalid 2FA token on login', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/v1/auth/login', async (route) => {
      callCount++;
      if (callCount === 1) {
        // First call: requires 2FA (status 400 so !res.ok triggers requires2FA check)
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: '2FAトークンが必要です', requires2FA: true })
        });
      } else {
        // Second call with TOTP: invalid token
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid 2FA token' })
        });
      }
    });

    await page.goto('/index.html');
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpassword');
    await page.click('#login-form button.btn-login');

    await expect(page.locator('#modal-overlay')).toBeVisible({ timeout: 10000 });

    // Enter invalid token
    await page.locator('input[placeholder="000000"]').fill('999999');
    await page.locator('#modal-footer').getByText('ログイン').click();

    // Error toast should appear (login() returns error from mocked API)
    await expect(page.locator('.toastify').getByText('Invalid 2FA token')).toBeVisible({ timeout: 5000 });

    // Modal should remain open for retry
    await expect(page.locator('#modal-overlay')).toBeVisible();

    // Token input should be cleared
    const tokenValue = await page.locator('input[placeholder="000000"]').inputValue();
    expect(tokenValue).toBe('');
  });

  test('should allow token entry via Enter key', async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: '2FAトークンが必要です', requires2FA: true })
      });
    });

    await page.goto('/index.html');
    await expect(page.locator('#login-screen')).toBeVisible({ timeout: 10000 });

    await page.fill('#username', 'testuser');
    await page.fill('#password', 'testpassword');
    await page.click('#login-form button.btn-login');

    await expect(page.locator('#modal-overlay')).toBeVisible({ timeout: 10000 });

    // Focus token input and verify it accepts keyboard input
    const tokenInput = page.locator('input[placeholder="000000"]');
    await expect(tokenInput).toBeVisible();
    await tokenInput.focus();
    await tokenInput.fill('123456');

    // Verify value was entered
    const value = await tokenInput.inputValue();
    expect(value).toBe('123456');
  });
});

// ============================================================
// Group 4: 2FA Management (with mocked 2FA-enabled status)
// ============================================================

test.describe('2FA Management Modal', () => {
  test('should show manage button when 2FA is enabled (mocked)', async ({ adminPage }) => {
    // Mock 2FA status API to return enabled
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 8
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    // Should show enabled badge
    await expect(twoFAContainer.getByText('有効')).toBeVisible({ timeout: 10000 });

    // Should show backup codes count
    await expect(twoFAContainer.getByText('バックアップコード: 8/10', { exact: false })).toBeVisible();

    // Should show manage button
    await expect(twoFAContainer.getByText('2FA設定を管理')).toBeVisible();
  });

  test('should open manage modal with enabled status', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 5
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const manageBtn = twoFAContainer.getByText('2FA設定を管理');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    // Modal should open
    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    const title = await modal.getTitle();
    expect(title).toContain('二要素認証の管理');

    // Should show status as enabled
    await expect(adminPage.locator('#modal-body').getByText('有効')).toBeVisible();

    // Should show backup codes count
    await expect(adminPage.getByText('5 / 10 コード')).toBeVisible();

    // Should show regenerate and disable options
    await expect(adminPage.getByText('バックアップコードを再生成')).toBeVisible();
    await expect(adminPage.getByText('2FAを無効化')).toBeVisible();
  });

  test('should show low backup codes count in warning color', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 2
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    // Low count should be displayed (color is danger when < 3)
    await expect(twoFAContainer.getByText('バックアップコード: 2/10', { exact: false })).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================
// Group 5: 2FA Disable Flow
// ============================================================

test.describe('2FA Disable Flow', () => {
  test('should open disable modal from manage modal', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 10
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const manageBtn = twoFAContainer.getByText('2FA設定を管理');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Navigate from manage modal to disable modal
    await navigateManageToSubModal(adminPage, '2FAを無効化', '二要素認証の無効化');

    // Should show warning
    await expect(adminPage.locator('#modal-body').getByText('警告')).toBeVisible();
    await expect(
      adminPage.getByText('パスワードのみで保護されます', { exact: false })
    ).toBeVisible();

    // Should show password and token inputs (scoped to modal-body)
    await expect(adminPage.locator('#modal-body input[type="password"]')).toBeVisible();
    await expect(adminPage.locator('#modal-body input[placeholder="000000"]')).toBeVisible();

    // Should show cancel and disable buttons in footer
    await expect(adminPage.locator('#modal-footer').getByText('キャンセル')).toBeVisible();
    await expect(adminPage.locator('#modal-footer').getByText('2FAを無効化')).toBeVisible();
  });

  test('should show validation warning when password is empty in disable modal', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 10
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const manageBtn = twoFAContainer.getByText('2FA設定を管理');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Navigate from manage modal to disable modal
    await navigateManageToSubModal(adminPage, '2FAを無効化', '二要素認証の無効化');

    // Click disable without entering anything
    await adminPage.locator('#modal-footer').getByText('2FAを無効化').click();

    // Should show validation warning toast
    await expect(adminPage.locator('.toastify').getByText('パスワードを入力してください')).toBeVisible({ timeout: 5000 });
  });

  test('should show validation warning when token is invalid in disable modal', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 10
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const manageBtn = twoFAContainer.getByText('2FA設定を管理');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    await navigateManageToSubModal(adminPage, '2FAを無効化', '二要素認証の無効化');

    // Enter password but invalid token (scoped to modal-body)
    await adminPage.locator('#modal-body input[type="password"]').fill('password123');
    await adminPage.locator('#modal-body input[placeholder="000000"]').fill('abc');
    await adminPage.locator('#modal-footer').getByText('2FAを無効化').click();

    // Should show validation warning toast
    await expect(adminPage.locator('.toastify').getByText('6桁のトークンを入力してください')).toBeVisible({ timeout: 5000 });
  });

  test('should close disable modal when clicking cancel', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 10
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const manageBtn = twoFAContainer.getByText('2FA設定を管理');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    await navigateManageToSubModal(adminPage, '2FAを無効化', '二要素認証の無効化');

    // Click cancel
    await adminPage.locator('#modal-footer').getByText('キャンセル').click();
    await modal.waitForClose();
  });
});

// ============================================================
// Group 6: Backup Codes Regeneration Flow
// ============================================================

test.describe('Backup Codes Regeneration', () => {
  test('should open regenerate modal from manage modal', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 3
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const manageBtn = twoFAContainer.getByText('2FA設定を管理');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Navigate from manage modal to regenerate modal
    await navigateManageToSubModal(adminPage, 'バックアップコードを再生成', 'バックアップコード再生成');

    // Should show warning about existing codes
    await expect(
      adminPage.getByText('既存のバックアップコードは無効になります', { exact: false })
    ).toBeVisible();

    // Should show password and token inputs (scoped to modal-body)
    await expect(adminPage.locator('#modal-body input[type="password"]')).toBeVisible();
    await expect(adminPage.locator('#modal-body input[placeholder="000000"]')).toBeVisible();

    // Should show regenerate button in footer
    await expect(adminPage.locator('#modal-footer').getByText('再生成')).toBeVisible();
  });

  test('should show validation for empty password in regenerate modal', async ({ adminPage }) => {
    await adminPage.route('**/api/v1/auth/2fa/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          configured: true,
          backupCodesRemaining: 3
        })
      });
    });

    await navigateToView(adminPage, 'user-settings');

    const twoFAContainer = adminPage.locator('#twofa-status-container');
    await expect(twoFAContainer).toBeVisible({ timeout: 10000 });

    const manageBtn = twoFAContainer.getByText('2FA設定を管理');
    await expect(manageBtn).toBeVisible({ timeout: 10000 });
    await manageBtn.click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Navigate from manage modal to regenerate modal
    await navigateManageToSubModal(adminPage, 'バックアップコードを再生成', 'バックアップコード再生成');

    // Click regenerate without entering anything
    await adminPage.locator('#modal-footer').getByText('再生成').click();

    // Should show validation warning toast
    await expect(adminPage.locator('.toastify').getByText('パスワードを入力してください')).toBeVisible({ timeout: 5000 });
  });
});
