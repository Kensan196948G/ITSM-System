const { test, expect } = require('@playwright/test');

async function resetTestData(request) {
  const res = await request.post('/api/test/reset');
  expect(res.ok()).toBeTruthy();
}

async function login(page) {
  await page.goto('/');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('user-table')).toBeVisible();
}

test.describe('User Settings', () => {
  test.beforeEach(async ({ request }) => {
    await resetTestData(request);
  });

  test('smoke: settings page and filters render', async ({ page }) => {
    await login(page);

    await expect(page.getByTestId('settings-user-search')).toBeVisible();
    await expect(page.getByTestId('settings-role-filter')).toBeVisible();
    await expect(page.getByTestId('settings-status-filter')).toBeVisible();
    await expect(page.getByTestId('settings-dept-filter')).toBeVisible();
    await expect(page.getByTestId('settings-page-size')).toBeVisible();
    await expect(page.getByTestId('role-permission-table')).toBeVisible();
    await expect(page.getByTestId('role-matrix-save')).toBeVisible();
    await expect(page.getByTestId('settings-audit-search')).toBeVisible();
    await expect(page.getByTestId('settings-audit-action-filter')).toBeVisible();
  });

  test('user CRUD flow (create -> edit -> delete)', async ({ page }) => {
    await login(page);

    await page.getByTestId('user-create-open').click();
    await page.getByTestId('user-form-userId').fill('pw.e2e.user');
    await page.getByTestId('user-form-name').fill('PW E2E User');
    await page.getByTestId('user-form-department').fill('品質保証');
    await page.getByTestId('user-form-email').fill('pw.e2e.user@example.local');
    await page.getByTestId('user-form-role').selectOption({ label: 'サービスデスク' });
    await page.getByTestId('user-form-status').selectOption('active');
    await page.getByTestId('modal-submit').click();

    await page.getByTestId('settings-user-search').fill('pw.e2e.user');
    await expect(page.getByTestId('user-table')).toContainText('PW E2E User');

    const editBtn = page.locator('[data-testid^="user-edit-"]').first();
    await editBtn.click();
    await page.getByTestId('user-form-name').fill('PW E2E User Updated');
    await page.getByTestId('user-form-role').selectOption({ label: 'SecOps' });
    await page.getByTestId('modal-submit').click();

    await expect(page.getByTestId('user-table')).toContainText('PW E2E User Updated');
    await expect(page.getByTestId('user-table')).toContainText('SecOps');

    const deleteBtn = page.locator('[data-testid^="user-delete-"]').first();
    await deleteBtn.click();
    await page.getByTestId('modal-submit').click();

    await expect(page.getByTestId('user-table')).not.toContainText('PW E2E User Updated');
  });

  test('audit page smoke: render, sort, paging, diff button visibility', async ({ page }) => {
    await login(page);
    await page.getByTestId('nav-audit').click();

    await expect(page.getByTestId('audit-page')).toBeVisible();
    await expect(page.getByTestId('audit-table')).toBeVisible();
    await expect(page.getByTestId('settings-audit-search')).toBeVisible();
    await expect(page.getByTestId('settings-audit-action-filter')).toBeVisible();

    await page.getByTestId('audit-sort-actor').click();
    await page.getByTestId('audit-sort-actor').click();

    await page.getByTestId('settings-audit-page-size').selectOption('10');
    await page.getByTestId('audit-page-next').click().catch(() => {});

    const diffButtons = page.locator('[data-testid^="audit-diff-"]');
    if (await diffButtons.count()) {
      await diffButtons.first().click();
      await expect(page.getByTestId('audit-diff-table')).toBeVisible();
      await page.getByTestId('modal-close').click();
    }
  });
});
