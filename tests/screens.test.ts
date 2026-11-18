import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ScreenFlow, Screen, quitToHubCost, restartLabel } from '../src/app/ScreenFlow';
import { hubStandingsRows, playerSeasonSummary, teamColourFor } from '../src/ui/HubScreen';
import { DriverStanding } from '../src/engine/ChampionshipEngine';
import { AI_DRIVER_ROSTER } from '../src/ai/AIDriverProfiles';

function standing(driverId: string, driverName: string, points: number, isPlayer = false): DriverStanding {
  return {
    driverId,
    driverName,
    team: 'Team',
    isPlayer,
    points,
    wins: 0,
    podiums: 0,
    bestFinish: 20,
    history: []
  };
}

/** Player plus all 19 AI drivers, with the given points (player first) */
function season(playerPoints: number, aiPoints: (i: number) => number): DriverStanding[] {
  return [
    standing('player', 'Player (You)', playerPoints, true),
    ...AI_DRIVER_ROSTER.map((d, i) => standing(d.id, d.name, aiPoints(i)))
  ];
}

describe('Screen flow (R3 part 3)', () => {
  it('opens on the hub with the race not running', () => {
    const flow = new ScreenFlow('hub');
    expect(flow.current).toBe('hub');
    expect(flow.isSimulating).toBe(false);
  });

  it('runs the race only on the racing screen', () => {
    const flow = new ScreenFlow('hub');
    flow.go('racing');
    expect(flow.isSimulating).toBe(true);
    flow.go('paused');
    expect(flow.isSimulating).toBe(false);
  });

  it('allows only the moves the design names, and reports each change', () => {
    const seen: Array<[Screen, Screen]> = [];
    const flow = new ScreenFlow('hub', (to, from) => seen.push([to, from]));

    expect(flow.go('paused')).toBe(false); // nothing to pause on the hub
    expect(flow.current).toBe('hub');
    expect(flow.go('racing')).toBe(true);
    expect(flow.go('paused')).toBe(true);
    expect(flow.go('hub')).toBe(true); // quit from the pause menu
    expect(flow.go('hub')).toBe(false); // already there

    expect(seen).toEqual([
      ['racing', 'hub'],
      ['paused', 'racing'],
      ['hub', 'paused']
    ]);
  });

  it('toggles pause during a race and does nothing on the hub', () => {
    const flow = new ScreenFlow('hub');
    expect(flow.togglePause()).toBe(false);
    flow.go('racing');
    flow.togglePause();
    expect(flow.current).toBe('paused');
    flow.togglePause();
    expect(flow.current).toBe('racing');
  });

  it('charges a restart token to quit a championship race, and blocks it with none left', () => {
    expect(quitToHubCost(false, 0)).toBe('free'); // practice or qualifying
    expect(quitToHubCost(true, 2)).toBe('token');
    expect(quitToHubCost(true, 0)).toBe('blocked');
  });
});

describe('Hub live standings (R4 approval change)', () => {
  it('shows the top 5 in points order with surnames, and marks the player', () => {
    // Player on 38 points, second; AI driver i has 40 - 3i points
    const rows = hubStandingsRows(season(38, (i) => 40 - i * 3));

    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
    expect(rows[1]).toMatchObject({ name: 'YOU', points: 38, isPlayer: true, teamColour: 0 });
    const leader = AI_DRIVER_ROSTER[0]!;
    expect(rows[0]?.name).toBe(leader.name.split(' ').pop()!.toUpperCase());
    expect(rows[0]?.points).toBe(40);
  });

  it('puts the player in the last row when they are outside the top 5', () => {
    const rows = hubStandingsRows(season(1, (i) => 100 - i));

    expect(rows).toHaveLength(5);
    expect(rows.slice(0, 4).map((r) => r.position)).toEqual([1, 2, 3, 4]);
    expect(rows[4]).toMatchObject({ name: 'YOU', position: 20, isPlayer: true });
  });

  it('gives each AI driver a team colour from 1 to 10 by roster order', () => {
    expect(teamColourFor(AI_DRIVER_ROSTER[0]!.id)).toBe(1);
    expect(teamColourFor(AI_DRIVER_ROSTER[9]!.id)).toBe(10);
    expect(teamColourFor(AI_DRIVER_ROSTER[10]!.id)).toBe(1);
    expect(teamColourFor('player')).toBe(0);
  });

  it('summarises the player as leader or by the points gap to P1', () => {
    expect(playerSeasonSummary(season(50, () => 10))).toEqual({ position: 1, points: 50, gapLabel: 'Leader' });
    expect(playerSeasonSummary(season(38, (i) => (i === 0 ? 43 : 0)))).toEqual({
      position: 2,
      points: 38,
      gapLabel: '5 pts'
    });
  });
});

describe('Pause menu replaces the top-right button stack (U-12)', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

  it('has no button stack in the race HUD, only the pause button', () => {
    expect(html).not.toMatch(/class="top-buttons"/);
    expect(html).toMatch(/id="btn-pause"/);
  });

  it('keeps every control from the old stack inside the pause menu', () => {
    const start = html.indexOf('id="pause-menu"');
    const end = html.indexOf('<!-- Pre-Race Qualifying Selection Modal -->');
    const menu = html.slice(start, end);
    for (const id of [
      'btn-restart-race',
      'btn-standings-toggle',
      'btn-qualify-toggle',
      'btn-track-toggle',
      'btn-camera-toggle',
      'btn-ghost-toggle',
      'btn-audio-toggle',
      'btn-fullscreen',
      'pause-resume',
      'pause-quit'
    ]) {
      expect(menu, id).toContain(`id="${id}"`);
    }
  });
});

describe('Restart label (P09-R09)', () => {
  it('shows no token count where restarts are free, and the count where they cost one', () => {
    expect(restartLabel(true, 3)).toBe('Restart');
    expect(restartLabel(true, 0)).toBe('Restart');
    expect(restartLabel(false, 2)).toBe('Restart · 2 left');
    expect(restartLabel(false, 0)).toBe('Restart · none left');
  });
});
