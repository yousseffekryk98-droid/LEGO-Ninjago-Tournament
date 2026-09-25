import { expect, test, type Page } from '@playwright/test';
import { ROSTER, characterSearchText, getCharacterIdentity } from '../../src/features/characters';

const STORAGE_KEY = 'ninja-tournament-fan-remake-v1';

function trapBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return errors;
}

async function assertNoBrowserErrors(errors: string[]) {
  expect(errors, errors.join('\n')).toEqual([]);
}

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test('home, roster unlock/selection, and persistence work', async ({ page }) => {
  const errors = trapBrowserErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /NINJA/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /ENTER TOURNAMENT/i })).toBeVisible();

  await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    const save = raw ? JSON.parse(raw) : {};
    save.bankStuds = 100_000;
    localStorage.setItem(key, JSON.stringify(save));
  }, STORAGE_KEY);
  await page.reload();

  await page.getByRole('button', { name: /FIGHTERS/i }).click();
  const cards = page.locator('.fighter-card');
  await expect(cards).toHaveCount(ROSTER.length);

  const zane = page.locator('.fighter-card[data-id="zane-techno"]');
  await expect(zane).toBeVisible();
  await expect(zane.locator('.fighter-primary-name')).toHaveText('Zane');
  await expect(zane.locator('.fighter-variant')).toHaveText('Techno');

  await zane.locator('[data-preview="zane-techno"]').click();
  await expect(page.locator('#preview-character-name')).toHaveText('Zane');
  await expect(page.locator('#preview-character-variant')).toHaveText('Techno');
  await expect(page.locator('#character-preview-stage canvas')).toBeVisible();
  await expect(page.locator('#character-preview-stage')).toHaveAttribute('data-character-id', 'zane-techno');

  const select = zane.locator('.select-btn');
  await expect(select).toHaveText('SELECT');
  await select.click();
  const selectedZane = page.locator('.fighter-card[data-id="zane-techno"]');
  await expect(selectedZane.locator('.select-btn')).toHaveText('SELECTED');

  const search = page.locator('#fighter-search');
  await search.fill('Zane');
  const zaneMatches = ROSTER.filter((fighter) => characterSearchText(fighter).includes('zane')).length;
  await expect(page.locator('.fighter-card:not([hidden])')).toHaveCount(zaneMatches);
  await search.fill('');

  await page.getByRole('button', { name: '‹' }).click();
  await expect(page.locator('.selected-fighter .fighter-primary-name')).toHaveText('Zane');
  await expect(page.locator('.selected-fighter .fighter-variant')).toHaveText('Techno');
  await page.reload();
  await expect(page.locator('.selected-fighter .fighter-primary-name')).toHaveText('Zane');
  await expect(page.locator('.selected-fighter .fighter-variant')).toHaveText('Techno');
  await assertNoBrowserErrors(errors);
});

test('malformed and obsolete save data recovers to safe defaults', async ({ page }) => {
  const errors = trapBrowserErrors(page);
  await page.goto('/');
  await page.evaluate((key) => localStorage.setItem(key, '{not-json'), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('.selected-fighter .fighter-primary-name')).toHaveText('Lloyd');
  await expect(page.locator('.selected-fighter .fighter-variant')).toHaveText('Tournament');

  await page.evaluate((key) => {
    localStorage.setItem(key, JSON.stringify({
      bankStuds: -500,
      unlocked: ['removed-character'],
      selected: 'removed-character',
      bestWave: -9,
      bestRun: -100,
      totalRuns: -2,
      fighterXp: null,
      daily: { date: '1900-01-01', draws: 999, runs: 999, studs: 999999, bestWave: 999, claimed: ['run'] }
    }));
  }, STORAGE_KEY);
  await page.reload();
  await expect(page.locator('.selected-fighter .fighter-primary-name')).toHaveText('Lloyd');
  await expect(page.locator('.selected-fighter .fighter-variant')).toHaveText('Tournament');
  await expect(page.locator('.save-stats')).toContainText('0 banked studs');
  await expect(page.getByRole('button', { name: /DAILY DRAW & CHALLENGES \(1\)/i })).toBeVisible();
  await assertNoBrowserErrors(errors);
});

