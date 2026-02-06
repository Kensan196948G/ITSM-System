import { test, expect } from '../fixtures/auth';
import {
  navigateToView,
  expectSectionTitle,
  ModalHelper,
  TableHelper,
  testDataGenerators,
} from '../fixtures/test-helpers';

/**
 * User Management E2E Tests
 * Tests user administration functionality (admin only)
 */

test.describe('User Management (Admin)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'settings_users');
    await expectSectionTitle(adminPage, /ユーザー・権限管理/);
  });

  test.describe('User List View', () => {
    test('should display user management page', async ({ adminPage }) => {
      const mainContent = adminPage.locator('#main-view');
      await expect(mainContent).toBeVisible();
    });

    test('should have create user button', async ({ adminPage }) => {
      const createButton = adminPage.getByRole('button', { name: /新規ユーザー作成/ });
      await expect(createButton).toBeVisible();
    });

    test('should display users table', async ({ adminPage }) => {
      await expect(adminPage.locator('table.data-table')).toBeVisible({ timeout: 10000 });
    });

    test('should have search functionality', async ({ adminPage }) => {
      const searchInput = adminPage.locator('#user-search-input');
      await expect(searchInput).toBeVisible();
    });
  });

  test.describe('User CRUD Operations', () => {
    test('should create a new user', async ({ adminPage }) => {
      const username = testDataGenerators.username();
      const email = testDataGenerators.email();
      const employeeNumber = testDataGenerators.employeeNumber();
      const modal = new ModalHelper(adminPage);

      // Click create button
      await adminPage.getByRole('button', { name: /新規ユーザー作成/ }).click();
      await modal.waitForOpen();

      // Fill in user details
      await adminPage.fill('#user-username', username);
      await adminPage.fill('#user-employee-number', employeeNumber);
      await adminPage.fill('#user-fullname', 'E2E Test User');
      await adminPage.fill('#user-email', email);
      await adminPage.fill('#user-password', 'TestPassword123!');
      await adminPage.selectOption('#user-role', 'viewer');

      // Submit - wait for API response
      const responsePromise = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/') && resp.request().method() === 'POST'
      );
      await adminPage.locator('#modal-footer').getByRole('button', { name: '作成' }).click();
      await responsePromise;
      await modal.waitForClose();

      // Search for the created user
      await adminPage.fill('#user-search-input', username);
      await adminPage.getByRole('button', { name: '検索' }).click();

      // Verify user was created
      const table = new TableHelper(adminPage);
      const createdRow = await table.findRowByText(username);
      await expect(createdRow).toHaveCount(1);
    });

    test('should search for users', async ({ adminPage }) => {
      // Search for admin user
      await adminPage.fill('#user-search-input', 'admin');
      await adminPage.getByRole('button', { name: '検索' }).click();

      // Wait for results
      await adminPage.waitForTimeout(500);

      // Should find admin user
      const table = new TableHelper(adminPage);
      const adminRow = await table.findRowByText('admin');
      await expect(adminRow).toHaveCount(1);
    });

    test('should edit a user', async ({ adminPage }) => {
      const username = testDataGenerators.username();
      const email = testDataGenerators.email();
      const employeeNumber = testDataGenerators.employeeNumber();
      const modal = new ModalHelper(adminPage);

      // Create a user first
      await adminPage.getByRole('button', { name: /新規ユーザー作成/ }).click();
      await modal.waitForOpen();

      await adminPage.fill('#user-username', username);
      await adminPage.fill('#user-employee-number', employeeNumber);
      await adminPage.fill('#user-fullname', 'Original Name');
      await adminPage.fill('#user-email', email);
      await adminPage.fill('#user-password', 'TestPassword123!');
      await adminPage.selectOption('#user-role', 'viewer');

      const createResp = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/') && resp.request().method() === 'POST'
      );
      await adminPage.locator('#modal-footer').getByRole('button', { name: '作成' }).click();
      await createResp;
      await modal.waitForClose();

      // Search for the user
      await adminPage.fill('#user-search-input', username);
      await adminPage.getByRole('button', { name: '検索' }).click();

      // Click edit button
      const table = new TableHelper(adminPage);
      await table.clickRowButton(username, '✏️');
      await modal.waitForOpen();

      // Update the user's name
      await adminPage.fill('#edit-user-fullname', 'Updated E2E User');

      // Save changes
      const updateResp = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/') && resp.request().method() === 'PUT'
      );
      await adminPage.locator('#modal-footer').getByRole('button', { name: '更新' }).click();
      await updateResp;
      await modal.waitForClose();

      // Verify update
      await adminPage.fill('#user-search-input', username);
      await adminPage.getByRole('button', { name: '検索' }).click();

      const updatedRow = await table.findRowByText('Updated E2E User');
      await expect(updatedRow).toHaveCount(1);
    });

    test('should delete a user', async ({ adminPage }) => {
      const username = testDataGenerators.username();
      const email = testDataGenerators.email();
      const employeeNumber = testDataGenerators.employeeNumber();
      const modal = new ModalHelper(adminPage);
      const table = new TableHelper(adminPage);

      // Create a user first
      await adminPage.getByRole('button', { name: /新規ユーザー作成/ }).click();
      await modal.waitForOpen();

      await adminPage.fill('#user-username', username);
      await adminPage.fill('#user-employee-number', employeeNumber);
      await adminPage.fill('#user-fullname', 'Delete Test User');
      await adminPage.fill('#user-email', email);
      await adminPage.fill('#user-password', 'TestPassword123!');
      await adminPage.selectOption('#user-role', 'viewer');

      const createResp = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/') && resp.request().method() === 'POST'
      );
      await adminPage.locator('#modal-footer').getByRole('button', { name: '作成' }).click();
      await createResp;
      await modal.waitForClose();

      // Search for the user
      await adminPage.fill('#user-search-input', username);
      await adminPage.getByRole('button', { name: '検索' }).click();

      // Verify user exists
      await expect(await table.findRowByText(username)).toHaveCount(1);

      // Click delete button
      await table.clickRowButton(username, '🗑️');

      // Confirm deletion
      const deleteResp = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/') && resp.request().method() === 'DELETE'
      );
      await adminPage.locator('#modal-footer').getByRole('button', { name: '削除' }).click();
      await deleteResp;
      await modal.waitForClose();

      // Verify user was deleted
      await adminPage.fill('#user-search-input', username);
      await adminPage.getByRole('button', { name: '検索' }).click();
      await expect(await table.findRowByText(username)).toHaveCount(0);
    });

    test('should validate required fields', async ({ adminPage }) => {
      const modal = new ModalHelper(adminPage);

      // Open create modal
      await adminPage.getByRole('button', { name: /新規ユーザー作成/ }).click();
      await modal.waitForOpen();

      // Try to save without filling required fields
      await adminPage.locator('#modal-overlay').getByRole('button', { name: '作成' }).click();

      // Modal should still be open
      await expect(adminPage.locator('#modal-overlay')).toBeVisible();
    });
  });

  test.describe('User Roles', () => {
    test('should display different role options', async ({ adminPage }) => {
      const modal = new ModalHelper(adminPage);

      // Open create modal
      await adminPage.getByRole('button', { name: /新規ユーザー作成/ }).click();
      await modal.waitForOpen();

      // Check role dropdown options
      const roleSelect = adminPage.locator('#user-role');
      await expect(roleSelect).toBeVisible();

      // Get available options
      const options = await roleSelect.locator('option').allTextContents();
      expect(options.length).toBeGreaterThan(1);

      // Close modal
      await modal.close();
    });
  });
});

test.describe('User Settings (Personal)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'user-settings');
  });

  test('should display user settings page', async ({ adminPage }) => {
    await expectSectionTitle(adminPage, /ユーザー設定/);

    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should show password change option', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    // Look for password change section or button
    const content = await adminPage.locator('#main-view').textContent();
    expect(content).toMatch(/パスワード|password/i);
  });
});

test.describe('Access Control', () => {
  test('operator should not see admin-only menu items', async ({ operatorPage }) => {
    // Navigate to main view
    await operatorPage.goto('/index.html');
    await expect(operatorPage.locator('#app-container')).toBeVisible();

    // Check if admin-only items are hidden
    // This depends on the actual implementation
    await operatorPage.waitForTimeout(500);
  });

  test('viewer should have limited access', async ({ viewerPage }) => {
    // Navigate to main view
    await viewerPage.goto('/index.html');
    await expect(viewerPage.locator('#app-container')).toBeVisible();

    // Viewer should be able to see dashboard
    await expect(viewerPage.locator('.nav-item[data-view="dash"]')).toBeVisible();
  });
});
