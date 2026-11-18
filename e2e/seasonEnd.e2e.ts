import { test, expect, type Page } from '@playwright/test';
import { openGame, expectScreen, driveOffTheGrid, takeChequeredFlag, reloadGame, expectNoErrors } from './helpers';

/** Races the Grand Prix's last round and stops on its results */
async function raceTheFinale(page: Page): Promise<void> {
  await expect(page.locator('#hub-round')).toContainText('Round 8 of 8');
  await page.locator('#hub-start-weekend').click();
  await page.locator('#card-mode-skip').click();
  await page.locator('#btn-start-qualifying').click();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await driveOffTheGrid(page);
  await takeChequeredFlag(page);
  await expect(page.locator('#modal-race-results')).toHaveClass(/active/);
}

/** Championships finished, from the career save */
async function seasonsInCareer(page: Page): Promise<number> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('apex_career_v1') ?? '{}').seasons ?? 0);
}

test.describe('the season finale', () => {
  test.beforeEach(async ({ page }) => {
    // A Grand Prix save on its last round, written once before the game first starts
    await page.addInitScript(() => {
      if (!localStorage.getItem('apex_season_v1')) {
        localStorage.setItem('apex_season_v1', JSON.stringify({ currentRaceIndex: 7 }));
      }
    });
  });

  test('shows the podium, then a new season starts at round 1', async ({ page }) => {
    const errors = await openGame(page);
    await raceTheFinale(page);
    await page.locator('#btn-next-race').click();

    const podium = page.locator('#modal-podium');
    await expect(podium).toHaveClass(/active/);
    // Where you finish depends on the race, so any of the four endings
    await expect(page.locator('#podium-banner-text')).toHaveText(/World champion|Runner-up|On the podium|Season complete/);
    expect(await seasonsInCareer(page)).toBe(1);
    await page.locator('#btn-start-new-season').click();

    await expectScreen(page, 'hub');
    await expect(podium).not.toHaveClass(/active/);
    await expect(page.locator('#hub-round')).toContainText('Round 1 of 8');
    expectNoErrors(errors);
  });

  test('a reload on the results still ends with the podium, never a second finale (P15-16)', async ({ page }) => {
    const errors = await openGame(page);
    await raceTheFinale(page);

    await reloadGame(page);
    const podium = page.locator('#modal-podium');
    await expect(podium).toHaveClass(/active/);

    // Start weekend, under the podium, can't race the finale again
    await page.locator('#hub-start-weekend').dispatchEvent('click');
    await expect(page.locator('#modal-qualifying')).not.toHaveClass(/active/);
    await expect(podium).toHaveClass(/active/);

    // The trophy counted once
    expect(await seasonsInCareer(page)).toBe(1);
    expectNoErrors(errors);
  });
});
