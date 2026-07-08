import { test, expect } from '@playwright/test';

test.describe('URY POS smoke', () => {
  test('loads POS shell with three-tab navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /tables/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /register/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /orders/i })).toBeVisible();
  });

  test('navigates to floor view', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /tables/i }).click();
    await expect(page).toHaveURL(/\/table/);
  });
});
