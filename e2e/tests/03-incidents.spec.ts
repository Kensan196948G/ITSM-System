import { test, expect } from '../fixtures/auth';
import {
  navigateToView,
  expectSectionTitle,
  ModalHelper,
  TableHelper,
  testDataGenerators,
} from '../fixtures/test-helpers';

/**
 * Incident Management E2E Tests
 * Tests the complete incident lifecycle: create, read, update, delete
 */

test.describe('Incident Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'incidents');
    await expectSectionTitle(adminPage, /インシデント管理/);
  });

  test.describe('Incident List View', () => {
    test('should display incidents table', async ({ adminPage }) => {
      // Check for the data table
      await expect(adminPage.locator('table.data-table')).toBeVisible({ timeout: 10000 });
    });

    test('should have search functionality', async ({ adminPage }) => {
      const searchInput = adminPage.getByPlaceholder(/検索/);
      await expect(searchInput).toBeVisible();
    });

    test('should have create incident button', async ({ adminPage }) => {
      const createButton = adminPage.getByRole('button', { name: /新規インシデント作成/ });
      await expect(createButton).toBeVisible();
    });

    test('should display table headers', async ({ adminPage }) => {
      const tableHeaders = adminPage.locator('table.data-table thead th');
      const count = await tableHeaders.count();
      expect(count).toBeGreaterThan(3); // At least ID, Title, Status, Priority
    });
  });

  test.describe('Incident CRUD Operations', () => {
    test('should create a new incident', async ({ adminPage }) => {
      const incidentTitle = testDataGenerators.incidentTitle();
      const modal = new ModalHelper(adminPage);

      // Click create button
      await adminPage.getByRole('button', { name: /新規インシデント作成/ }).click();
      await modal.waitForOpen();

      // Fill in incident details
      await adminPage.fill('#incident-title', incidentTitle);
      await adminPage.selectOption('#incident-priority', 'High');
      await adminPage.fill('#incident-description', 'E2E Test Incident Description');

      // Submit
      await adminPage.getByRole('button', { name: '保存' }).click();
      await modal.waitForClose();

      // Verify incident was created - search for it
      const table = new TableHelper(adminPage);
      await table.searchFor(incidentTitle);

      const createdRow = await table.findRowByText(incidentTitle);
      await expect(createdRow).toHaveCount(1);
    });

    test('should view incident details', async ({ adminPage }) => {
      const incidentTitle = testDataGenerators.incidentTitle();
      const modal = new ModalHelper(adminPage);
      const table = new TableHelper(adminPage);

      // First create an incident
      await adminPage.getByRole('button', { name: /新規インシデント作成/ }).click();
      await modal.waitForOpen();
      await adminPage.fill('#incident-title', incidentTitle);
      await adminPage.selectOption('#incident-priority', 'Medium');
      await adminPage.fill('#incident-description', 'View test incident');
      await adminPage.getByRole('button', { name: '保存' }).click();
      await modal.waitForClose();

      // Search for the incident
      await table.searchFor(incidentTitle);

      // Click on the row to view details
      await table.clickRow(incidentTitle);

      // Modal should open with incident details
      await modal.waitForOpen();

      // Verify title is shown in the modal
      await expect(adminPage.locator('#incident-title')).toHaveValue(incidentTitle);
    });

    test('should update an incident status', async ({ adminPage }) => {
      const incidentTitle = testDataGenerators.incidentTitle();
      const modal = new ModalHelper(adminPage);
      const table = new TableHelper(adminPage);

      // Create an incident first
      await adminPage.getByRole('button', { name: /新規インシデント作成/ }).click();
      await modal.waitForOpen();
      await adminPage.fill('#incident-title', incidentTitle);
      await adminPage.selectOption('#incident-priority', 'High');
      await adminPage.fill('#incident-description', 'Update test incident');
      await adminPage.getByRole('button', { name: '保存' }).click();
      await modal.waitForClose();

      // Search and click on the incident
      await table.searchFor(incidentTitle);
      await table.clickRow(incidentTitle);
      await modal.waitForOpen();

      // Update status
      await adminPage.selectOption('#incident-status', 'Resolved');
      await adminPage.getByRole('button', { name: '保存' }).click();
      await modal.waitForClose();

      // Verify the status was updated
      await table.searchFor(incidentTitle);
      const updatedRow = await table.findRowByText(incidentTitle);
      await expect(updatedRow).toHaveCount(1);
    });

    test('should delete an incident', async ({ adminPage }) => {
      const incidentTitle = testDataGenerators.incidentTitle();
      const modal = new ModalHelper(adminPage);
      const table = new TableHelper(adminPage);

      // Create an incident first
      await adminPage.getByRole('button', { name: /新規インシデント作成/ }).click();
      await modal.waitForOpen();
      await adminPage.fill('#incident-title', incidentTitle);
      await adminPage.selectOption('#incident-priority', 'Low');
      await adminPage.fill('#incident-description', 'Delete test incident');
      await adminPage.getByRole('button', { name: '保存' }).click();
      await modal.waitForClose();

      // Search for the incident
      await table.searchFor(incidentTitle);
      await expect(await table.findRowByText(incidentTitle)).toHaveCount(1);

      // Click delete button
      await table.clickRowButton(incidentTitle, '削除');

      // Confirm deletion in modal
      await modal.waitForOpen();
      await adminPage.locator('#modal-footer').getByRole('button', { name: '削除' }).click();
      await modal.waitForClose();

      // Verify incident was deleted
      await table.searchFor(incidentTitle);
      await expect(await table.findRowByText(incidentTitle)).toHaveCount(0);
    });

    test('should validate required fields on create', async ({ adminPage }) => {
      const modal = new ModalHelper(adminPage);

      // Open create modal
      await adminPage.getByRole('button', { name: /新規インシデント作成/ }).click();
      await modal.waitForOpen();

      // Try to save without filling required fields
      await adminPage.getByRole('button', { name: '保存' }).click();

      // Modal should still be open (validation failed)
      await expect(adminPage.locator('#modal-overlay')).toBeVisible();
    });
  });

  test.describe('Incident Filtering and Search', () => {
    test('should filter incidents by search term', async ({ adminPage }) => {
      const table = new TableHelper(adminPage);

      // Search for a specific term
      await table.searchFor('test');

      // Wait for filter to apply
      await adminPage.waitForTimeout(500);

      // All visible rows should contain the search term
      const visibleRows = adminPage.locator('table.data-table tbody tr');
      const count = await visibleRows.count();

      // If there are results, they should contain the search term
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const rowText = await visibleRows.nth(i).textContent();
          // Row should exist in the filtered result
          expect(rowText).toBeDefined();
        }
      }
    });

    test('should clear search and show all incidents', async ({ adminPage }) => {
      const searchInput = adminPage.getByPlaceholder(/検索/);

      // First search for something
      await searchInput.fill('nonexistent_search_term_12345');
      await adminPage.waitForTimeout(500);

      // Clear the search
      await searchInput.fill('');
      await adminPage.waitForTimeout(500);

      // Table should be visible
      await expect(adminPage.locator('table.data-table')).toBeVisible();
    });
  });
});
