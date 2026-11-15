import { describe, it, expect } from 'vitest';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { TimingTower } from '../src/engine/TimingTower';
import { RaceProgress } from '../src/engine/RaceOrder';
import { formatGap } from '../src/ui/TimingTowerView';
import { gearLabel } from '../src/ui/HUDController';

const LAP = 1000; // metres

/** Puts AI car i at `metres[i]` into the race (lap 1 = 0 to 1000 m) */
function placeCars(manager: AIDriverManager, metres: (i: number) => number): void {
  manager.cars.forEach((car, i) => {
    const m = metres(i);
    car.lap = Math.floor(m / LAP) + 1;
    car.splineT = (m % LAP) / LAP;
    car.finishTime = null;
  });
}

function player(metres: number): RaceProgress {
  return { completedLaps: Math.floor(metres / LAP), lapFraction: (metres % LAP) / LAP, finishTime: null };
}

describe('Timing tower (R5 Broadcast HUD)', () => {
  it('shows two cars ahead and two behind, with gaps in seconds at your pace', () => {
    const manager = new AIDriverManager();
    // AI car i is at 1900 - 100 i metres; the player is at 1450 m, between cars 4 and 5
    placeCars(manager, (i) => 1900 - 100 * i);
    const tower = new TimingTower();
    tower.update(player(1450), 180, manager.cars, LAP); // 180 km/h = 50 m/s

    expect(tower.rowCount).toBe(5);
    expect(tower.rows.map((r) => r.position)).toEqual([4, 5, 6, 7, 8]);
    expect(tower.rows.map((r) => r.driverId)).toEqual([
      manager.cars[3]!.profile.id,
      manager.cars[4]!.profile.id,
      'player',
      manager.cars[5]!.profile.id,
      manager.cars[6]!.profile.id
    ]);
    // Car 4 is 50 m ahead: 1 s at 50 m/s. Car 5 is 50 m behind: -1 s
    expect(tower.rows[1]!.gapSeconds).toBeCloseTo(1, 5);
    expect(tower.rows[2]!.gapSeconds).toBe(0);
    expect(tower.rows[3]!.gapSeconds).toBeCloseTo(-1, 5);
    expect(tower.rows[0]!.gapSeconds).toBeCloseTo(3, 5);
  });

  it('keeps five rows at the front and the back of the field', () => {
    const manager = new AIDriverManager();
    placeCars(manager, (i) => 1000 - 10 * i);
    const tower = new TimingTower();

    tower.update(player(5000), 100, manager.cars, LAP); // leading
    expect(tower.rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
    expect(tower.rows[0]!.isPlayer).toBe(true);

    tower.update(player(0), 100, manager.cars, LAP); // last
    expect(tower.rows.map((r) => r.position)).toEqual([16, 17, 18, 19, 20]);
    expect(tower.rows[4]!.isPlayer).toBe(true);
  });

  it('ranks finished cars first by finish time, without a distance gap', () => {
    const manager = new AIDriverManager();
    placeCars(manager, (i) => 2000 - 10 * i);
    manager.cars[2]!.finishTime = 90;
    manager.cars[7]!.finishTime = 85; // finished first
    const tower = new TimingTower();
    tower.update(player(5000), 100, manager.cars, LAP); // player far ahead but still racing

    expect(tower.rows[0]!.driverId).toBe(manager.cars[7]!.profile.id);
    expect(tower.rows[1]!.driverId).toBe(manager.cars[2]!.profile.id);
    expect(tower.rows[2]!.isPlayer).toBe(true);
    expect(tower.rows[0]!.gapSeconds).toBe(0);
  });

  it('uses a minimum pace so a stopped car does not show huge gaps', () => {
    const manager = new AIDriverManager();
    placeCars(manager, (i) => 1500 - 100 * i);
    const tower = new TimingTower();
    tower.update(player(1050), 0, manager.cars, LAP); // stopped; car 4 is 50 m ahead
    const ahead = tower.rows.find((r) => r.driverId === manager.cars[4]!.profile.id)!;
    expect(ahead.gapSeconds).toBeCloseTo(50 / 15, 5);
  });
});

describe('HUD text (R5 Broadcast HUD)', () => {
  it('formats tower gaps with a sign and three decimals', () => {
    expect(formatGap(1.2041, false)).toBe('+1.204');
    expect(formatGap(-0.5521, false)).toBe('−0.552');
    expect(formatGap(0, true)).toBe('—');
  });

  it('shows the gear from the same 45 km/h bands as the engine sound', () => {
    expect(gearLabel(0, 0)).toBe('N');
    expect(gearLabel(-2, 7)).toBe('R');
    expect(gearLabel(10, 30)).toBe('1');
    expect(gearLabel(20, 60)).toBe('2');
    expect(gearLabel(40, 150)).toBe('4');
    expect(gearLabel(50, 180)).toBe('4');
  });
});
