import { test, expect, type Page } from '@playwright/test';

/** Records, from the very first moment of the page, when the logo goes and whether it faded */
async function watchSplash(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const record = window as unknown as { splashGoneAt?: number; splashFaded?: boolean; splashSeen?: boolean };
    new MutationObserver(() => {
      const splash = document.getElementById('splash');
      if (splash) record.splashSeen = true;
      if (splash?.classList.contains('splash-out')) record.splashFaded = true;
      // Gone only after it was there: while the page is still arriving it may not be parsed yet
      if (record.splashGoneAt === undefined && record.splashSeen && !splash) record.splashGoneAt = performance.now();
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

async function splashRecord(page: Page): Promise<{ goneAt?: number; faded?: boolean }> {
  return page.evaluate(() => {
    const record = window as unknown as { splashGoneAt?: number; splashFaded?: boolean };
    return { goneAt: record.splashGoneAt, faded: record.splashFaded };
  });
}

/** The loading screen: only the logo, for about 5 seconds, then the hub */
test('the game opens on the logo, then shows the hub', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await watchSplash(page);
  await page.goto('/', { waitUntil: 'commit' });

  // In the page from the first paint, before any script. Checked in one look: on CI's slow
  // renderer, separate checks can outlast the logo's 5 s (R10-05)
  await page.waitForSelector('#splash', { state: 'attached' });
  const look = await page.evaluate(() => {
    const el = document.getElementById('splash')!;
    const r = el.getBoundingClientRect();
    return {
      shown: getComputedStyle(el).display !== 'none' && r.width > 0,
      text: el.textContent ?? '',
      controls: el.querySelectorAll('button, a, input').length,
      cover: { x: r.x, y: r.y, width: r.width, height: r.height },
      screen: { width: innerWidth, height: innerHeight }
    };
  });
  expect(look.shown).toBe(true);
  // Only the logo: the wordmark, and nothing to press
  expect(look.text).toMatch(/Apex\s*Slipstream/i);
  expect(look.controls).toBe(0);
  // It covers the whole screen
  expect(look.cover).toEqual({ x: 0, y: 0, ...look.screen });
  const splash = page.locator('#splash');

  // It goes once the game is ready, after at least 5 s, with a fade; the hub is usable
  await expect(splash).toHaveCount(0, { timeout: 120_000 });
  const record = await splashRecord(page);
  expect(record.goneAt).toBeGreaterThanOrEqual(5000);
  expect(record.faded).toBe(true);
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'hub');
  await page.locator('#hub-tab-settings').click();
  expect(errors).toEqual([]);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the logo goes without a fade', async ({ page }) => {
    await watchSplash(page);
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForSelector('#splash', { state: 'attached' });
    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 120_000 });
    const record = await splashRecord(page);
    expect(record.goneAt).toBeGreaterThanOrEqual(5000);
    expect(record.faded).toBeUndefined();
  });
});

test.describe('a phone held upright', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test('sees the logo first, above the rotate card, then the card with a landscape button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' });
    // The logo is on top: the element at the centre of the screen belongs to it
    await page.waitForSelector('#splash', { state: 'attached' });
    const onTop = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('#splash') !== null);
    expect(onTop).toBe(true);

    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 120_000 });
    await expect(page.locator('#rotate-prompt')).toBeVisible();
    // Chromium can lock the screen sideways in fullscreen, so it offers to
    await expect(page.locator('#rotate-lock')).toBeVisible();
  });
});

