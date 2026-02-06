import { Page, expect, Locator } from '@playwright/test';

/**
 * Test helper utilities for ITSM E2E tests
 */

/**
 * Navigation helpers
 */
export async function navigateToView(page: Page, viewName: string): Promise<void> {
  await page.locator(`.nav-item[data-view="${viewName}"]`).click();
  await page.waitForTimeout(500); // Wait for view transition
}

/**
 * Wait for section title to contain expected text
 */
export async function expectSectionTitle(page: Page, expectedTitle: RegExp | string): Promise<void> {
  await expect(page.locator('#section-title')).toContainText(expectedTitle);
}

/**
 * Modal helpers
 */
export class ModalHelper {
  constructor(private page: Page) {}

  async waitForOpen(): Promise<void> {
    await expect(this.page.locator('#modal-overlay')).toBeVisible();
  }

  async waitForClose(): Promise<void> {
    await expect(this.page.locator('#modal-overlay')).toBeHidden();
  }

  async getTitle(): Promise<string> {
    return await this.page.locator('#modal-title').textContent() || '';
  }

  async clickButton(buttonText: string): Promise<void> {
    await this.page.locator('#modal-footer').getByRole('button', { name: buttonText }).click();
  }

  async close(): Promise<void> {
    await this.page.locator('#modal-close').click();
    await this.waitForClose();
  }

  async fillField(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.selectOption(selector, value);
  }
}

/**
 * Table helpers
 */
export class TableHelper {
  constructor(private page: Page, private tableSelector: string = 'table.data-table') {}

  async getRowCount(): Promise<number> {
    return await this.page.locator(`${this.tableSelector} tbody tr`).count();
  }

  async findRowByText(text: string): Promise<Locator> {
    return this.page.locator(`${this.tableSelector} tbody tr`).filter({ hasText: text });
  }

  async searchFor(searchValue: string, searchInputSelector?: string): Promise<void> {
    const selector = searchInputSelector || 'input[placeholder*="検索"]';
    await this.page.fill(selector, searchValue);
    // Give time for the filter to apply
    await this.page.waitForTimeout(500);
  }

  async clickRowButton(rowText: string, buttonTitle: string): Promise<void> {
    const row = await this.findRowByText(rowText);
    await row.getByRole('button', { name: buttonTitle }).click();
  }

  async clickRow(rowText: string): Promise<void> {
    const row = await this.findRowByText(rowText);
    await row.first().click();
  }
}

/**
 * Form helpers
 */
export class FormHelper {
  constructor(private page: Page) {}

  async fill(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async select(selector: string, value: string): Promise<void> {
    await this.page.selectOption(selector, value);
  }

  async check(selector: string): Promise<void> {
    await this.page.check(selector);
  }

  async uncheck(selector: string): Promise<void> {
    await this.page.uncheck(selector);
  }

  async submitButton(buttonText: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonText }).click();
  }
}

/**
 * Toast notification helpers
 */
export class ToastHelper {
  constructor(private page: Page) {}

  async waitForSuccess(timeout: number = 5000): Promise<void> {
    await expect(
      this.page.locator('.toastify[style*="10b981"], .toastify[style*="059669"]')
    ).toBeVisible({ timeout });
  }

  async waitForError(timeout: number = 5000): Promise<void> {
    await expect(
      this.page.locator('.toastify[style*="ef4444"], .toastify[style*="dc2626"]')
    ).toBeVisible({ timeout });
  }

  async waitForWarning(timeout: number = 5000): Promise<void> {
    await expect(
      this.page.locator('.toastify[style*="f59e0b"], .toastify[style*="d97706"]')
    ).toBeVisible({ timeout });
  }
}

/**
 * Screenshot and debugging helpers
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}

/**
 * Wait helpers
 */
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

export async function waitForDomContentLoaded(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
}

/**
 * API helpers for direct API interactions
 */
export class ApiHelper {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string = 'http://localhost:5000/api/v1', token: string = '') {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async get(endpoint: string): Promise<Response> {
    return fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async post(endpoint: string, data: object): Promise<Response> {
    return fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string): Promise<Response> {
    return fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Data generators for test data
 */
export const testDataGenerators = {
  /**
   * Generate unique incident title
   */
  incidentTitle(): string {
    return `Test Incident ${Date.now()}`;
  },

  /**
   * Generate unique username
   */
  username(): string {
    return `test_user_${Date.now()}`;
  },

  /**
   * Generate unique email
   */
  email(): string {
    return `test_${Date.now()}@example.com`;
  },

  /**
   * Generate unique employee number
   */
  employeeNumber(): string {
    return `EMP${String(Date.now()).slice(-8)}`;
  },

  /**
   * Generate unique SLA name
   */
  slaName(): string {
    return `Test SLA ${Date.now()}`;
  },

  /**
   * Generate unique ticket ID format
   */
  ticketId(prefix: string = 'INC'): string {
    return `${prefix}-${Date.now()}`;
  },
};