test('legacy and cross-era roster fighters can boot into the production arena', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trapBrowserErrors(page);
  await page.goto('/');

  const requiredCatalogIds = new Set([
    'catalog-sora',
    'catalog-wyldfyre',
    'catalog-frak',
    'catalog-geo',
    'catalog-euphrasia',
    'catalog-nadakhan',
    'catalog-aspheera',
    'catalog-overlord',
    'catalog-unagami',
    'catalog-king-vangelis-skull-sorcerer',
    'catalog-wojira',
    'catalog-nokt',
    'catalog-rox',
    'catalog-zarkt',
    'catalog-drix',
    'catalog-kur',
    'catalog-thunderfang'
  ]);
  const bootSample = ROSTER.filter((fighter, index) =>
    index < 58 || requiredCatalogIds.has(fighter.id) || (index >= 58 && (index - 58) % 28 === 0)
  );

  for (const fighter of bootSample) {
    await page.evaluate(({ key, fighterId }) => {
      const raw = localStorage.getItem(key);
      const save = raw ? JSON.parse(raw) : {};
      save.selected = fighterId;
      save.unlocked = Array.from(new Set([...(Array.isArray(save.unlocked) ? save.unlocked : []), fighterId]));
      localStorage.setItem(key, JSON.stringify(save));
    }, { key: STORAGE_KEY, fighterId: fighter.id });
    await page.reload();
    const identity = getCharacterIdentity(fighter);
    await expect(page.locator('.selected-fighter .fighter-primary-name')).toHaveText(identity.name);
    if (identity.variant) await expect(page.locator('.selected-fighter .fighter-variant')).toHaveText(identity.variant);
    await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).click();
    await expect(page.locator('#game-host canvas')).toBeVisible();
    await page.waitForTimeout(80);
  }

  await assertNoBrowserErrors(errors);
});

test('daily draw, challenge claims, and save state persist', async ({ page }) => {
  const errors = trapBrowserErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /DAILY DRAW/i }).click();
  await expect(page.locator('.draw-orb')).toHaveText('1');
  await page.getByRole('button', { name: /DRAW A PRIZE/i }).click();
  await expect(page.locator('#draw-result')).toContainText('STUD PRIZE');
  await expect(page.locator('.draw-orb')).toHaveText('0');

  await page.getByRole('button', { name: '‹' }).click();
  await page.reload();
  await page.getByRole('button', { name: /DAILY DRAW/i }).click();
  await expect(page.locator('.draw-orb')).toHaveText('0');

  await page.evaluate((key) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const raw = localStorage.getItem(key);
    const save = raw ? JSON.parse(raw) : {};
    save.daily = { date, draws: 0, runs: 1, studs: 3000, bestWave: 5, claimed: [] };
    localStorage.setItem(key, JSON.stringify(save));
  }, STORAGE_KEY);
  await page.reload();
  await page.getByRole('button', { name: /DAILY DRAW/i }).click();

  const claimButtons = page.locator('[data-claim]');
  await expect(claimButtons).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(claimButtons.nth(i)).toBeEnabled();
  await claimButtons.nth(0).click();
  await expect(page.locator('.draw-orb')).toHaveText('1');
  await expect(page.locator('[data-claim="run"]')).toHaveText('CLAIMED');
  await assertNoBrowserErrors(errors);
});

