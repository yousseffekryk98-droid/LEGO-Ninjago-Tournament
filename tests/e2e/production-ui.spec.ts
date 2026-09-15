import { expect, test } from '@playwright/test';

const POWERUP_KEY = 'ninja-tournament-powerups-v1';

test('Temple Gallery exposes the full clean-room collection archive', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /TEMPLE GALLERY/i }).click();
  await expect(page.getByRole('heading', { name: 'Temple Gallery' })).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(43);
  await expect(page.locator('.gallery-codex')).toContainText('Anacondrai');
  await expect(page.locator('.gallery-codex')).toContainText('Nindroids');
  await expect(page.locator('.gallery-codex')).toContainText('Bombers');
});

test('equipped power-up applies to one arena run and is consumed', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      inventory: { 'iron-heart': 1, 'charged-scroll': 0, 'battle-focus': 0 },
      active: 'iron-heart'
    }));
  }, POWERUP_KEY);
  await page.reload();

  await page.getByRole('button', { name: /POWER-UPS/i }).click();
  const ironHeart = page.locator('[data-powerup-card="iron-heart"]');
  await expect(ironHeart).toHaveClass(/active/);
  await expect(ironHeart).toContainText('Owned ×1');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).click();
  await expect(page.locator('#game-host canvas')).toBeVisible();
  await expect(page.locator('#hearts')).toContainText('♥♥♥♥♥');

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), POWERUP_KEY);
  expect(state.active).toBeNull();
  expect(state.inventory['iron-heart']).toBe(0);
});
