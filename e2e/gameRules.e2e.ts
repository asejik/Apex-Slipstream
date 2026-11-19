import { test, expect, type Page } from '@playwright/test';
import { openGame, expectScreen, driveOffTheGrid, takeChequeredFlag, completeLap, advance, expectNoErrors } from './helpers';

/**
 * The game's rules, checked in the running game (P09-R03). These replace tests that matched
 * lines of src/main.ts by regex: they read state through the dev-only `__game` handle and
 * the screen, so they hold however main.ts is organised. Where a rule is about what the game
 * hands on (which kind of race earns XP), the call is wrapped in the page and recorded.
 */

/** The parts of the running game these checks read or call (its private state, for tests only) */
interface GameHandle {
  rivalId: string | null;
  career: {
    awardRace(input: unknown): unknown;
    headToHead(driverId: string): { won: number; lost: number };
    stats: { ghostBeats: number };
  };
  aiDriverManager: { difficultyLimit: number; group: { visible: boolean } };
  towerView: { rivalId: string | null };
  seasonManager: { championship: { id: string } };
  startQuickRace(setup: { trackIndex: number; weather: 'dry' | 'wet'; laps: number }): void;
  startTimeTrial(setup: { trackIndex: number; tyre: string }): void;
  raceWeather: string;
  isSolo: boolean;
  isPractice: boolean;
  isChampionshipRace: boolean;
  activeTire: string;
  lastLapGhost: { hasGhost: boolean };
  togglePracticeWeather(): void;
  changePracticeTyres(compound: string): void;
  cycleTrack(): void;
  loadTrack(index: number): void;
  playerCar: { body: number; leans: boolean };
  latestSlipstream: { isBoostActive: boolean };
  drawFrame(input: unknown, surface: unknown, frameDelta: number): void;
  inputManager: { getInputState(): unknown };
  trackSpline: { evaluateSurface(position: unknown): unknown };
  vehiclePhysics: { state: { position: unknown } };
  camera: { fov: number };
  totalRaceElapsedSeconds: number;
  audioEngine: { ctx: { state: string } | null };
  miniMap: { displayedWidth: number };
  renderer: { info: { memory: { geometries: number } } };
}

type TestWindow = Window & { __game: GameHandle; __awards: unknown[] };

/** Runs `fn` in the page with the game (`arg` passed through); returns its result */
function game<T, A = undefined>(page: Page, fn: (g: GameHandle, arg: A) => T, arg?: A): Promise<T> {
  return page.evaluate(
    ({ source, value }) => new Function('g', 'arg', `return (${source})(g, arg);`)((window as unknown as TestWindow).__game, value),
    { source: fn.toString(), value: arg }
  ) as Promise<T>;
}

/** Saved state written once before the game first starts (text is saved as it is) */
async function seed(page: Page, entries: Record<string, unknown>): Promise<void> {
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }, entries);
}

/** A career far enough on to unlock every championship, livery and difficulty */
const VETERAN = { apex_career_v1: { xp: 60_000 } };

async function startChampionshipRace(page: Page): Promise<void> {
  await page.locator('#hub-start-weekend').click();
  await page.locator('#card-mode-skip').click();
  await page.locator('#btn-start-qualifying').click();
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await expectScreen(page, 'racing');
}

async function startQuickRace(page: Page, trackIndex = 0): Promise<void> {
  await game(page, (g, i) => g.startQuickRace({ trackIndex: i, weather: 'dry', laps: 3 }), trackIndex);
  await expectScreen(page, 'grid');
  await page.locator('#tyre-confirm').click();
  await expectScreen(page, 'racing');
}

/** Records what the career is handed for each race */
async function watchCareer(page: Page): Promise<void> {
  await game(page, (g) => {
    const award = g.career.awardRace.bind(g.career);
    const record: unknown[] = [];
    (window as unknown as TestWindow).__awards = record;
    g.career.awardRace = (input: unknown) => {
      record.push(input);
      return award(input);
    };
  });
}

async function awards(page: Page): Promise<Array<{ kind: string; trackId: string; rivalId?: string; beatRival?: boolean }>> {
  return page.evaluate(() => (window as unknown as TestWindow).__awards) as Promise<
    Array<{ kind: string; trackId: string; rivalId?: string; beatRival?: boolean }>
  >;
}

