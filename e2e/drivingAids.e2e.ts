import { test, expect, Page } from '@playwright/test';
import { openGame, expectScreen, expectNoErrors, driveOffTheGrid, reloadGame } from './helpers';

type Line = { visible: boolean; geometry: { getAttribute(name: string): { count: number; array: ArrayLike<number> } | undefined } };
type Game = {
  scene: { getObjectByName(name: string): Line | undefined };
  world: { aids: { choices: { racingLine: boolean; brakeAssist: boolean; steerAssist: boolean } } };
};

/** The racing line on screen: shown, how many points, and how many of them are lit */
function racingLine(page: Page): Promise<{ visible: boolean; points: number; lit: number }> {
  return page.evaluate(() => {
    const line = (window as unknown as { __game: Game }).__game.scene.getObjectByName('racing-line');
    const colours = line?.geometry.getAttribute('color');
    let lit = 0;
    if (colours) for (let i = 3; i < colours.array.length; i += 4) if (colours.array[i]! > 0) lit++;
    return { visible: line?.visible ?? false, points: colours?.count ?? 0, lit };
  });
}

function aidChoices(page: Page): Promise<{ racingLine: boolean; brakeAssist: boolean; steerAssist: boolean }> {
  return page.evaluate(() => ({ ...(window as unknown as { __game: Game }).__game.world.aids.choices }));
}

async function startQuickRace(page: Page): Promise<void> {
  await page.locator('#hub-quick-race').click();
  await page.locator('#quick-race-start').click();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await expectScreen(page, 'racing');
}

test.describe('driving aids (Decision 11 and 16)', () => {
  test('are all off at first: no line on the road', async ({ page }) => {
    const errors = await openGame(page);
    expect(await aidChoices(page)).toEqual({ racingLine: false, brakeAssist: false, steerAssist: false });
    await startQuickRace(page);
    expect((await racingLine(page)).visible).toBe(false);
    expectNoErrors(errors);
  });

  test('switched on in Settings, they reach the car, show the line ahead and are kept', async ({ page }) => {
    const errors = await openGame(page);
    await page.locator('#hub-tab-settings').click();
    for (const aid of ['racingLine', 'brakeAssist', 'steerAssist']) {
      await page.locator(`[data-setting="${aid}"] button[data-value="true"]`).click();
    }
    expect(await aidChoices(page)).toEqual({ racingLine: true, brakeAssist: true, steerAssist: true });
    await page.keyboard.press('Escape');

    // Not on the hub, but on the grid and in the race
    expect((await racingLine(page)).visible).toBe(false);
    await startQuickRace(page);
    await driveOffTheGrid(page);
    const line = await racingLine(page);
    expect(line.visible).toBe(true);
    expect(line.points).toBeGreaterThan(100);
    // Only the stretch around the car is drawn, not the whole lap
    expect(line.lit).toBeGreaterThan(20);
    expect(line.lit).toBeLessThan(line.points);

    await reloadGame(page);
    expect(await aidChoices(page)).toEqual({ racingLine: true, brakeAssist: true, steerAssist: true });
    expectNoErrors(errors);
  });
});
