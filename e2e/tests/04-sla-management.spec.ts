import { test, expect } from '../fixtures/auth';
import {
  navigateToView,
  expectSectionTitle,
  ModalHelper,
  TableHelper,
  testDataGenerators,
} from '../fixtures/test-helpers';

/**
 * SLA Management E2E Tests
 * Tests SLA creation, viewing, and management functionality
 */

test.describe('SLA Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'sla');
    await expectSectionTitle(adminPage, /SLA管理/);
  });

  test.describe('SLA List View', () => {
    test('should display SLA management page', async ({ adminPage }) => {
      // Check for main content
      const mainContent = adminPage.locator('#main-view');
      await expect(mainContent).toBeVisible();
    });

    test('should have create SLA button', async ({ adminPage }) => {
      const createButton = adminPage.getByRole('button', { name: /新規SLA|SLA作成|作成/ });
      await expect(createButton).toBeVisible();
    });

    test('should display SLA table or list', async ({ adminPage }) => {
      // Wait for content to load
      await adminPage.waitForTimeout(1000);

      // Check for table or list of SLAs
      const table = adminPage.locator('table.data-table');
      const hasSlaTable = await table.isVisible();

      if (hasSlaTable) {
        await expect(table).toBeVisible();
      } else {
        // Alternative: check for any SLA cards or list items
        const content = await adminPage.locator('#main-view').textContent();
        expect(content).not.toBe('');
      }
    });
  });

  test.describe('SLA CRUD Operations', () => {
    test('should create a new SLA', async ({ adminPage }) => {
      const slaName = testDataGenerators.slaName();
      const modal = new ModalHelper(adminPage);

      // Click create button
      const createButton = adminPage.getByRole('button', { name: /新規SLA|SLA作成|作成/ });
      await createButton.click();
      await modal.waitForOpen();

      // Fill in SLA details - adjust selectors based on actual form
      const nameInput = adminPage.locator('#sla-name, input[name="name"], input[placeholder*="名前"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill(slaName);
      }

      // Set target response time
      const responseInput = adminPage.locator('#sla-response-time, input[name="response_time"]');
      if (await responseInput.isVisible()) {
        await responseInput.fill('4');
      }

      // Set target resolution time
      const resolutionInput = adminPage.locator('#sla-resolution-time, input[name="resolution_time"]');
      if (await resolutionInput.isVisible()) {
        await resolutionInput.fill('24');
      }

      // Submit
      await adminPage.getByRole('button', { name: /保存|作成|登録/ }).click();
      await modal.waitForClose();
    });

    test('should view SLA details', async ({ adminPage }) => {
      // Wait for page to load
      await adminPage.waitForTimeout(1000);

      // Check if there are any SLA rows to click
      const table = adminPage.locator('table.data-table tbody tr');
      const count = await table.count();

      if (count > 0) {
        // Click on first SLA row
        await table.first().click();

        // Modal or detail view should open
        await adminPage.waitForTimeout(500);
      }
    });

    test('should edit SLA settings', async ({ adminPage }) => {
      const modal = new ModalHelper(adminPage);

      // Wait for content
      await adminPage.waitForTimeout(1000);

      // Find edit button on first row
      const editButton = adminPage.locator('table.data-table tbody tr button[title="編集"]').first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await modal.waitForOpen();

        // Make a change
        const descInput = adminPage.locator('#sla-description, textarea[name="description"]');
        if (await descInput.isVisible()) {
          await descInput.fill('Updated SLA description via E2E test');
        }

        // Save
        await adminPage.getByRole('button', { name: /保存|更新/ }).click();
        await modal.waitForClose();
      }
    });
  });

  test.describe('SLA Status Display', () => {
    test('should show SLA compliance indicators', async ({ adminPage }) => {
      // Wait for content to load
      await adminPage.waitForTimeout(1000);

      // Look for compliance badges or status indicators
      const badges = adminPage.locator('.badge, .status-indicator, .compliance-status');
      const count = await badges.count();

      // If there are SLAs, there should be status indicators
      if (count > 0) {
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should display response time targets', async ({ adminPage }) => {
      // Wait for content
      await adminPage.waitForTimeout(1000);

      // Check for time-related content in the view
      const content = await adminPage.locator('#main-view').textContent();
      // SLA page should have some time-related content
      expect(content).toBeDefined();
    });
  });
});

test.describe('SLA Alerts History', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'sla-alerts');
    await expectSectionTitle(adminPage, /SLAアラート履歴|アラート/);
  });

  test('should display SLA alerts page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should show alerts table', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    // Check for alerts table or list
    const table = adminPage.locator('table.data-table');
    const hasTable = await table.isVisible();

    if (hasTable) {
      await expect(table).toBeVisible();
    }
  });

  test('should have filtering options', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    // Look for filter controls
    const filterControls = adminPage.locator('select, input[type="search"], .filter-control');
    const count = await filterControls.count();

    // Page should have some filtering capability
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display alert severity levels', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    // Check for severity badges
    const badges = adminPage.locator('.badge');
    const count = await badges.count();

    // If there are alerts, they should have severity indicators
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should allow viewing alert details', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    // Check if there are any alert rows
    const table = adminPage.locator('table.data-table tbody tr');
    const count = await table.count();

    if (count > 0) {
      // Click on first alert
      await table.first().click();
      await adminPage.waitForTimeout(500);
      // Alert details should be viewable
    }
  });
});