test.describe('Career, Records and rivals', () => {
  test('a championship race earns full XP on its own track, counts the rival and shows the best finish', async ({ page }) => {
    const errors = await openGame(page);
    await watchCareer(page);
    await startChampionshipRace(page);

    // A rival is picked from the standings and marked on the tower
    const rival = await game(page, (g) => g.rivalId as string | null);
    expect(rival).not.toBeNull();
    // The tower is told who the rival is (its row shows when they are near you)
    expect(await game(page, (g) => g.towerView.rivalId)).toBe(rival);

    await driveOffTheGrid(page);
    await takeChequeredFlag(page);
    const [award] = await awards(page);
    expect(award).toMatchObject({ kind: 'championship', trackId: 'track_01_coastal', rivalId: rival });
    expect(typeof award!.beatRival).toBe('boolean');
    // The head-to-head is scored
    const record = await game(page, (g, id) => g.career.headToHead(id), rival!);
    expect(record.won + record.lost).toBe(1);

    // Records shows the best finish on that track
    await page.locator('#btn-next-race').click();
    await expectScreen(page, 'hub');
    await page.locator('#hub-tab-records').click();
    await expect(page.locator('#records-tracks')).toContainText(/Coastal Highway Circuit[\s\S]*P\d+/);
    expectNoErrors(errors);
  });

  test('a Quick Race earns quick-race XP; a Time Trial has no rival and earns XP for beating your ghost', async ({ page }) => {
    const errors = await openGame(page);
    await watchCareer(page);
    await startQuickRace(page);
    await driveOffTheGrid(page);
    await takeChequeredFlag(page);
    expect((await awards(page))[0]).toMatchObject({ kind: 'quick' });
    await page.locator('#btn-next-race').click();
    await expectScreen(page, 'hub');

    // Time Trial: alone, no rival; a lap, then a faster one beats the ghost
    await page.locator('#hub-time-trial').click();
    await page.locator('#time-trial-start').click();
    await expectScreen(page, 'racing');
    expect(await game(page, (g) => g.rivalId)).toBeNull();
    await driveOffTheGrid(page, true);
    await advance(page, 2);
    await completeLap(page, 75.5);
    await advance(page, 2);
    await completeLap(page, 70.0);
    await page.keyboard.up('ArrowUp');
    expect(await game(page, (g) => g.career.stats.ghostBeats)).toBe(1);
    expectNoErrors(errors);
  });
});

test.describe('Championships and difficulty', () => {
  test('a locked difficulty races at Hard', async ({ page }) => {
    await seed(page, { apex_settings_v1: { difficulty: 'legend' } });
    await openGame(page);
    expect(await game(page, (g) => g.aiDriverManager.difficultyLimit)).toBeCloseTo(0.97, 5);
  });

  test('the saved championship and an unlocked difficulty are used from the start', async ({ page }) => {
    await seed(page, { ...VETERAN, apex_championship_v1: 'highway_cup', apex_settings_v1: { difficulty: 'legend' } });
    await openGame(page);
    await expect(page.locator('#hub-round')).toContainText('Round 1 of 3');
    expect(await game(page, (g) => g.seasonManager.championship.id)).toBe('highway_cup');
    expect(await game(page, (g) => g.aiDriverManager.difficultyLimit)).toBeCloseTo(1.04, 5);
  });
});

test.describe('Sessions', () => {
  test('qualifying keeps the tower with no rows, and names its run', async ({ page }) => {
    const errors = await openGame(page);
    await page.locator('#hub-start-weekend').click();
    await page.locator('#card-mode-flying').click();
    await page.locator('#btn-start-qualifying').click();
    await expectScreen(page, 'racing');
    await expect(page.locator('#qualify-result-indicator')).toContainText('Qualifying · one flying lap');
    await expect(page.locator('#timing-tower')).toBeVisible();
    await advance(page, 1);
    await expect(page.locator('#timing-tower-rows .tower-row:not([hidden])')).toHaveCount(0);

    // Back to the hub, then the sector sprint names itself too
    await page.keyboard.press('Escape');
    await page.locator('#pause-quit').click();
    await expectScreen(page, 'hub');
    await page.locator('#hub-start-weekend').click();
    await page.locator('#card-mode-sector').click();
    await page.locator('#btn-start-qualifying').click();
    await expect(page.locator('#qualify-result-indicator')).toContainText('Qualifying · sector 1 sprint');
    expectNoErrors(errors);
  });

  test('a Time Trial is alone and dry, keeps a white last-lap ghost, and never moves the season', async ({ page }) => {
    const errors = await openGame(page);
    // Stormy Pass is always wet in a race
    await game(page, (g) => g.startTimeTrial({ trackIndex: 6, tyre: 'street' }));
    await expectScreen(page, 'racing');
    expect(await game(page, (g) => ({ weather: g.raceWeather, ai: g.aiDriverManager.group.visible, solo: g.isSolo }))).toEqual({
      weather: 'dry',
      ai: false,
      solo: true
    });
    await driveOffTheGrid(page, true);
    await advance(page, 2);
    await completeLap(page, 80);
    await page.keyboard.up('ArrowUp');
    expect(await game(page, (g) => g.lastLapGhost.hasGhost)).toBe(true);
    expect(await game(page, (g) => g.isChampionshipRace)).toBe(false);

    await page.keyboard.press('Escape');
    await page.locator('#pause-quit').click();
    await expectScreen(page, 'hub');
    await expect(page.locator('#hub-round')).toContainText('Round 1 of 8');
    expectNoErrors(errors);
  });

  test('weather and tyres change only in practice', async ({ page }) => {
    const errors = await openGame(page);
    await startChampionshipRace(page);
    const before = await game(page, (g) => ({ weather: g.raceWeather, tyre: g.activeTire }));
    await game(page, (g) => {
      g.togglePracticeWeather();
      g.changePracticeTyres(g.activeTire === 'wet' ? 'street' : 'wet');
    });
    expect(await game(page, (g) => ({ weather: g.raceWeather, tyre: g.activeTire }))).toEqual(before);

    // The track button loads practice: there the weather can change
    await game(page, (g) => g.cycleTrack());
    expect(await game(page, (g) => g.isPractice)).toBe(true);
    const practiceWeather = await game(page, (g) => g.raceWeather);
    await game(page, (g) => g.togglePracticeWeather());
    expect(await game(page, (g) => g.raceWeather)).not.toBe(practiceWeather);
    expectNoErrors(errors);
  });
});

