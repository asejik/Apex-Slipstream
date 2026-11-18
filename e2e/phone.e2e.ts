import { test, expect } from '@playwright/test';
import { openGame, expectScreen, expectNoErrors, advance, speed } from './helpers';

/** A phone held sideways, about 360 px tall: the smallest screen the game is played on */
test.use({ viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

test('on a phone, the hub fits and the touch throttle drives the car', async ({ page }, testInfo) => {
  const errors = await openGame(page);

  // Nothing on the hub runs off the side of the screen
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await testInfo.attach('hub-phone', { body: await page.screenshot(), contentType: 'image/png' });

  // A quick race, started by touch
  await page.locator('#hub-quick-race').tap();
  await page.locator('#quick-race-start').tap();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').tap();
  await expectScreen(page, 'racing');
  const throttle = page.locator('#touch-throttle');
  await expect(throttle).toBeVisible();

  // Hold the throttle with a finger until the car is moving
  const box = await throttle.boundingBox();
  if (!box) throw new Error('The throttle button has no size');
  const cdp = await page.context().newCDPSession(page);
  const finger = [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: finger });
  for (let i = 0; i < 20 && (await speed(page)) <= 30; i++) await advance(page, 1);
  expect(await speed(page)).toBeGreaterThan(30);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await testInfo.attach('racing-phone', { body: await page.screenshot(), contentType: 'image/png' });

  expectNoErrors(errors);
});

test.describe('held upright', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('a phone held upright asks to be turned sideways', async ({ page }) => {
    const errors = await openGame(page);
    await expect(page.locator('#rotate-prompt')).toBeVisible();
    expectNoErrors(errors);
  });
});
