import { test, expect } from '@playwright/test';
import { gotoPreview } from './helpers';

/**
 * COD quick-order form. The submit test only runs when COD_TEST_MODE=true is set on the app
 * (orders are tagged "test") AND E2E_COD_SUBMIT=1 is passed; cancel the order afterwards.
 */
test.describe('COD quick order', () => {
  test('form validates Pakistani phone and required fields', async ({ page }) => {
    await gotoPreview(page, '/collections/polo-1');
    await page.locator('[data-product-card] a').first().click();
    const pill = page.locator('.pill:not(.is-disabled)').first();
    if (await pill.count()) await pill.click({ force: true });
    await page.locator('[data-cod-open]').first().click();
    const form = page.locator('[data-cod-form]');
    await expect(form).toBeVisible();
    await form.locator('[name="phone"]').fill('12345');
    await form.locator('[type="submit"]').click();
    await expect(form.locator('.field--error')).toHaveCount(await form.locator('.field--error').count());
    await expect(form.locator('.field--error').first()).toBeVisible();
    // honeypot must stay empty and hidden
    await expect(form.locator('[name="website"]')).toBeHidden();
  });

  test('submits a COD order in test mode', async ({ page }) => {
    test.skip(process.env.E2E_COD_SUBMIT !== '1', 'set E2E_COD_SUBMIT=1 with the app in COD_TEST_MODE');
    await gotoPreview(page, '/collections/polo-1');
    await page.locator('[data-product-card] a').first().click();
    const pill = page.locator('.pill:not(.is-disabled)').first();
    if (await pill.count()) await pill.click({ force: true });
    await page.locator('[data-cod-open]').first().click();
    const form = page.locator('[data-cod-form]');
    await form.locator('[name="name"]').fill('Playwright Test');
    await form.locator('[name="phone"]').fill('03001234567');
    await form.locator('[name="city"]').fill('Lahore');
    await form.locator('[name="address"]').fill('Test address, DHA Phase 5, Lahore');
    await form.locator('[type="submit"]').click();
    await expect(page.locator('[data-cod-success]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-cod-success]')).toContainText(/#\d+/);
  });
});
