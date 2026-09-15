import { expect, test } from '@playwright/test';

test('PWA manifest, service worker and offline boot are release-ready', async ({ page, context }) => {
  await page.goto('/');

  const manifest = page.locator('link[rel="manifest"]');
  // Vite can normalize a root-relative public asset to a production-relative URL.
  // Both resolve to the same manifest, so verify the resource rather than a single serialization.
  await expect(manifest).toHaveAttribute('href', /(?:^|\/)manifest\.webmanifest$/);
  const manifestHref = await manifest.getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifestResponse = await page.request.get(new URL(manifestHref!, page.url()).toString());
  expect(manifestResponse.ok()).toBeTruthy();
  const manifestJson = await manifestResponse.json();
  expect(manifestJson.display).toBe('standalone');
  expect(manifestJson.orientation).toBe('landscape');

  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  }, undefined, { timeout: 15_000 });

  // Reload once under SW control so production JS/CSS is runtime-cached, then
  // prove the installed experience can boot without a network connection.
  await page.reload();
  await expect(page.getByRole('button', { name: /ENTER TOURNAMENT/i })).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /NINJA/i })).toBeVisible({ timeout: 10_000 });
  await context.setOffline(false);
});

test('controller support layer is present without changing keyboard controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.platform-status')).toHaveAttribute('data-controller', 'off');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: /ENTER TOURNAMENT/i })).toBeVisible();
});
