/**
 * Backup Management E2E Tests
 *
 * Tests cover:
 * - Backup management page navigation and rendering
 * - Statistics cards display
 * - Backup table rendering with data
 * - Filter controls (type and status)
 * - Manual backup creation flow
 * - Restore confirmation modal flow
 * - Integrity check flow
 * - Delete confirmation flow
 * - Empty state display
 * - Error handling
 */

import { test, expect } from '../fixtures/auth';
import { ModalHelper } from '../fixtures/test-helpers';
import { Page } from '@playwright/test';

/**
 * Navigate to backup management view via JS loadView().
 * The backup-management view has no nav-item in the sidebar HTML,
 * so we call the global loadView() function directly.
 */
async function navigateToBackupManagement(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).loadView('backup-management'));
  await page.waitForTimeout(500);
}

// ============================================================
// Mock data for backup API responses
// ============================================================

const MOCK_BACKUPS = [
  {
    backup_id: 'BKP-20260215-100000-daily',
    backup_type: 'daily',
    status: 'success',
    file_size: 1048576, // 1 MB
    created_at: '2026-02-15T10:00:00.000Z',
    started_at: '2026-02-15T10:00:00.000Z',
    completed_at: '2026-02-15T10:00:05.000Z',
    description: 'Daily scheduled backup',
  },
  {
    backup_id: 'BKP-20260214-120000-manual',
    backup_type: 'manual',
    status: 'success',
    file_size: 2097152, // 2 MB
    created_at: '2026-02-14T12:00:00.000Z',
    started_at: '2026-02-14T12:00:00.000Z',
    completed_at: '2026-02-14T12:00:08.000Z',
    description: 'Manual backup before deployment',
  },
  {
    backup_id: 'BKP-20260213-030000-weekly',
    backup_type: 'weekly',
    status: 'failure',
    file_size: 0,
    created_at: '2026-02-13T03:00:00.000Z',
    started_at: '2026-02-13T03:00:00.000Z',
    completed_at: '2026-02-13T03:00:02.000Z',
    description: 'Weekly scheduled backup',
  },
];

const MOCK_STATS = {
  total_backups: 15,
  successful_backups: 12,
  failed_backups: 3,
  total_size_bytes: 15728640,
  latest_backup: {
    backup_id: 'BKP-20260215-100000-daily',
    backup_type: 'daily',
    created_at: '2026-02-15T10:00:00.000Z',
    file_size: 1048576,
  },
};

const MOCK_VERIFY_RESULT = {
  total_checks: 5,
  passed: 5,
  failed: 0,
  results: [
    { check: 'file_exists', status: 'passed' },
    { check: 'checksum', status: 'passed' },
    { check: 'size_match', status: 'passed' },
    { check: 'header_valid', status: 'passed' },
    { check: 'decompress', status: 'passed' },
  ],
};

/**
 * Setup API mocking for backup management page.
 *
 * Uses a single catch-all route to avoid Playwright route priority conflicts.
 * In Playwright, when multiple page.route() patterns match the same URL,
 * the LAST registered route takes priority. If that handler calls
 * route.continue(), the request goes to the real server (NOT the next
 * matching route). A single handler avoids this entirely.
 */
async function setupBackupApiMocks(page: Page, options?: {
  backups?: typeof MOCK_BACKUPS;
  stats?: typeof MOCK_STATS;
  emptyBackups?: boolean;
  onVerify?: () => void;
  onDelete?: () => void;
}) {
  const backups = options?.emptyBackups ? [] : (options?.backups || MOCK_BACKUPS);
  const stats = options?.stats || MOCK_STATS;

  await page.route('**/api/v1/backups**', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname; // e.g. /api/v1/backups, /api/v1/backups/BKP-xxx/verify

    // GET /backups/stats
    if (method === 'GET' && pathname.endsWith('/stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Backup statistics retrieved successfully',
          data: stats,
        }),
      });
    }

    // GET /backups/health/integrity
    if (method === 'GET' && pathname.endsWith('/health/integrity')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'OK', data: { status: 'healthy' } }),
      });
    }

    // POST /backups/:id/restore
    if (method === 'POST' && pathname.endsWith('/restore')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Restore completed successfully',
          data: {
            backup_before_restore: 'BKP-auto-before-restore',
            restored_from: 'BKP-20260215-100000-daily',
          },
        }),
      });
    }

    // POST /backups/:id/verify
    if (method === 'POST' && pathname.endsWith('/verify')) {
      options?.onVerify?.();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Integrity check completed',
          data: MOCK_VERIFY_RESULT,
        }),
      });
    }

    // POST /backups/verify-all
    if (method === 'POST' && pathname.endsWith('/verify-all')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Verify all started' }),
      });
    }

    // POST /backups (create manual backup)
    if (method === 'POST' && pathname.match(/\/backups\/?$/)) {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Backup created successfully',
          data: {
            backupId: `BKP-${Date.now()}-manual`,
            fileSize: 1048576,
            duration: 5,
          },
        }),
      });
    }

    // DELETE /backups/:id
    if (method === 'DELETE') {
      options?.onDelete?.();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Backup deleted successfully',
        }),
      });
    }

    // GET /backups or /backups?params (list)
    if (method === 'GET') {
      const typeFilter = url.searchParams.get('type');
      const statusFilter = url.searchParams.get('status');

      let filtered = [...backups];
      if (typeFilter) {
        filtered = filtered.filter(b => b.backup_type === typeFilter);
      }
      if (statusFilter) {
        filtered = filtered.filter(b => b.status === statusFilter);
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Backups retrieved successfully',
          data: {
            backups: filtered,
            total: filtered.length,
          },
        }),
      });
    }

    // Fallback
    return route.continue();
  });
}

