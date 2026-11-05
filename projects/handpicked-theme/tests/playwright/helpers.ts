import { Page } from '@playwright/test';

export async function gotoPreview(page: Page, path = '/') {
  const id = process.env.PREVIEW_THEME_ID;
  const url = id ? `${path}${path.includes('?') ? '&' : '?'}preview_theme_id=${id}` : path;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Shopify shows a preview bar; make sure it does not intercept clicks.
  await page.addStyleTag({ content: '#preview-bar-iframe{display:none !important}' }).catch(() => {});
}

export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
