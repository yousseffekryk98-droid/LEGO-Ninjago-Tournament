import { expect, test } from '@playwright/test';

const POWERUP_KEY = 'ninja-tournament-powerups-v1';
const GRAPHICS_KEY = 'ninja-tournament-graphics-v1';

test('default launch is Safe graphics and exposes graphics controls', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), GRAPHICS_KEY);
  await page.reload();

  const graphics = page.locator('#graphics-settings-button');
  await expect(graphics).toBeVisible();
  await expect(graphics).toContainText('SAFE GPU');
  await graphics.click();
  await expect(page.getByRole('heading', { name: 'Graphics Mode' })).toBeVisible();
  await expect(page.locator('.graphics-current')).toContainText('Safe');
  await expect(page.locator('.graphics-current')).toContainText('30 FPS');
  await expect(page.locator('.graphics-current')).toContainText('shadows off');
});

test('Shop & Loadout is a visible main-menu destination', async ({ page }) => {
  await page.goto('/');
  const shop = page.getByRole('button', { name: /SHOP & LOADOUT/i });
  await expect(shop).toBeVisible();
  await shop.click();
  await expect(page.getByRole('heading', { name: 'Shop & Loadout' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'OPEN FIGHTERS' })).toBeVisible();
  await expect(page.locator('[data-powerup-card]')).toHaveCount(3);
});

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

  await page.getByRole('button', { name: /SHOP & LOADOUT/i }).click();
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
