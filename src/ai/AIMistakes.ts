/**
 * Driver mistakes (R6 part 3). On the way into a corner a driver may get it wrong:
 *  - lock-up: brakes too late, scrubs off speed and slides wide of the line
 *  - wide: misses the apex and runs out towards the edge, losing time on the exit
 *  - spin: loses the car completely (rare; the same spin as after a hit)
 * The chance is higher for lower-skilled and bolder drivers, under pressure (passing or
 * defending) and on easier difficulty. The dice are seeded, so a race can be replayed
 * exactly in tests, and each race gets a new seed so mistakes differ from race to race.
 */

export const MistakeKind = { None: 0, LockUp: 1, Wide: 2, Spin: 3 } as const;
export type MistakeKind = (typeof MistakeKind)[keyof typeof MistakeKind];

/** What a mistake does to a driver this step. Reused: no allocation per step. */
export interface MistakeEffect {
  /** Multiplies the driver's planned speed (1 when driving cleanly) */
  speedScale: number;
  /** Metres added to the racing line, towards the outside of the corner */
  lineShift: number;
  /** True on the one step a spin starts */
  startSpin: boolean;
}

const SLOTS = 20;
/** A corner starts where the driver's plan drops below this share of their top speed */
const CORNER_ENTRY_SHARE = 0.93;
/** Chance per corner of a mistake at Medium for a skill-1.0 driver of middling aggression */
const BASE_CHANCE = 0.015;
/** Difficulty limit the base chance is for (Medium); Easy has more mistakes, Hard fewer */
const MEDIUM_LIMIT = 0.89;

const LOCK_UP_SECONDS = 1.6;
const LOCK_UP_SPEED_SCALE = 0.65;
const LOCK_UP_WIDE_M = 1.5;
const WIDE_SECONDS = 2.5;
const WIDE_SPEED_SCALE = 0.8;
const WIDE_M = 3.0;

/**
 * Chance (0 to 1) that a driver makes a mistake at one corner.
 * `limit` is the difficulty's share of the car's limit (DIFFICULTY_LIMIT).
 */
export function mistakeChance(limit: number, skill: number, aggression: number, underPressure: boolean): number {
  const difficulty = Math.min(2, Math.max(0.25, (1 - limit) / (1 - MEDIUM_LIMIT)));
  const skillFactor = Math.max(0.5, 1 + (1 - skill) * 8);
  const boldness = 0.8 + aggression * 0.4;
  const pressure = underPressure ? 1.5 : 1;
  return BASE_CHANCE * difficulty * skillFactor * boldness * pressure;
}

/** Share of mistakes that are spins: bolder drivers overstep further */
export function spinShare(aggression: number): number {
  return 0.06 + aggression * 0.06;
}

export class AIMistakes {
  private state = 1;
  private readonly kind = new Uint8Array(SLOTS);
  private readonly timer = new Float32Array(SLOTS);
  private readonly outside = new Int8Array(SLOTS);
  private readonly inCorner = new Uint8Array(SLOTS);
  /** Mistakes made this race by kind (index MistakeKind), for tuning and tests */
  public readonly counts = new Uint16Array(4);

  /** New race: clears every driver's state and reseeds the dice. */
  public reset(seed: number): void {
    this.state = seed >>> 0 || 1;
    this.kind.fill(MistakeKind.None);
    this.timer.fill(0);
    this.outside.fill(1);
    this.inCorner.fill(0);
    this.counts.fill(0);
  }

  /** The mistake driver `i` is making now, if any */
  public kindOf(i: number): MistakeKind {
    return this.kind[i] as MistakeKind;
  }

  /**
   * One step for driver `i`: rolls the dice on the way into a corner, and fills `out` with
   * what any mistake under way does this step.
   */
  public update(
    i: number,
    planMs: number,
    topSpeed: number,
    line: number,
    limit: number,
    skill: number,
    aggression: number,
    underPressure: boolean,
    dt: number,
    out: MistakeEffect
  ): void {
    out.speedScale = 1;
    out.lineShift = 0;
    out.startSpin = false;

    // Entering a corner: the line sits on the outside before the bend
    const cornering = planMs < topSpeed * CORNER_ENTRY_SHARE ? 1 : 0;
    if (cornering === 1 && this.inCorner[i] === 0 && this.kind[i] === MistakeKind.None) {
      if (this.next() < mistakeChance(limit, skill, aggression, underPressure)) {
        this.outside[i] = line < 0 ? -1 : 1;
        if (this.next() < spinShare(aggression)) {
          this.counts[MistakeKind.Spin] = this.counts[MistakeKind.Spin]! + 1;
          out.startSpin = true;
        } else if (this.next() < 0.4) {
          this.begin(i, MistakeKind.LockUp, LOCK_UP_SECONDS);
        } else {
          this.begin(i, MistakeKind.Wide, WIDE_SECONDS);
        }
      }
    }
    this.inCorner[i] = cornering;

    const kind = this.kind[i];
    if (kind === MistakeKind.None) return;
    const duration = kind === MistakeKind.LockUp ? LOCK_UP_SECONDS : WIDE_SECONDS;
    // Worst at the start, then the driver gathers it up
    const severity = Math.max(0, this.timer[i]! / duration);
    if (kind === MistakeKind.LockUp) {
      out.speedScale = 1 - (1 - LOCK_UP_SPEED_SCALE) * severity;
      out.lineShift = this.outside[i]! * LOCK_UP_WIDE_M * severity;
    } else {
      out.speedScale = 1 - (1 - WIDE_SPEED_SCALE) * severity;
      out.lineShift = this.outside[i]! * WIDE_M * Math.min(1, severity * 2);
    }
    this.timer[i] = this.timer[i]! - dt;
    if (this.timer[i]! <= 0) {
      this.kind[i] = MistakeKind.None;
      this.timer[i] = 0;
    }
  }

  private begin(i: number, kind: MistakeKind, seconds: number): void {
    this.kind[i] = kind;
    this.timer[i] = seconds;
    this.counts[kind] = this.counts[kind]! + 1;
  }

  /** Seeded uniform number in [0, 1) (mulberry32) */
  private next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
