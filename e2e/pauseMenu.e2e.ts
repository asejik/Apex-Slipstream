import { test, expect } from '@playwright/test';
import { openGame, expectScreen, expectNoErrors } from './helpers';

/** Qualifying belongs to a championship weekend (P09-R01) */
test.describe('the pause menu offers Qualifying only in a championship weekend', () => {
  test('a Quick Race has no Qualifying', async ({ page }) => {
    const errors = await openGame(page);
    await page.locator('#hub-quick-race').click();
    await page.locator('#quick-race-start').click();
    await expectScreen(page, 'grid');
    await page.locator('#tyre-confirm').click();
    await expectScreen(page, 'racing');

    await page.keyboard.press('Escape');
    await expectScreen(page, 'paused');
    await expect(page.locator('#btn-qualify-toggle')).toBeHidden();
    expectNoErrors(errors);
  });

  test('a Time Trial has no Qualifying', async ({ page }) => {
    const errors = await openGame(page);
    await page.locator('#hub-time-trial').click();
    await page.locator('#time-trial-start').click();
    await expectScreen(page, 'racing');

    await page.keyboard.press('Escape');
    await expectScreen(page, 'paused');
    await expect(page.locator('#btn-qualify-toggle')).toBeHidden();
    expectNoErrors(errors);
  });

  test('a championship race still offers it', async ({ page }) => {
    const errors = await openGame(page);
    await page.locator('#hub-start-weekend').click();
    await page.locator('#card-mode-skip').click();
    await page.locator('#btn-start-qualifying').click();
    await expectScreen(page, 'grid');
    await page.locator('#tyre-confirm').click();
    await expectScreen(page, 'racing');

    await page.keyboard.press('Escape');
    await expectScreen(page, 'paused');
    await expect(page.locator('#btn-qualify-toggle')).toBeVisible();
    expectNoErrors(errors);
  });
});
