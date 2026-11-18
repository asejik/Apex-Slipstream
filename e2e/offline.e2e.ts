import { test, expect } from '@playwright/test';
import { expectScreen, expectNoErrors } from './helpers';

/**
 * The built game, served as it is deployed, with its service worker (P15-14): after one
 * online visit it opens and races with no network at all.
 */
test('after one visit, the game opens and races offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expectScreen(page, 'hub');
  // The worker has installed: everything the build lists is in its cache
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const cache = await caches.open(names.find((name) => name.startsWith('apex-slipstream-'))!);
    const urls = (await cache.keys()).map((request) => new URL(request.url).pathname);
    const script = [...document.scripts].map((s) => new URL(s.src || location.href).pathname).find((p) => p.endsWith('.js'));
    return { names, urls, script };
  });
  expect(cached.names).toHaveLength(1);
  expect(cached.urls).toContain(cached.script);
  expect(cached.urls.some((url) => url.endsWith('.css'))).toBe(true);

  // No network: reload, and race
  await context.setOffline(true);
  await page.reload();
  await expectScreen(page, 'hub');
  await page.locator('#hub-quick-race').click();
  await page.locator('#quick-race-start').click();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await expectScreen(page, 'racing');
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => Number((await page.locator('#speed-value').textContent()) ?? '0'), { timeout: 30_000 })
    .toBeGreaterThan(30);
  await page.keyboard.up('ArrowUp');

  await context.setOffline(false);
  expectNoErrors(errors);
});
