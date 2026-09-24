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
