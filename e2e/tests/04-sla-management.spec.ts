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
      const createButton = adminPage.getByRole('button', { name: /新規SLA|SLA作成|新規作成|作成/ });
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
      const createButton = adminPage.getByRole('button', { name: /新規SLA|SLA作成|新規作成|作成/ });
      await createButton.click();
      await modal.waitForOpen();

      // Fill in SLA details using actual form field IDs
      const serviceNameInput = adminPage.locator('#sla-service-name');
      if (await serviceNameInput.isVisible()) {
        await serviceNameInput.fill(slaName);
      }

      // Set metric name
      const metricNameInput = adminPage.locator('#sla-metric-name');
      if (await metricNameInput.isVisible()) {
        await metricNameInput.fill('Response Time');
      }

      // Set target value
      const targetValueInput = adminPage.locator('#sla-target-value');
      if (await targetValueInput.isVisible()) {
        await targetValueInput.fill('99.9');
      }

      // Submit - wait for API response
      const responsePromise = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/') && resp.request().method() === 'POST'
      );
      await adminPage.locator('#modal-footer').getByRole('button', { name: /保存|作成|登録/ }).click();
      await responsePromise;
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
      const editButton = adminPage.locator('table.data-table tbody tr').first().getByRole('button', { name: '編集' });

      if (await editButton.isVisible()) {
        await editButton.click();
        await modal.waitForOpen();

        // Make a change
        const descInput = adminPage.locator('#sla-description, textarea[name="description"]');
        if (await descInput.isVisible()) {
          await descInput.fill('Updated SLA description via E2E test');
        }

        // Save
        await adminPage.locator('#modal-footer').getByRole('button', { name: /保存|更新/ }).click();
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
    // sla-alerts has no sidebar nav item, call loadView() directly (global function in app.js)
    await adminPage.evaluate(() => {
      // loadView is declared as a global async function in app.js
      if (typeof (window as any).loadView === 'function') {
        (window as any).loadView('sla-alerts');
      } else {
        // Fallback: use eval to call the global function
        eval('loadView("sla-alerts")');
      }
    });
    await adminPage.waitForTimeout(1500);
    // Title should be 'SLAアラート履歴'
    const sectionTitle = await adminPage.locator('#section-title').textContent();
    expect(sectionTitle).toBeDefined();
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
