import { test, expect } from '@playwright/test';

test.describe('URY Mosaic KDS smoke', () => {
  test('loads KDS shell at production unit URL', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const hasTabs = await page.getByRole('button', { name: /to cook|للتحضير|à préparer/i }).isVisible().catch(() => false);
    const hasKdsLogin = await page.getByText(/kitchen display|شاشة المطبخ|écran cuisine/i).isVisible().catch(() => false);
    const hasFrappeLogin = await page.getByRole('heading', { name: /login to frappe/i }).isVisible().catch(() => false);
    expect(hasTabs || hasKdsLogin || hasFrappeLogin).toBeTruthy();
  });

  test('Bar station URL resolves', async ({ page }) => {
    const base = process.env.MOSAIC_BASE_URL || 'http://localhost:8004/URYMosaic/Kitchen';
    const barUrl = base.replace(/\/[^/]+$/, '/Bar');
    await page.goto(barUrl);
    await expect(page.locator('body')).toBeVisible();
  });
});
