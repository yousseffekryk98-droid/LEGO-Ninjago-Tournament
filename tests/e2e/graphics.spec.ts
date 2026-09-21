import { expect, test } from '@playwright/test';

const PREF_KEY = 'ninja-tournament-graphics-v2';
const RECOVERY_KEY = 'ninja-tournament-gpu-recovery-v2';
const GUARD_KEY = 'ninja-tournament-render-guard-v2';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ pref, recovery, guard }) => {
    localStorage.removeItem(pref);
    localStorage.removeItem(recovery);
    localStorage.removeItem(guard);
  }, { pref: PREF_KEY, recovery: RECOVERY_KEY, guard: GUARD_KEY });
});

test('fresh launch defaults to Safe graphics and exposes the selector', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-graphics', 'safe');
  const button = page.locator('#graphics-settings-button');
  await expect(button).toBeVisible();
  await expect(button).toContainText('SAFE GPU');

  await button.click();
  await expect(page.getByRole('heading', { name: 'Graphics Mode' })).toBeVisible();
  await expect(page.locator('[data-graphics="auto"]')).toHaveClass(/active/);
  await expect(page.getByText(/30 FPS · 1× render scale/i)).toBeVisible();
});

test('Balanced graphics preference persists through a reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#graphics-settings-button').click();

  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.locator('[data-graphics="balanced"]').click()
  ]);

  await expect(page.locator('html')).toHaveAttribute('data-graphics', 'balanced');
  await expect(page.locator('#graphics-settings-button')).toContainText('BALANCED GPU');

  const stored = await page.evaluate((key) => localStorage.getItem(key), PREF_KEY);
  expect(stored).toBe('balanced');
});

test('GPU recovery flag forces the next launch back to Safe', async ({ page }) => {
  await page.addInitScript(({ pref, recovery }) => {
    localStorage.setItem(pref, 'high');
    localStorage.setItem(recovery, '1');
  }, { pref: PREF_KEY, recovery: RECOVERY_KEY });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-graphics', 'safe');
  await page.locator('#graphics-settings-button').click();
  await expect(page.getByText('SAFE FALLBACK ACTIVE')).toBeVisible();
});
