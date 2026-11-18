import { test, expect } from '@playwright/test';
import { openGame, expectScreen, driveOffTheGrid, takeChequeredFlag, reloadGame, expectNoErrors } from './helpers';

test('a championship weekend: qualifying, tyres, race, results, standings, next round', async ({ page }) => {
  const errors = await openGame(page);
  await expect(page.locator('#hub-round')).toContainText('Round 1 of 8');

  // Start the weekend and skip qualifying
  await page.locator('#hub-start-weekend').click();
  await expect(page.locator('#modal-qualifying')).toHaveClass(/active/);
  await page.locator('#card-mode-skip').click();
  await page.locator('#btn-start-qualifying').click();

  // Tyre choice, then the lights
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await driveOffTheGrid(page);

  // The flag, then the results with every driver and the XP earned
  await takeChequeredFlag(page);
  const results = page.locator('#modal-race-results');
  await expect(results).toHaveClass(/active/);
  await expect(page.locator('#results-table-body tr')).toHaveCount(20);
  await expect(page.locator('#results-xp')).toContainText('XP');

  // Standings from the results, and back to the results
  await page.locator('#btn-view-standings-from-results').click();
  await expect(page.locator('#modal-standings')).toHaveClass(/active/);
  await expect(page.locator('#standings-table-body tr')).toHaveCount(20);
  await page.locator('#btn-continue-from-standings').click();
  await expect(results).toHaveClass(/active/);

  // Next race: the hub moves on to round 2
  await page.locator('#btn-next-race').click();
  await expectScreen(page, 'hub');
  await expect(page.locator('#hub-round')).toContainText('Round 2 of 8');
  const seasonChip = await page.locator('#hub-season-chip').textContent();
  const level = await page.locator('#hub-level-chip').textContent();

  // A reload mid-season keeps the round, the points and the XP
  await reloadGame(page);
  await expect(page.locator('#hub-round')).toContainText('Round 2 of 8');
  await expect(page.locator('#hub-season-chip')).toHaveText(seasonChip ?? '');
  await expect(page.locator('#hub-level-chip')).toHaveText(level ?? '');

  expectNoErrors(errors);
});
