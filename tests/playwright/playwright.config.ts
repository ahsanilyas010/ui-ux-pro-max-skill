import { defineConfig, devices } from '@playwright/test';

/**
 * Run against the UNPUBLISHED preview theme:
 *   BASE_URL=https://handpicked.pk PREVIEW_THEME_ID=1893xxxxxxx npx playwright test -c tests/playwright
 * The first navigation appends ?preview_theme_id so Shopify sets the preview cookie.
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../../test-results/html' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://handpicked.pk',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
