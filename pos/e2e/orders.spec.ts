import { test, expect } from '@playwright/test';

test.describe('URY POS Orders', () => {
  test('navigates to orders and shows status sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /orders/i }).click();
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.getByText(/order status/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /draft/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /unbilled/i })).toBeVisible();
  });

  test('draft tab shows KOT filter chips when orders exist or empty state', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /in kitchen/i })).toBeVisible();
  });
});
