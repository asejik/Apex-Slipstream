import type { AICarState } from '../ai/AIDriverManager';
import type { RaceProgress } from './RaceOrder';

/** One row of the race HUD's timing tower (docs/DESIGN.md section 4). */
interface TowerRow {
  position: number;
  /** AI driver id, or 'player' */
  driverId: string;
  isPlayer: boolean;
  /**
   * Seconds between this car and the player at the player's current pace: positive when the
   * car is ahead of you, negative when behind, 0 for your own row.
   */
  gapSeconds: number;
}

/** Index used for the player in the internal arrays (the 19 AI cars come first). */
const PLAYER = 19;
const CAR_COUNT = 20;
/** Below this the gap would blow up at a standstill, in m/s */
const MIN_PACE_MS = 15;
/** Finished cars rank ahead of everyone still racing, in finishing order */
const FINISHED_BASE = 1e9;

/**
 * Works out the timing tower: the cars just ahead of and behind the player, with time gaps.
 * Everything is preallocated; update() allocates nothing.
 */
export class TimingTower {
  public static readonly ROWS = 5;
  public readonly rows: TowerRow[] = [];
  public rowCount = 0;

  private readonly keys = new Float64Array(CAR_COUNT);
  private readonly order = new Int32Array(CAR_COUNT);

  constructor() {
    for (let i = 0; i < TimingTower.ROWS; i++) {
      this.rows.push({ position: 0, driverId: '', isPlayer: false, gapSeconds: 0 });
    }
  }

  /** How far a car has gone in the race, in metres; finishers rank by finish time. */
  private static raceKey(completedLaps: number, lapFraction: number, finishTime: number | null, lapLength: number): number {
    if (finishTime !== null) return FINISHED_BASE - finishTime;
    return (completedLaps + lapFraction) * lapLength;
  }

  /**
   * `player` is the player's race progress, `playerSpeedKmh` their speed, `lapLength` the
   * track length in metres. Fills `rows` (up to ROWS) centred on the player where possible.
   */
  public update(player: RaceProgress, playerSpeedKmh: number, aiCars: readonly AICarState[], lapLength: number): void {
    const count = Math.min(aiCars.length, PLAYER);
    for (let i = 0; i < count; i++) {
      const car = aiCars[i]!;
      this.keys[i] = TimingTower.raceKey(car.lap - 1, car.splineT, car.finishTime, lapLength);
    }
    this.keys[PLAYER] = TimingTower.raceKey(player.completedLaps, player.lapFraction, player.finishTime, lapLength);

    // Insertion sort of car indices, furthest ahead first (20 items, no allocation)
    let n = 0;
    for (let i = 0; i < CAR_COUNT; i++) {
      if (i < PLAYER && i >= count) continue;
      const key = this.keys[i]!;
      let j = n - 1;
      // Ties keep the player behind, as RaceOrder does for an exact tie
      while (j >= 0 && this.keys[this.order[j]!]! < key) {
        this.order[j + 1] = this.order[j]!;
        j--;
      }
      this.order[j + 1] = i;
      n++;
    }

    let playerIndex = 0;
    for (let i = 0; i < n; i++) {
      if (this.order[i] === PLAYER) {
        playerIndex = i;
        break;
      }
    }

    const half = Math.floor(TimingTower.ROWS / 2);
    const start = Math.max(0, Math.min(playerIndex - half, n - TimingTower.ROWS));
    const pace = Math.max(MIN_PACE_MS, playerSpeedKmh / 3.6);
    const playerKey = this.keys[PLAYER]!;

    this.rowCount = Math.min(TimingTower.ROWS, n);
    for (let r = 0; r < this.rowCount; r++) {
      const carIndex = this.order[start + r]!;
      const row = this.rows[r]!;
      row.position = start + r + 1;
      row.isPlayer = carIndex === PLAYER;
      row.driverId = row.isPlayer ? 'player' : aiCars[carIndex]!.profile.id;
      const key = this.keys[carIndex]!;
      // Distance gaps only make sense between cars still racing
      row.gapSeconds =
        row.isPlayer || key >= FINISHED_BASE / 2 || playerKey >= FINISHED_BASE / 2
          ? 0
          : (key - playerKey) / pace;
    }
  }
}
