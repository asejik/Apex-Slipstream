import { test, expect, type Page } from '@playwright/test';

/** Records, from the very first moment of the page, when the logo goes and whether it faded */
async function watchSplash(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const record = window as unknown as { splashGoneAt?: number; splashFaded?: boolean };
    new MutationObserver(() => {
      const splash = document.getElementById('splash');
      if (splash?.classList.contains('splash-out')) record.splashFaded = true;
      if (record.splashGoneAt === undefined && document.body && !splash) record.splashGoneAt = performance.now();
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

async function splashRecord(page: Page): Promise<{ goneAt?: number; faded?: boolean }> {
  return page.evaluate(() => {
    const record = window as unknown as { splashGoneAt?: number; splashFaded?: boolean };
    return { goneAt: record.splashGoneAt, faded: record.splashFaded };
  });
}

/** The loading screen: only the logo, for a few seconds, then the hub */
test('the game opens on the logo, then shows the hub', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await watchSplash(page);
  await page.goto('/', { waitUntil: 'commit' });

  // In the page from the first paint, before any script
  const splash = page.locator('#splash');
  await expect(splash).toBeVisible();
  // Only the logo: the wordmark, and nothing to press
  await expect(splash).toHaveText(/Apex\s*Slipstream/i);
  await expect(splash.locator('button, a, input')).toHaveCount(0);
  // It covers the whole screen
  const cover = await splash.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, w: innerWidth, h: innerHeight };
  });
  expect(cover).toEqual({ x: 0, y: 0, width: cover.w, height: cover.h, w: cover.w, h: cover.h });

  // It goes once the game is ready, after at least 2.5 s, with a fade; the hub is usable
  await expect(splash).toHaveCount(0, { timeout: 30_000 });
  const record = await splashRecord(page);
  expect(record.goneAt).toBeGreaterThanOrEqual(2500);
  expect(record.faded).toBe(true);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'hub');
  await page.locator('#hub-tab-settings').click({ timeout: 2_000 });
  expect(errors).toEqual([]);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the logo goes without a fade', async ({ page }) => {
    await watchSplash(page);
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('#splash')).toBeVisible();
    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 30_000 });
    const record = await splashRecord(page);
    expect(record.goneAt).toBeGreaterThanOrEqual(2500);
    expect(record.faded).toBeUndefined();
  });
});