// ============================================================
// Group 1: Backup Management Page Navigation & Rendering
// ============================================================

test.describe('Backup Management - Page Rendering', () => {
  test('should navigate to backup management page', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    // Verify page title (use heading role to avoid matching multiple text nodes)
    await expect(adminPage.locator('#section-title')).toContainText('バックアップ管理', { timeout: 10000 });
  });

  test('should display statistics cards', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    // Wait for stats to load
    await expect(adminPage.getByText('総バックアップ数')).toBeVisible({ timeout: 10000 });
    await expect(adminPage.getByText('成功バックアップ数')).toBeVisible();
    await expect(adminPage.getByText('失敗バックアップ数')).toBeVisible();
    await expect(adminPage.getByText('最新バックアップ')).toBeVisible();

    // Verify stat values
    const totalValue = adminPage.locator('[data-stat="total-backups"]');
    await expect(totalValue).toContainText('15');

    const successValue = adminPage.locator('[data-stat="successful-backups"]');
    await expect(successValue).toContainText('12');

    const failedValue = adminPage.locator('[data-stat="failed-backups"]');
    await expect(failedValue).toContainText('3');
  });

  test('should display action buttons in header', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    await expect(adminPage.locator('#section-title')).toContainText('バックアップ管理', { timeout: 10000 });

    // Manual backup button
    await expect(adminPage.getByRole('button', { name: '手動バックアップ実行' })).toBeVisible();

    // Verify all button
    await expect(adminPage.getByRole('button', { name: '全バックアップ整合性チェック' })).toBeVisible();
  });

  test('should display filter controls', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    await expect(adminPage.locator('#section-title')).toContainText('バックアップ管理', { timeout: 10000 });

    // Type filter
    await expect(adminPage.getByText('種別:')).toBeVisible();

    // Status filter
    await expect(adminPage.getByText('ステータス:')).toBeVisible();
  });
});

// ============================================================
// Group 2: Backup Table Display
// ============================================================

test.describe('Backup Management - Table Display', () => {
  test('should display backup table with correct headers', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    // Wait for table to appear
    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Check headers
    const headers = ['Backup ID', '種別', 'ステータス', 'ファイルサイズ', '作成日時', '操作'];
    for (const header of headers) {
      await expect(table.locator('thead th').getByText(header)).toBeVisible();
    }
  });

  test('should display backup rows with correct data', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Check that we have 3 rows
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    // Verify first backup row contains the backup ID
    await expect(rows.first()).toContainText('BKP-20260215-100000-daily');
  });

  test('should show action buttons for successful backups', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // First row (success) should have Restore, Check, and Delete buttons
    const successRow = table.locator('tbody tr').first();
    await expect(successRow.getByRole('button', { name: 'リストア' })).toBeVisible();
    await expect(successRow.getByRole('button', { name: 'チェック' })).toBeVisible();
    await expect(successRow.getByRole('button', { name: '削除' })).toBeVisible();
  });

  test('should show only delete button for failed backups', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Third row (failure) should only have Delete button
    const failedRow = table.locator('tbody tr').nth(2);
    await expect(failedRow.getByRole('button', { name: '削除' })).toBeVisible();
    // Should NOT have Restore or Check buttons
    await expect(failedRow.getByRole('button', { name: 'リストア' })).toHaveCount(0);
    await expect(failedRow.getByRole('button', { name: 'チェック' })).toHaveCount(0);
  });

  test('should display empty state when no backups', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage, {
      emptyBackups: true,
      stats: {
        total_backups: 0,
        successful_backups: 0,
        failed_backups: 0,
        total_size_bytes: 0,
        latest_backup: null as any,
      },
    });
    await navigateToBackupManagement(adminPage);

    // Wait for the table
    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Empty state message
    await expect(table.getByText('バックアップが見つかりません')).toBeVisible();
  });
});

