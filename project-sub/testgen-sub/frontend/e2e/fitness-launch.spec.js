import { test, expect } from '@playwright/test';

test.describe('Fitness launch flow', () => {
  test('navigates to items list and opens first item config', async ({ page }) => {
    await page.goto('/fitness/assets/items');
    await expect(page.getByRole('heading', { name: '测试项库' })).toBeVisible({ timeout: 15_000 });

    const configLink = page.getByTestId('fitness-items-config').first();
    await expect(configLink).toBeVisible({ timeout: 10_000 });
    await configLink.click();

    await expect(page).toHaveURL(/\/fitness\/assets\/items\/.+\/config/);
    await expect(page.getByTestId('fitness-item-config')).toBeVisible();
  });
});
