import { expect, test } from '@playwright/test';

const POWERUP_KEY = 'ninja-tournament-powerups-v1';
const SAVE_KEY = 'ninja-tournament-fan-remake-v1';
const SAVE_CACHE_KEY = `${SAVE_KEY}:cache`;

test('Temple Gallery exposes the full clean-room collection archive', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /TEMPLE GALLERY/i }).click();
  await expect(page.getByRole('heading', { name: 'Temple Gallery' })).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(51);
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


test('tournament HUD exposes collectible stud economy and stage presentation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).click();
  await expect(page.locator('#game-host canvas')).toBeVisible();
  await expect(page.locator('.stud-icon')).toBeVisible();
  await expect(page.locator('#stud-count')).toHaveText('0');
  await expect(page.locator('.stud-copy')).toContainText('RUN STUDS');
  await expect(page.locator('.stud-copy')).toContainText('BANK');
  await expect(page.locator('#stage-banner')).toBeAttached();
  await expect(page.locator('#boss-health')).toBeAttached();
});


test('all fighters are open and free play starts with unlimited Spinjitzu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /FIGHTERS/i }).click();
  await expect(page.locator('.fighter-card')).toHaveCount(51);
  await expect(page.locator('.fighter-card.locked')).toHaveCount(0);
  await expect(page.locator('[data-unlock]')).toHaveCount(0);

  await page.getByRole('button', { name: '‹' }).click();
  await page.getByRole('button', { name: /FREE PLAY.*UNLIMITED SPINJITZU/i }).click();
  await expect(page.locator('#game-host canvas')).toBeVisible();
  await expect(page.locator('#special-btn')).toHaveAttribute('aria-label', 'SPINJITZU ∞');
  await expect(page.locator('#special-btn')).toHaveClass(/ready/);
  await expect(page.locator('#special-meter')).toHaveAttribute('style', /width:\s*100%/);
});

test('banked money is mirrored into the recovery save cache', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /DAILY DRAW/i }).click();
  await page.getByRole('button', { name: /DRAW A PRIZE/i }).click();
  await expect(page.locator('#draw-result')).toContainText('STUD PRIZE');

  const snapshots = await page.evaluate(({ primary, cache }) => ({
    primary: JSON.parse(localStorage.getItem(primary) ?? '{}'),
    cache: JSON.parse(localStorage.getItem(cache) ?? '{}')
  }), { primary: SAVE_KEY, cache: SAVE_CACHE_KEY });

  expect(snapshots.primary.bankStuds).toBeGreaterThan(0);
  expect(snapshots.cache.bankStuds).toBe(snapshots.primary.bankStuds);
  expect(snapshots.cache.unlocked).toHaveLength(51);
});


test('keyboard controls can be rebound and persist', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /KEYBOARD CONTROLS/i }).click();
  await expect(page.getByRole('heading', { name: 'Keyboard Controls' })).toBeVisible();

  const punch = page.locator('[data-control-action="punch"]');
  await expect(punch).toHaveText('J');
  await punch.click();
  await page.keyboard.press('f');
  await expect(page.locator('[data-control-action="punch"]')).toHaveText('F');

  await page.getByRole('button', { name: 'DONE' }).click();
  await page.reload();
  await page.getByRole('button', { name: /KEYBOARD CONTROLS/i }).click();
  await expect(page.locator('[data-control-action="punch"]')).toHaveText('F');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ninja-tournament-controls-v1') ?? '{}'));
  expect(saved.punch).toBe('KeyF');
  expect(saved.kick).toBe('KeyI');
});

test('mobile arena exposes separate punch and kick controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).click();
  await expect(page.getByRole('button', { name: 'Punch' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kick' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grab' })).toBeVisible();
});


test('ported production shop presents tabs, rarity art and main-menu destination', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /SHOP & LOADOUT/i }).click();
  await expect(page.locator('.shop-production-tabs')).toBeVisible();
  await expect(page.locator('[data-powerup-card]')).toHaveCount(3);
  await expect(page.locator('[data-powerup-card="iron-heart"]')).toHaveAttribute('data-rarity', 'UNCOMMON');
  await expect(page.locator('[data-powerup-card="charged-scroll"]')).toHaveAttribute('data-rarity', 'RARE');
  await expect(page.locator('[data-powerup-card="battle-focus"]')).toHaveAttribute('data-rarity', 'ELITE');
  await expect(page.locator('.production-item-art')).toHaveCount(3);
});


test('fighter select owns laptop viewport scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: /FIGHTERS/i }).click();
  const panel = page.locator('main.panel-screen');
  await expect(panel).toBeVisible();
  const before = await panel.evaluate((node) => ({
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    scrollTop: node.scrollTop
  }));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  await panel.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => panel.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});

test('free play exposes rebindable Tornado of Creation ultimate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /KEYBOARD CONTROLS/i }).click();
  await expect(page.locator('[data-control-action="ultimate"]')).toHaveText('R');
  await page.getByRole('button', { name: 'DONE' }).click();

  await page.getByRole('button', { name: /FREE PLAY.*UNLIMITED SPINJITZU/i }).click();
  const ultimate = page.getByRole('button', { name: /Tornado of Creation ultimate/i });
  await expect(ultimate).toBeVisible();
  await ultimate.click();
  await expect(page.locator('#message')).toContainText('TORNADO OF CREATION');
});
