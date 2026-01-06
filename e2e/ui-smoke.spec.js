const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

function resolveJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  const envPath = path.resolve(__dirname, '..', '.env');
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

const JWT_SECRET = resolveJwtSecret();
const adminUser = {
  id: 1,
  username: 'admin',
  role: 'admin',
  email: 'admin@itsm.local'
};

async function loginAsAdmin(page) {
  const token = jwt.sign(
    { id: adminUser.id, username: adminUser.username, role: adminUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  await page.addInitScript(
    ({ jwtToken, userInfo }) => {
      localStorage.setItem('itsm_auth_token', jwtToken);
      localStorage.setItem('itsm_user_info', JSON.stringify(userInfo));
    },
    { jwtToken: token, userInfo: adminUser }
  );
  await page.goto('/index.html');
  await expect(page.locator('#app-container')).toBeVisible({ timeout: 15000 });
}

test.describe('UI Smoke', () => {
  test('incidents create, update, delete', async ({ page }) => {
    const timestamp = Date.now();
    const incidentTitle = `PW Incident ${timestamp}`;

    await loginAsAdmin(page);

    await page.locator('.nav-item[data-view="incidents"]').click();
    await expect(page.locator('#section-title')).toHaveText(/インシデント管理/);

    await page.getByRole('button', { name: '新規インシデント作成' }).click();
    await page.fill('#incident-title', incidentTitle);
    await page.selectOption('#incident-priority', 'High');
    await page.fill('#incident-description', 'Playwright incident smoke test');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    const searchInput = page.getByPlaceholder('検索... (タイトル、チケットID、ステータス)');
    await searchInput.fill(incidentTitle);

    const createdRow = page.locator('table.data-table tbody tr').filter({
      hasText: incidentTitle
    });
    await expect(createdRow).toHaveCount(1);

    await createdRow.first().click();
    await page.selectOption('#incident-status', 'Resolved');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    await searchInput.fill(incidentTitle);
    const updatedRow = page.locator('table.data-table tbody tr').filter({
      hasText: incidentTitle
    });
    await expect(updatedRow).toHaveCount(1);

    await updatedRow.locator('button[title="削除"]').click();
    await page.locator('#modal-footer').getByRole('button', { name: '削除' }).click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    await searchInput.fill(incidentTitle);
    await expect(
      page.locator('table.data-table tbody tr').filter({ hasText: incidentTitle })
    ).toHaveCount(0);
  });

  test('user management create, update, delete', async ({ page }) => {
    const timestamp = Date.now();
    const username = `pw_user_${timestamp}`;
    const employeeNumber = `EMP${String(timestamp).slice(-6)}`;
    const email = `${username}@example.com`;

    await loginAsAdmin(page);

    await page.locator('.nav-item[data-view="settings_users"]').click();
    await expect(page.locator('#section-title')).toHaveText(/ユーザー・権限管理/);

    await page.getByRole('button', { name: '新規ユーザー作成' }).click();
    await page.fill('#user-username', username);
    await page.fill('#user-employee-number', employeeNumber);
    await page.fill('#user-fullname', 'Playwright User');
    await page.fill('#user-email', email);
    await page.fill('#user-password', 'Playwright123');
    await page.selectOption('#user-role', 'viewer');
    await page.locator('#modal-overlay').getByRole('button', { name: '作成' }).click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    await page.fill('#user-search-input', username);
    await page.getByRole('button', { name: '検索' }).click();

    const createdRow = page.locator('table.data-table tbody tr').filter({ hasText: username });
    await expect(createdRow).toHaveCount(1);

    await createdRow.locator('button[title="編集"]').click();
    await page.fill('#edit-user-fullname', 'Playwright Updated');
    await page.getByRole('button', { name: '更新' }).click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    await page.fill('#user-search-input', username);
    await page.getByRole('button', { name: '検索' }).click();

    const updatedRow = page.locator('table.data-table tbody tr').filter({ hasText: username });
    await expect(updatedRow).toHaveCount(1);

    await updatedRow.locator('button[title="削除"]').click();
    await page.getByRole('button', { name: '削除' }).click();
    await expect(page.locator('#modal-overlay')).toBeHidden();

    await page.fill('#user-search-input', username);
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.locator('table.data-table tbody tr').filter({ hasText: username })).toHaveCount(
      0
    );
  });
});
