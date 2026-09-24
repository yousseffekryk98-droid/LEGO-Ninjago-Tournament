import { expect, test } from '@playwright/test';

test('challenge arena exposes single, timed and boss modes and can start a run', async ({ page }) => {
  await page.goto('/');
  const hub = page.getByRole('button', { name: /CHALLENGE ARENA/i });
  await expect(hub).toBeVisible();
  await hub.click();

  await expect(page.getByRole('heading', { name: 'Challenge Arena' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Single Challenge' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Score Attack' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Boss Challenge' })).toBeVisible();

  const single = page.locator('.challenge-grid article').filter({ hasText: 'Single Challenge' });
  await single.getByRole('button', { name: 'START' }).click();
  await expect(page.locator('#challenge-game-host canvas')).toBeVisible();
  await expect(page.locator('.challenge-game')).toHaveAttribute('data-mode', 'first-gate');
  await expect(page.locator('.challenge-actions button')).toHaveCount(6);
  await expect(page.locator('.challenge-dpad button')).toHaveCount(4);
  await expect(page.locator('.challenge-element-kick')).toBeVisible();
});