test('the complete seven-step Dojo tutorial is playable with keyboard controls', async ({ page }) => {
  test.setTimeout(75_000);
  const errors = trapBrowserErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /PLAY DOJO TUTORIAL/i }).click();
  await expect(page.locator('#dojo-host canvas')).toBeVisible();
  await expect(page.locator('#dojo-step-title')).toHaveText('Movement');

  // Fixed-step simulation makes tutorial progress independent of rendering FPS.
  await hold(page, 'ArrowRight', 950);
  await expect(page.locator('#dojo-step-title')).toHaveText('Attack');

  // Move from the known spawn point to the training dummy, then land actual hits.
  await hold(page, 'ArrowRight', 180);
  await hold(page, 'ArrowUp', 820);
  // Allow several real attack attempts because animation timing can vary on
  // slower CI/GPU runners. Stop as soon as the tutorial advances.
  for (let i = 0; i < 7; i++) {
    if ((await page.locator('#dojo-step-title').textContent()) === 'Jump') break;
    await page.keyboard.press('j');
    await page.waitForTimeout(420);
  }
  await expect(page.locator('#dojo-step-title')).toHaveText('Jump', { timeout: 10_000 });

  await page.keyboard.press('k');
  await expect(page.locator('#dojo-step-title')).toHaveText('Block');

  await hold(page, 'Shift', 1_450);
  await expect(page.locator('#dojo-step-title')).toHaveText('Grab & Throw');

  for (let i = 0; i < 6; i++) {
    if ((await page.locator('#dojo-step-title').textContent()) === 'Dodge') break;
    await page.keyboard.press('l');
    await page.waitForTimeout(300);
  }
  await expect(page.locator('#dojo-step-title')).toHaveText('Dodge', { timeout: 10_000 });

  await page.keyboard.press('q');
  await expect(page.locator('#dojo-step-title')).toHaveText('Spinjitzu / Special');
  await expect(page.locator('#dojo-special')).toHaveClass(/ready/);

  await page.keyboard.press('e');
  await expect(page.getByRole('heading', { name: 'Training Complete' })).toBeVisible({ timeout: 5_000 });
  await assertNoBrowserErrors(errors);
});

test('a tournament run renders, accepts controls, survives sustained play, and reaches game-over', async ({ page }) => {
  test.setTimeout(130_000);
  const errors = trapBrowserErrors(page);
  await page.goto('/');
  await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    const save = raw ? JSON.parse(raw) : {};
    save.selected = 'samukai';
    save.unlocked = Array.from(new Set([...(Array.isArray(save.unlocked) ? save.unlocked : []), 'samukai']));
    localStorage.setItem(key, JSON.stringify(save));
  }, STORAGE_KEY);
  await page.reload();
  await expect(page.locator('.selected-fighter')).toContainText('Samukai');
  await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).click();
  await expect(page.locator('#game-host canvas')).toBeVisible();
  await expect(page.locator('#wave-label')).toHaveText(/WAVE 1|BOSS/, { timeout: 7_500 });
  await expect(page.locator('#enemy-label')).toContainText('ENEMIES');

  await hold(page, 'ArrowRight', 450);
  await page.keyboard.press('j');
  await page.keyboard.press('k');
  await page.waitForTimeout(250);
  await page.keyboard.press('j');
  await hold(page, 'Shift', 400);
  await page.keyboard.press('q');

  // Leave the low-health fighter exposed after exercising controls; enemy AI must
  // be able to end the run without any test-only hooks. The current production
  // result UI is the score card (or a Continue prompt when the account has enough
  // banked studs), so assert the real overlay rather than an obsolete heading.
  const gameOver = page.locator('#game-over');
  await expect(gameOver).toBeVisible({ timeout: 100_000 });
  const finishRun = page.getByRole('button', { name: 'End run' });
  if (await finishRun.isVisible().catch(() => false)) await finishRun.click();
  await expect(page.getByRole('button', { name: 'RETRY' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'DAILY REWARDS' })).toBeVisible();

  const persistedRuns = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).totalRuns : 0;
  }, STORAGE_KEY);
  expect(persistedRuns).toBeGreaterThanOrEqual(1);
  await assertNoBrowserErrors(errors);
});

test('@mobile phone layout keeps gameplay controls usable', async ({ page }) => {
  const errors = trapBrowserErrors(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /ENTER TOURNAMENT/i })).toBeVisible();
  await page.getByRole('button', { name: /ENTER TOURNAMENT/i }).tap();
  await expect(page.locator('#game-host canvas')).toBeVisible();

  const controls = ['#joystick', '.action-button.attack', '.action-button.jump', '.action-button.block', '.action-button.grab', '#special-btn'];
  const viewport = page.viewportSize()!;
  for (const selector of controls) {
    const locator = page.locator(selector);
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box, `${selector} has no bounding box`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  }

  await page.locator('.action-button.attack').tap();
  await page.locator('.action-button.jump').tap();
  await assertNoBrowserErrors(errors);
});
