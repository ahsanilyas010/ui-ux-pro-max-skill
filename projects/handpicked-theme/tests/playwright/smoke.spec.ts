import { test, expect } from '@playwright/test';
import { gotoPreview, collectConsoleErrors } from './helpers';

test.describe('HandPicked Editorial — smoke', () => {
  test('homepage renders header, hero, footer without console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoPreview(page, '/');
    await expect(page.locator('[data-header]')).toBeVisible();
    await expect(page.locator('.hero').first()).toBeVisible();
    await expect(page.locator('footer.footer')).toBeVisible();
    expect(errors.filter((e) => !/third-party|googletagmanager|facebook|klaviyo|vitals/i.test(e))).toEqual([]);
  });

  test('mobile menu drawer opens, traps focus and closes with Escape', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await gotoPreview(page, '/');
    await page.getByRole('button', { name: /open menu/i }).click();
    const drawer = page.locator('#MenuDrawer .drawer');
    await expect(drawer).toHaveClass(/is-open/);
    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/is-open/);
  });

  test('collection page filters and loads more', async ({ page }) => {
    await gotoPreview(page, '/collections/polo-1');
    const cards = page.locator('[data-product-card]');
    await expect(cards.first()).toBeVisible();
    const before = await cards.count();
    const loadMore = page.locator('[data-load-more]').first();
    if (await loadMore.isVisible().catch(() => false)) {
      await loadMore.click();
      await expect.poll(() => cards.count()).toBeGreaterThan(before);
    }
    await page.getByRole('button', { name: /filter/i }).first().click();
    await expect(page.locator('#FacetsDrawer .drawer')).toHaveClass(/is-open/);
  });

  test('PDP: pick a size, add to cart, drawer opens', async ({ page }) => {
    await gotoPreview(page, '/collections/polo-1');
    await page.locator('[data-product-card] a').first().click();
    await expect(page.locator('.product')).toBeVisible();
    const pill = page.locator('.pill:not(.is-disabled) input, .pill:not(.is-disabled)').first();
    if (await pill.count()) await pill.click({ force: true });
    await page.locator('[data-add-to-cart]').first().click();
    await expect(page.locator('#CartDrawer .drawer')).toHaveClass(/is-open/, { timeout: 15_000 });
    await expect(page.locator('#CartDrawer')).toContainText(/subtotal|total/i);
  });

  test('predictive search returns products', async ({ page }) => {
    await gotoPreview(page, '/');
    await page.getByRole('button', { name: /open search/i }).first().click();
    await page.locator('#SearchDrawer input[type="search"]').fill('polo');
    await expect(page.locator('#SearchDrawer [data-predictive-results], #SearchDrawer [role="listbox"]')).toContainText(/polo/i, { timeout: 15_000 });
  });

  test('brands A–Z page lists brands', async ({ page }) => {
    await gotoPreview(page, '/collections');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/brand/i);
    expect(await page.locator('a[href*="/collections/"]').count()).toBeGreaterThan(20);
  });
});