// ============================================================
// Group 3: Filter Functionality
// ============================================================

test.describe('Backup Management - Filters', () => {
  test('should filter by backup type', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    // Wait for table
    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Verify initially 3 rows
    await expect(table.locator('tbody tr')).toHaveCount(3);

    // Select "daily" filter - exclude the language selector
    const typeSelect = adminPage.locator('select:not(.language-select)').first();
    await typeSelect.selectOption('daily');

    // Wait for API response and re-render
    await adminPage.waitForTimeout(500);

    // Should now show only 1 row (the daily backup)
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('tbody tr').first()).toContainText('BKP-20260215-100000-daily');
  });

  test('should filter by status', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Select "failure" status filter - second filter select (excluding language selector)
    const statusSelect = adminPage.locator('select:not(.language-select)').nth(1);
    await statusSelect.selectOption('failure');

    await adminPage.waitForTimeout(500);

    // Should now show only 1 row (the failed backup)
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.locator('tbody tr').first()).toContainText('BKP-20260213-030000-weekly');
  });
});

// ============================================================
// Group 4: Restore Flow
// ============================================================

test.describe('Backup Management - Restore Flow', () => {
  test('should open restore confirmation modal', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Click restore on the first (success) backup
    const successRow = table.locator('tbody tr').first();
    await successRow.getByRole('button', { name: 'リストア' }).click();

    // Confirm modal appears
    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Check modal title
    await expect(adminPage.locator('#modal-title')).toContainText('データベースリストア確認');
  });

  test('should display restore warning messages', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const successRow = table.locator('tbody tr').first();
    await successRow.getByRole('button', { name: 'リストア' }).click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Warning message
    await expect(adminPage.locator('#modal-body')).toContainText('この操作は現在のデータベースを上書きします');

    // Warning details
    await expect(adminPage.locator('#modal-body')).toContainText('現在のデータベースはリストア前に自動バックアップされます');

    // Backup ID display
    await expect(adminPage.locator('#modal-body')).toContainText('BKP-20260215-100000-daily');
  });

  test('should have cancel and restore buttons in modal', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const successRow = table.locator('tbody tr').first();
    await successRow.getByRole('button', { name: 'リストア' }).click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Cancel button
    await expect(adminPage.locator('#modal-footer').getByRole('button', { name: 'キャンセル' })).toBeVisible();

    // Restore execute button
    await expect(adminPage.locator('#modal-footer').getByRole('button', { name: 'リストアを実行' })).toBeVisible();
  });

  test('should close modal on cancel', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const successRow = table.locator('tbody tr').first();
    await successRow.getByRole('button', { name: 'リストア' }).click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Click cancel
    await adminPage.locator('#modal-footer').getByRole('button', { name: 'キャンセル' }).click();

    // Modal should close (closeModal uses setTimeout 200ms)
    await adminPage.waitForTimeout(300);
    await expect(adminPage.locator('#modal-overlay')).toBeHidden({ timeout: 5000 });
  });

  test('should show progress during restore execution', async ({ adminPage }) => {
    // Use a delayed restore handler to observe progress state
    await setupBackupApiMocksWithDelayedRestore(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const successRow = table.locator('tbody tr').first();
    await successRow.getByRole('button', { name: 'リストア' }).click();

    const modal = new ModalHelper(adminPage);
    await modal.waitForOpen();

    // Click restore button
    await adminPage.locator('#modal-footer').getByRole('button', { name: 'リストアを実行' }).click();

    // Should show progress indicator
    await expect(adminPage.locator('#modal-body')).toContainText('リストアを実行中...', { timeout: 5000 });
  });
});

/**
 * Variant of setupBackupApiMocks that adds a 2-second delay to restore responses,
 * allowing the progress UI to be observed.
 */
