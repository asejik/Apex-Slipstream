import { test, expect, Page } from '@playwright/test';
import { openGame, expectScreen, expectNoErrors, driveOffTheGrid, advance, speed } from './helpers';
import { RELOAD_OFFER_MS } from '../src/app/GraphicsRecovery';

type LoseContext = { loseContext(): void; restoreContext(): void };
type ResetWindow = Window & { __loseContext: LoseContext };

/** Takes the graphics away, as a phone does under memory pressure */
async function loseGraphics(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context') as LoseContext | null | undefined;
    if (!extension) throw new Error('WEBGL_lose_context is not available');
    (window as unknown as ResetWindow).__loseContext = extension;
    extension.loseContext();
  });
}

/** How many triangles the next real frame draws */
function trianglesDrawn(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const game = (window as unknown as { __game: { renderer: { info: { render: { triangles: number } } } } }).__game;
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(game.renderer.info.render.triangles)));
      })
  );
}

/** The sky the wet road mirrors, and the one on the road itself */
function roadReflection(page: Page): Promise<{ sky: string | null; road: string | null }> {
  return page.evaluate(() => {
    type Texture = { uuid: string } | null;
    type Game = {
      weatherEffects: { skyReflection: Texture };
      trackGroup: { getObjectByName(name: string): { material: { envMap: Texture } } | undefined } | null;
    };
    const game = (window as unknown as { __game: Game }).__game;
    const road = game.trackGroup?.getObjectByName('road');
    return { sky: game.weatherEffects.skyReflection?.uuid ?? null, road: road?.material.envMap?.uuid ?? null };
  });
}

/** A wet Quick Race, so the road mirrors the rain sky that a reset wipes */
async function startWetQuickRace(page: Page): Promise<void> {
  await page.locator('#hub-quick-race').click();
  await page.locator('[data-quick="weather"] button[data-value="wet"]').click();
  await page.locator('#quick-race-start').click();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await expectScreen(page, 'racing');
}

test.describe('the graphics can be taken away and come back (Decision 16)', () => {
  test('the race pauses behind a card, then carries on once the graphics are back', async ({ page }) => {
    const errors = await openGame(page);
    await startWetQuickRace(page);
    await driveOffTheGrid(page);
    const before = await roadReflection(page);
    expect(before.road).not.toBeNull();
    expect(before.road).toBe(before.sky);

    await loseGraphics(page);
    await expect(page.locator('#graphics-reset')).toBeVisible();
    await expectScreen(page, 'paused');
    await expect(page.locator('#graphics-reset-reload')).toBeHidden();

    await page.evaluate(() => (window as unknown as ResetWindow).__loseContext.restoreContext());
    await expect(page.locator('#graphics-reset')).toBeHidden();
    expect(await page.evaluate(() => (document.getElementById('game-canvas') as HTMLCanvasElement).getContext('webgl2')?.isContextLost())).toBe(false);
    // The scene is drawn again, and the wet road mirrors a newly made sky (a reset wipes the old)
    expect(await trianglesDrawn(page)).toBeGreaterThan(0);
    const after = await roadReflection(page);
    expect(after.sky).not.toBe(before.sky);
    expect(after.road).toBe(after.sky);

    // Back to the race, and it still drives
    await page.keyboard.press('Escape');
    await expectScreen(page, 'racing');
    await page.keyboard.down('ArrowUp');
    await advance(page, 2);
    await page.keyboard.up('ArrowUp');
    expect(await speed(page)).toBeGreaterThan(30);
    expectNoErrors(errors);
  });

  test('graphics that stay away offer a reload', async ({ page }) => {
    const errors = await openGame(page);
    await loseGraphics(page);
    await expect(page.locator('#graphics-reset')).toBeVisible();
    await expect(page.locator('#graphics-reset-reload')).toBeVisible({ timeout: RELOAD_OFFER_MS + 5000 });
    await page.locator('#graphics-reset-reload').click();
    // The reload brings the game back with its graphics
    await expect(page.locator('#graphics-reset')).toBeHidden();
    await expectScreen(page, 'hub');
    expectNoErrors(errors);
  });
});