test.describe('Driver and accessibility', () => {
  test('your livery and name reach the car, the tower and the results', async ({ page }) => {
    await seed(page, VETERAN);
    const errors = await openGame(page);
    await page.locator('#hub-tab-garage').click();
    await page.locator('#garage-name').fill('Tester Jones');
    await page.locator('#garage-liveries .garage-livery', { hasText: 'Stealth' }).click();
    await page.keyboard.press('Escape');

    await startQuickRace(page);
    expect(await game(page, (g) => g.playerCar.body)).toBe(0x1c1d24);
    await advance(page, 1);
    await expect(page.locator('#timing-tower-rows')).toContainText('JONES');
    await driveOffTheGrid(page);
    await takeChequeredFlag(page);
    await expect(page.locator('#results-table-body')).toContainText('Tester Jones');
    expectNoErrors(errors);
  });

  for (const reduce of [true, false]) {
    test(`reduce motion ${reduce ? 'on' : 'off'}: the zoom pulse and car lean follow it`, async ({ page }) => {
      await seed(page, { apex_settings_v1: { reduceMotion: reduce ? 'on' : 'off' } });
      await openGame(page);
      expect(await page.evaluate(() => document.documentElement.classList.contains('reduce-motion'))).toBe(reduce);
      await startQuickRace(page);
      expect(await game(page, (g) => g.playerCar.leans)).toBe(!reduce);
      // A slipstream boost widens the view, unless motion is reduced: the same frame drawn
      // without and then with a boost
      const fovWith = (boost: boolean): Promise<number> =>
        game(
          page,
          (g, b) => {
            g.latestSlipstream.isBoostActive = b;
            // One second of frames at 60 fps
            for (let i = 0; i < 60; i++) {
              g.drawFrame(g.inputManager.getInputState(), g.trackSpline.evaluateSurface(g.vehiclePhysics.state.position), 1 / 60);
            }
            return g.camera.fov;
          },
          boost
        );
      const plain = await fovWith(false);
      const boosted = await fovWith(true);
      // The camera's own update pulls the view back towards its resting width every frame, so
      // the pulse settles about 1.8 degrees wider, not the 6 aimed for (R10-06)
      if (reduce) expect(boosted).toBeCloseTo(plain, 3);
      else expect(boosted).toBeGreaterThan(plain + 1);
    });
  }
});

test.describe('Engine', () => {
  test('a tab switch pauses and silences the race, and a tap brings the sound back', async ({ page }) => {
    const errors = await openGame(page);
    await page.mouse.click(5, 5); // a gesture, so sound may start
    await startQuickRace(page);
    await driveOffTheGrid(page);
    const raceTime = await game(page, (g) => g.totalRaceElapsedSeconds as number);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expectScreen(page, 'paused');
    await expect.poll(() => game(page, (g) => g.audioEngine.ctx?.state)).toBe('suspended');
    // No catch-up physics for the time away
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await game(page, (g) => g.totalRaceElapsedSeconds as number)).toBeCloseTo(raceTime, 0);
    await page.mouse.click(5, 5);
    await expect.poll(() => game(page, (g) => g.audioEngine.ctx?.state)).toBe('running');
    expectNoErrors(errors);
  });

  test('the route map takes its real size when the race opens', async ({ page }) => {
    await openGame(page);
    await startQuickRace(page);
    const size = await game(page, (g) => ({ kept: g.miniMap.displayedWidth, real: (document.getElementById('mini-map') as HTMLElement).clientWidth }));
    expect(size.kept).toBe(size.real);
    expect(size.real).toBeGreaterThan(0);
  });

  test('loading tracks one after another keeps graphics memory flat', async ({ page }) => {
    await openGame(page);
    // Let the car model finish loading first: it adds its own geometry once
    await expect.poll(() => game(page, (g) => g.renderer.info.memory.geometries), { timeout: 30_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2000);
    await game(page, (g) => g.loadTrack(0));
    await advance(page, 0.2);
    const counts: number[] = [];
    for (const index of [1, 2, 3, 4, 5, 6, 0, 1, 2]) {
      await game(page, (g, i) => g.loadTrack(i), index);
      await advance(page, 0.2);
      counts.push(await game(page, (g) => g.renderer.info.memory.geometries as number));
    }
    // The old track is freed each time: the count stays within a few of where it started
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(4);
  });
});
