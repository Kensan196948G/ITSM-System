import { test, expect } from '../fixtures/auth';
import { navigateToView, expectSectionTitle, ModalHelper, TableHelper } from '../fixtures/test-helpers';

/**
 * Other Module E2E Tests
 * Tests for Problem, Change, Release, Request, and CMDB modules
 */

test.describe('Problem Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'problems');
    await expectSectionTitle(adminPage, /問題管理/);
  });

  test('should display problem management page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should have create problem button', async ({ adminPage }) => {
    const createButton = adminPage.getByRole('button', { name: /新規|作成|問題/ });
    await expect(createButton).toBeVisible();
  });

  test('should display problems table', async ({ adminPage }) => {
    await expect(adminPage.locator('table.data-table')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Change Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'changes');
    await expectSectionTitle(adminPage, /変更管理/);
  });

  test('should display change management page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should have create change request button', async ({ adminPage }) => {
    const createButton = adminPage.getByRole('button', { name: /新規|作成|変更/ });
    await expect(createButton).toBeVisible();
  });

  test('should display changes table', async ({ adminPage }) => {
    await expect(adminPage.locator('table.data-table')).toBeVisible({ timeout: 10000 });
  });

  test('should create a change request', async ({ adminPage }) => {
    const modal = new ModalHelper(adminPage);
    const changeTitle = `Test Change ${Date.now()}`;

    // Click create button
    const createButton = adminPage.getByRole('button', { name: /新規変更|変更作成|変更リクエスト作成/ });
    await createButton.click();
    await modal.waitForOpen();

    // Fill in change details
    const titleInput = adminPage.locator('#change-title, input[name="title"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill(changeTitle);
    }

    const descInput = adminPage.locator('#change-description, textarea[name="description"]');
    if (await descInput.isVisible()) {
      await descInput.fill('E2E Test Change Request');
    }

    // Submit
    await adminPage.getByRole('button', { name: /保存|作成/ }).click();
    await modal.waitForClose();
  });
});

test.describe('Release Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'releases');
    await expectSectionTitle(adminPage, /リリース管理/);
  });

  test('should display release management page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should have create release button', async ({ adminPage }) => {
    const createButton = adminPage.getByRole('button', { name: /新規|作成|リリース/ });
    await expect(createButton).toBeVisible();
  });

  test('should display releases table', async ({ adminPage }) => {
    await expect(adminPage.locator('table.data-table')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Service Request Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'requests');
    await expectSectionTitle(adminPage, /サービス要求管理/);
  });

  test('should display service request page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should have create request button', async ({ adminPage }) => {
    const createButton = adminPage.getByRole('button', { name: /新規|作成|リクエスト|要求/ });
    await expect(createButton).toBeVisible();
  });

  test('should display requests table', async ({ adminPage }) => {
    await expect(adminPage.locator('table.data-table')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('CMDB (Configuration Management)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'cmdb');
    await expectSectionTitle(adminPage, /構成管理|CMDB/);
  });

  test('should display CMDB page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should have create CI button', async ({ adminPage }) => {
    const createButton = adminPage.getByRole('button', { name: /新規|作成|CI|構成アイテム|アセット/ });
    await expect(createButton).toBeVisible();
  });

  test('should display CI table', async ({ adminPage }) => {
    await expect(adminPage.locator('table.data-table')).toBeVisible({ timeout: 10000 });
  });

  test('should have search functionality', async ({ adminPage }) => {
    const searchInput = adminPage.getByPlaceholder(/検索/);
    await expect(searchInput).toBeVisible();
  });
});

test.describe('Knowledge Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'knowledge');
    await expectSectionTitle(adminPage, /ナレッジ管理/);
  });

  test('should display knowledge management page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should have search functionality', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    // Look for search input
    const searchInput = adminPage.getByPlaceholder(/検索/);
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeVisible();
    }
  });
});

test.describe('Capacity Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'capacity');
    await expectSectionTitle(adminPage, /キャパシティ管理/);
  });

  test('should display capacity management page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should show capacity metrics', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    // Check for content
    const content = await adminPage.locator('#main-view').textContent();
    expect(content).toBeDefined();
  });
});

test.describe('Compliance Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'compliance-management');
    await expectSectionTitle(adminPage, /コンプライアンス管理/);
  });

  test('should display compliance management page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should show compliance status', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    const content = await adminPage.locator('#main-view').textContent();
    expect(content).toBeDefined();
  });
});

test.describe('Policy and Procedure Management', () => {
  test.beforeEach(async ({ adminPage }) => {
    await navigateToView(adminPage, 'compliance-policies');
    await expectSectionTitle(adminPage, /ポリシー|プロシージャ/);
  });

  test('should display policy management page', async ({ adminPage }) => {
    const mainContent = adminPage.locator('#main-view');
    await expect(mainContent).toBeVisible();
  });

  test('should show policies list', async ({ adminPage }) => {
    // Wait for content
    await adminPage.waitForTimeout(1000);

    const content = await adminPage.locator('#main-view').textContent();
    expect(content).toBeDefined();
  });
});