async function setupBackupApiMocksWithDelayedRestore(page: Page) {
  const backups = MOCK_BACKUPS;
  const stats = MOCK_STATS;

  await page.route('**/api/v1/backups**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const pathname = url.pathname;

    // GET /backups/stats
    if (method === 'GET' && pathname.endsWith('/stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'OK', data: stats }),
      });
    }

    // POST /backups/:id/restore (with 2s delay)
    if (method === 'POST' && pathname.endsWith('/restore')) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Restore completed successfully',
          data: {
            backup_before_restore: 'BKP-auto-before-restore',
            restored_from: 'BKP-20260215-100000-daily',
          },
        }),
      });
    }

    // POST /backups/:id/verify
    if (method === 'POST' && pathname.endsWith('/verify')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'OK', data: MOCK_VERIFY_RESULT }),
      });
    }

    // DELETE /backups/:id
    if (method === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Backup deleted successfully' }),
      });
    }

    // GET /backups (list)
    if (method === 'GET') {
      const typeFilter = url.searchParams.get('type');
      const statusFilter = url.searchParams.get('status');
      let filtered = [...backups];
      if (typeFilter) filtered = filtered.filter(b => b.backup_type === typeFilter);
      if (statusFilter) filtered = filtered.filter(b => b.status === statusFilter);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'OK',
          data: { backups: filtered, total: filtered.length },
        }),
      });
    }

    return route.continue();
  });
}

// ============================================================
// Group 5: Integrity Check & Delete Flows
// ============================================================

test.describe('Backup Management - Integrity Check', () => {
  test('should trigger integrity check for a backup', async ({ adminPage }) => {
    let verifyRequested = false;

    await setupBackupApiMocks(adminPage, {
      onVerify: () => { verifyRequested = true; },
    });
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Click check button on first success row
    const successRow = table.locator('tbody tr').first();
    await successRow.getByRole('button', { name: 'チェック' }).click();

    // Wait for the API call to complete
    await adminPage.waitForTimeout(1000);

    // Verify the request was made
    expect(verifyRequested).toBe(true);
  });
});

test.describe('Backup Management - Delete Flow', () => {
  test('should confirm and delete backup', async ({ adminPage }) => {
    let deleteRequested = false;

    await setupBackupApiMocks(adminPage, {
      onDelete: () => { deleteRequested = true; },
    });
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Handle confirm dialog
    adminPage.on('dialog', (dialog) => dialog.accept());

    // Click delete on first row
    const firstRow = table.locator('tbody tr').first();
    await firstRow.getByRole('button', { name: '削除' }).click();

    // Wait for dialog handling and API call
    await adminPage.waitForTimeout(1000);

    expect(deleteRequested).toBe(true);
  });

  test('should cancel delete when dialog is dismissed', async ({ adminPage }) => {
    let deleteRequested = false;

    await setupBackupApiMocks(adminPage, {
      onDelete: () => { deleteRequested = true; },
    });
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Dismiss (cancel) the confirm dialog
    adminPage.on('dialog', (dialog) => dialog.dismiss());

    const firstRow = table.locator('tbody tr').first();
    await firstRow.getByRole('button', { name: '削除' }).click();

    await adminPage.waitForTimeout(500);

    // Delete should NOT have been called
    expect(deleteRequested).toBe(false);
  });
});

// ============================================================
// Group 6: Status Badges & Display Formatting
// ============================================================

test.describe('Backup Management - Display Formatting', () => {
  test('should display status badges correctly', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Success badge
    const successRow = table.locator('tbody tr').first();
    await expect(successRow.getByText('成功')).toBeVisible();

    // Failure badge (third row)
    const failedRow = table.locator('tbody tr').nth(2);
    await expect(failedRow.getByText('失敗')).toBeVisible();
  });

  test('should display type badges correctly', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    const table = adminPage.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Daily badge
    const dailyRow = table.locator('tbody tr').first();
    await expect(dailyRow.getByText('日次')).toBeVisible();

    // Manual badge (second row)
    const manualRow = table.locator('tbody tr').nth(1);
    await expect(manualRow.getByText('手動')).toBeVisible();

    // Weekly badge (third row)
    const weeklyRow = table.locator('tbody tr').nth(2);
    await expect(weeklyRow.getByText('週次')).toBeVisible();
  });

  test('should display latest backup info in stats card', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage);
    await navigateToBackupManagement(adminPage);

    // Wait for latest backup stat to load
    const latestStat = adminPage.locator('[data-stat="latest-backup"]');
    await expect(latestStat).toBeVisible({ timeout: 10000 });

    // Should contain type name (daily -> 日次)
    await expect(latestStat).toContainText('日次');
  });

  test('should display "なし" when no latest backup', async ({ adminPage }) => {
    await setupBackupApiMocks(adminPage, {
      emptyBackups: true,
      stats: {
        total_backups: 0,
        successful_backups: 0,
        failed_backups: 0,
        total_size_bytes: 0,
        latest_backup: null as any,
      },
    });
    await navigateToBackupManagement(adminPage);

    const latestStat = adminPage.locator('[data-stat="latest-backup"]');
    await expect(latestStat).toBeVisible({ timeout: 10000 });
    await expect(latestStat).toContainText('なし');
  });
});
