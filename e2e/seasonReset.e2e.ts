import { test, expect } from '@playwright/test';
import { openGame, expectScreen, expectNoErrors } from './helpers';

/** Settings → Restart championship (Decision 16) */
test.describe('restarting the championship from Settings', () => {
  test.beforeEach(async ({ page }) => {
    // A Grand Prix save on round 5, and a career with some XP, written once before the game starts
    await page.addInitScript(() => {
      if (!localStorage.getItem('apex_season_v1')) {
        localStorage.setItem('apex_season_v1', JSON.stringify({ currentRaceIndex: 4 }));
      }
    });
  });

  test('asks twice, then the hub shows round 1 and the career is kept', async ({ page }) => {
    const errors = await openGame(page);
    await expect(page.locator('#hub-round')).toContainText('Round 5 of 8');
    const career = await page.evaluate(() => localStorage.getItem('apex_career_v1'));

    await page.locator('#hub-tab-settings').click();
    const button = page.locator('#season-reset');
    await expect(button).toHaveText('Restart championship');

    // The first tap only asks, naming the championship
    await button.click();
    await expect(button).toHaveText('Tap again to restart');
    await expect(page.locator('#season-reset-note')).toContainText('Grand Prix goes back to round 1');
    await expect(page.locator('#hub-round')).toContainText('Round 5 of 8');

    // The second tap restarts it and closes Settings
    await button.click();
    await expect(page.locator('#settings-screen')).not.toHaveClass(/active/);
    await expectScreen(page, 'hub');
    await expect(page.locator('#hub-round')).toContainText('Round 1 of 8');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('apex_season_v1') ?? '{}').currentRaceIndex)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('apex_career_v1'))).toBe(career);
    expectNoErrors(errors);
  });

  test('closing Settings after one tap restarts nothing', async ({ page }) => {
    const errors = await openGame(page);
    await page.locator('#hub-tab-settings').click();
    await page.locator('#season-reset').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-screen')).not.toHaveClass(/active/);

    await page.locator('#hub-tab-settings').click();
    await expect(page.locator('#season-reset')).toHaveText('Restart championship');
    await expect(page.locator('#hub-round')).toContainText('Round 5 of 8');
    expectNoErrors(errors);
  });
});
