import { expect, test } from '@playwright/test';

test('pre-launch arena exposes classic and overhead player-follow views', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).click();

  await expect(page.locator('#game-host canvas')).toBeVisible();
  const view = page.locator('#camera-view-btn');
  await expect(view).toBeVisible();
  await expect(view).toContainText('CLASSIC');
  await expect(view).toHaveAttribute('aria-pressed', 'false');

  await view.click();
  await expect(view).toContainText('OVERHEAD');
  await expect(view).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('v');
  await expect(view).toContainText('CLASSIC');
  await expect(view).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#game-host canvas')).toBeVisible();
});

test('Elemental Gauntlet path renders the curated route and starts a real duel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /ELEMENTAL GAUNTLET.*VERSUS PATH/i }).click();

  await expect(page.getByRole('heading', { name: 'Elemental Gauntlet' })).toBeVisible();
  await expect(page.locator('.gauntlet-node')).toHaveCount(16);
  await expect(page.getByRole('button', { name: /ALL FIGHTERS MARATHON.*50 DUELS/i })).toBeVisible();

  await page.getByRole('button', { name: /START ELEMENTAL GAUNTLET/i }).click();
  await expect(page.locator('#game-host canvas')).toBeVisible();
  await expect(page.locator('#wave-label')).toContainText('DUEL 1', { timeout: 7_500 });
  await expect(page.locator('#boss-health')).not.toHaveClass(/hidden/);
});

test('fighter cards use distinct SVG portraits and five-step potential tracks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /FIGHTERS/i }).click();

  const cards = page.locator('.fighter-card');
  await expect(cards).toHaveCount(51);
  await expect(cards.first().locator('.fighter-avatar img')).toBeVisible();
  await expect(cards.first().locator('.potential-levels i')).toHaveCount(5);

  const kai = page.locator('.fighter-card[data-id="kai-tournament"]');
  const zane = page.locator('.fighter-card[data-id="zane-techno"]');
  const kaiSrc = await kai.locator('.fighter-avatar img').getAttribute('src');
  const zaneSrc = await zane.locator('.fighter-avatar img').getAttribute('src');
  expect(kaiSrc).toMatch(/^data:image\/svg\+xml/);
  expect(zaneSrc).toMatch(/^data:image\/svg\+xml/);
  expect(kaiSrc).not.toBe(zaneSrc);
});
