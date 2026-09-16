import { expect, test } from '@playwright/test';

test('production art layer decorates the hub, shop and live arena', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-production-art', 'v2');
  await expect(page.locator('main.menu-screen')).toHaveAttribute('data-art-polished', 'true');
  await expect(page.locator('.production-menu-kicker')).toContainText('ISLAND TOURNAMENT');

  await page.getByRole('button', { name: /SHOP & LOADOUT/i }).click();
  await expect(page.locator('#powerup-overlay')).toHaveAttribute('data-art-polished', 'true');
  await expect(page.locator('.shop-production-tabs')).toBeVisible();
  await expect(page.locator('[data-powerup-card]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).click();
  await expect(page.locator('#game-host canvas')).toBeVisible();
  await expect.poll(async () => page.locator('#game-host').getAttribute('data-production-scene')).toBe('ready');
  await expect(page.locator('main.game-screen')).toHaveAttribute('data-art-polished', 'true');
});
