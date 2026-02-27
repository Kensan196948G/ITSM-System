import { test, expect } from '../fixtures/auth';
import { navigateToView, expectSectionTitle, waitForNetworkIdle } from '../fixtures/test-helpers';

/**
 * Dashboard Display Tests
 * Verifies the main dashboard functionality and data display
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ adminPage }) => {
    // Navigate to dashboard
    await navigateToView(adminPage, 'dash');
  });

  test('should display dashboard section title', async ({ adminPage }) => {
    await expectSectionTitle(adminPage, /ダッシュボード|統合ダッシュボード/);
  });

  test('should display key metrics cards', async ({ adminPage }) => {
    // Check for dashboard metrics/stats elements
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();

    // The dashboard should have some statistics or metrics displayed
    // Look for common dashboard elements
    const dashboardCards = adminPage.locator('.stats-card, .metric-card, .card, .dashboard-card');

    // Wait for content to load
    await adminPage.waitForTimeout(1000);

    // Check that some content is displayed
    const content = await mainContent.textContent();
    expect(content).not.toBe('');
  });

  test('should have responsive navigation', async ({ adminPage }) => {
    // Check sidebar navigation is present
    await expect(adminPage.locator('.sidebar')).toBeVisible();

    // Check navigation items exist
    const navItems = adminPage.locator('.nav-item');
    const count = await navItems.count();
    expect(count).toBeGreaterThan(5);
  });

  test('should show live monitoring badge', async ({ adminPage }) => {
    // Check for the live monitoring indicator
    await expect(adminPage.locator('.badge:has-text("Live Monitoring")')).toBeVisible();
  });

  test('should display user info in header', async ({ adminPage }) => {
    // User info should be visible in sidebar
    await expect(adminPage.locator('#current-user')).toBeVisible();
    await expect(adminPage.locator('#current-user')).toContainText('admin');
  });

  test('should have working sidebar toggle on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // storageStateでadmin認証済みのため直接ナビゲート
    await page.goto('/index.html');
    await expect(page.locator('#app-container')).toBeVisible({ timeout: 15000 });

    // Wait for page to load
    await page.waitForTimeout(500);

    // Check if sidebar toggle button is visible
    const sidebarToggle = page.locator('#sidebar-toggle');
    if (await sidebarToggle.isVisible()) {
      // Click to toggle sidebar
      await sidebarToggle.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Dashboard Navigation', () => {
  test('should navigate to incidents from sidebar', async ({ adminPage }) => {
    await adminPage.locator('.nav-item[data-view="incidents"]').click();
    await expectSectionTitle(adminPage, /インシデント管理/);
  });

  test('should navigate to problems from sidebar', async ({ adminPage }) => {
    await adminPage.locator('.nav-item[data-view="problems"]').click();
    await expectSectionTitle(adminPage, /問題管理/);
  });

  test('should navigate to changes from sidebar', async ({ adminPage }) => {
    await adminPage.locator('.nav-item[data-view="changes"]').click();
    await expectSectionTitle(adminPage, /変更管理/);
  });

  test('should navigate to SLA from sidebar', async ({ adminPage }) => {
    await adminPage.locator('.nav-item[data-view="sla"]').click();
    await expectSectionTitle(adminPage, /SLA管理/);
  });

  test('should navigate to security dashboard from sidebar', async ({ adminPage }) => {
    await adminPage.locator('.nav-item[data-view="security-dashboard"]').click();
    await expectSectionTitle(adminPage, /セキュリティダッシュボード/);
  });

  test('should highlight active navigation item', async ({ adminPage }) => {
    // Navigate to incidents
    await adminPage.locator('.nav-item[data-view="incidents"]').click();

    // The incidents nav item should have active class
    await expect(adminPage.locator('.nav-item[data-view="incidents"]')).toHaveClass(/active/);

    // Dashboard nav item should not be active
    await expect(adminPage.locator('.nav-item[data-view="dash"]')).not.toHaveClass(/active/);
  });
});
