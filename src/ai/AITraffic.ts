/**
 * Racecraft in traffic (R6 part 2): following without running into the car ahead,
 * passing, slipstreaming and defending. Works on a snapshot of every car's position
 * along the lap, so the decisions for one step all see the same picture.
 *
 * Slots 0 to 18 are AI cars (AIDriverManager order); slot 19 is the player.
 * Nothing here allocates after construction.
 */

/** 19 AI cars and the player */
const TRAFFIC_SLOTS = 20;
export const PLAYER_SLOT = 19;

/** Cars closer than this side by side share a lane (car width 1.9 m plus a gap) */
const LANE_M = 2.4;
/** Cars closer than this along the road are level (car length 4.6 m plus a gap) */
const ALONGSIDE_M = 6;
/** How far ahead a driver looks for a car in its lane */
const LOOK_AHEAD_M = 45;
/** Gap a following car keeps to the one ahead (car length 4.6 m plus a gap) */
const SAFE_GAP_M = 7;
/** A passing car aims this far to the side of the car it is passing */
const PASS_SIDE_M = 3.2;
/** A pass is finished once this far ahead of the passed car */
const PASS_DONE_M = 6;
/** A driver starts a pass on a car within this distance ahead */
const PASS_START_M = 30;
/** Defending: attackers closer than this behind are seen */
const DEFEND_LOOK_M = 25;
/** Defending: no move once the attacker is closer than this (no chopping across a car) */
const DEFEND_CLOSEST_M = 6;
/** Defending: how long a covering move is held */
const DEFEND_HOLD_S = 2.5;
/** Same rules as the player's slipstream (SlipstreamManager) */
const DRAFT_MIN_M = 1.5;
const DRAFT_MAX_M = 20;
const DRAFT_LANE_M = 1.5;
const DRAFT_TIME_S = 1.5;
const DRAFT_BOOST_S = 3;
const DRAFT_BOOST = 1.1;
const DRAFT_MIN_SPEED_MS = 60 / 3.6;
/** A plan this close to top speed is a straight */
const STRAIGHT_SHARE = 0.97;

/** What one AI driver does this step. */
export interface TrafficDecision {
  /** Highest speed (m/s) the car ahead allows; Infinity on a clear road */
  speedCap: number;
  /** Where to steer, metres from the centreline (positive to the right) */
  lateralTarget: number;
  /** How quickly to move across, per second */
  lateralRate: number;
  /** Slipstream boost to top speed: 1 or DRAFT_BOOST */
  boost: number;
  /** True while committed to passing a car */
  isPassing: boolean;
  /** True while covering an attacker */
  isDefending: boolean;
}

export class AITraffic {
  /** Metres along the lap, 0 to the lap length */
  public readonly along = new Float64Array(TRAFFIC_SLOTS);
  /** Metres from the centreline, positive to the right */
  public readonly offset = new Float32Array(TRAFFIC_SLOTS);
  /** m/s */
  public readonly speed = new Float32Array(TRAFFIC_SLOTS);
  /** 1 if the slot is a car on the road */
  public readonly active = new Uint8Array(TRAFFIC_SLOTS);

  private readonly passTarget = new Int8Array(TRAFFIC_SLOTS).fill(-1);
  private readonly passSide = new Int8Array(TRAFFIC_SLOTS);
  private readonly draftTime = new Float32Array(TRAFFIC_SLOTS);
  private readonly boostTime = new Float32Array(TRAFFIC_SLOTS);
  private readonly defendTime = new Float32Array(TRAFFIC_SLOTS);
  private readonly defendOffset = new Float32Array(TRAFFIC_SLOTS);
  /** The attacker a driver has already made its one move against; -1 for none */
  private readonly defendedAgainst = new Int8Array(TRAFFIC_SLOTS).fill(-1);

  private length = 1;
  private isClosed = true;
  private halfWidth = 5.5;

  /** Clears every driver's state for a new race on a road of this length and usable half-width. */
  public reset(length: number, isClosed: boolean, halfWidth: number): void {
    this.length = Math.max(1, length);
    this.isClosed = isClosed;
    this.halfWidth = halfWidth;
    this.passTarget.fill(-1);
    this.passSide.fill(0);
    this.draftTime.fill(0);
    this.boostTime.fill(0);
    this.defendTime.fill(0);
    this.defendedAgainst.fill(-1);
    this.active.fill(0);
  }

  /** Metres from car `i` forward to car `j` (negative when `j` is behind). */
  public gap(i: number, j: number): number {
    let g = this.along[j]! - this.along[i]!;
    if (this.isClosed) {
      const half = this.length / 2;
      if (g > half) g -= this.length;
      else if (g < -half) g += this.length;
    }
    return g;
  }

  /**
   * Decides what AI driver `i` does this step.
   * `line` is its racing line here, `planSpeed` its planned speed here and `topSpeed` its top
   * speed (all from AIRacecraft); `aggression` is from its profile (0 to 1).
   */
  public decide(
    i: number,
    line: number,
    planSpeed: number,
    topSpeed: number,
    aggression: number,
    dt: number,
    out: TrafficDecision
  ): void {
    const myOffset = this.offset[i]!;
    const mySpeed = this.speed[i]!;
    const onStraight = planSpeed >= topSpeed * STRAIGHT_SHARE;

    // Who is around: the nearest car in my lane ahead, the nearest car ahead at all (to
    // draft), the nearest faster car behind (an attacker), and any car overlapping mine
    let ahead = -1;
    let aheadGap = Infinity;
    let draftCar = -1;
    let draftGap = Infinity;
    let attacker = -1;
    let attackerGap = -Infinity;
    let overlap = -1;
    for (let j = 0; j < TRAFFIC_SLOTS; j++) {
      if (j === i || this.active[j] === 0) continue;
      const g = this.gap(i, j);
      const side = Math.abs(this.offset[j]! - myOffset);
      if (g > 0 && g < LOOK_AHEAD_M) {
        if (side < LANE_M && g < aheadGap) {
          ahead = j;
          aheadGap = g;
        }
        if (side < 6 && g < draftGap) {
          draftCar = j;
          draftGap = g;
        }
      } else if (g <= 0 && g > -DEFEND_LOOK_M && side < 4 && this.speed[j]! > mySpeed + 0.5 && g > attackerGap) {
        attacker = j;
        attackerGap = g;
      }
      if (Math.abs(g) < 5 && side < LANE_M - 0.2) overlap = j;
    }

    // Slipstream, by the player's rules: 1.5 s in a car's wake gives 3 s of +10% top speed
    if (ahead >= 0 && aheadGap >= DRAFT_MIN_M && aheadGap <= DRAFT_MAX_M &&
        Math.abs(this.offset[ahead]! - myOffset) < DRAFT_LANE_M && mySpeed >= DRAFT_MIN_SPEED_MS) {
      this.draftTime[i] = this.draftTime[i]! + dt;
      if (this.draftTime[i]! >= DRAFT_TIME_S) {
        this.boostTime[i] = DRAFT_BOOST_S;
        this.draftTime[i] = 0;
      }
    } else {
      this.draftTime[i] = 0;
    }
    if (this.boostTime[i]! > 0) this.boostTime[i] = Math.max(0, this.boostTime[i]! - dt);
    out.boost = this.boostTime[i]! > 0 ? DRAFT_BOOST : 1;

    // Following: never drive into the car ahead in my lane
    out.speedCap = Infinity;
    if (ahead >= 0) {
      const room = aheadGap - SAFE_GAP_M;
      out.speedCap = Math.max(0, this.speed[ahead]! + (room >= 0 ? room * 1.2 : room * 0.8));
    }

    // Passing: keep a committed pass going until clear of the car, or give up if it gets away
    let target = this.passTarget[i]!;
    if (target >= 0) {
      const g = this.gap(i, target);
      const lateral = this.clampOffset(this.offset[target]! + this.passSide[i]! * PASS_SIDE_M);
      if (this.active[target] === 0 || g < -PASS_DONE_M || g > LOOK_AHEAD_M || !this.isSideClear(i, target, lateral)) {
        this.passTarget[i] = -1;
        target = -1;
      }
    }
    // Start a pass on a slower car ahead; cautious drivers wait for a straight
    const wantsMore = ahead >= 0 && planSpeed > this.speed[ahead]! + 1.5 * (1 - aggression);
    if (target < 0 && ahead >= 0 && aheadGap < PASS_START_M && wantsMore && (onStraight || aggression >= 0.5)) {
      const roomRight = this.halfWidth - this.offset[ahead]!;
      const roomLeft = this.offset[ahead]! + this.halfWidth;
      const first = roomRight >= roomLeft ? 1 : -1;
      for (let k = 0; k < 2 && target < 0; k++) {
        const side = k === 0 ? first : -first;
        const lateral = this.clampOffset(this.offset[ahead]! + side * PASS_SIDE_M);
        if (Math.abs(lateral - this.offset[ahead]!) < LANE_M + 0.2) continue; // no room this side
        if (!this.isSideClear(i, ahead, lateral)) continue;
        this.passTarget[i] = ahead;
        this.passSide[i] = side;
        target = ahead;
      }
    }
    out.isPassing = target >= 0;

    // Defending: one move to cover a faster car closing on a straight, never once it is
    // alongside. A new attack (the attacker dropped back) allows a new move.
    if (this.defendedAgainst[i]! >= 0) {
      const g = this.gap(i, this.defendedAgainst[i]!);
      if (this.active[this.defendedAgainst[i]!] === 0 || g < -DEFEND_LOOK_M - 15 || g > 0) {
        this.defendedAgainst[i] = -1;
        this.defendTime[i] = 0;
      }
    }
    if (!out.isPassing && attacker >= 0 && attackerGap < -DEFEND_CLOSEST_M && onStraight &&
        aggression >= 0.4 && this.defendedAgainst[i] !== attacker) {
      this.defendedAgainst[i] = attacker;
      this.defendTime[i] = DEFEND_HOLD_S;
      this.defendOffset[i] = this.clampOffset(this.offset[attacker]!);
    }
    if (this.defendTime[i]! > 0) {
      this.defendTime[i] = Math.max(0, this.defendTime[i]! - dt);
      const by = this.defendedAgainst[i]!;
      if (out.isPassing || by < 0 || this.gap(i, by) > -DEFEND_CLOSEST_M + 1) this.defendTime[i] = 0;
    }
    out.isDefending = this.defendTime[i]! > 0;

    // Where to steer
    let lateral = line;
    let rate = 2.5;
    if (out.isPassing) {
      lateral = this.offset[target]! + this.passSide[i]! * PASS_SIDE_M;
      rate = 3.5;
    } else if (out.isDefending) {
      lateral = this.defendOffset[i]!;
      rate = 3;
    } else if (draftCar >= 0 && onStraight && aggression >= 0.5 && draftGap > SAFE_GAP_M + 2 && draftGap < LOOK_AHEAD_M) {
      // Tuck into the wake of the car ahead to set up a slipstream pass
      lateral = this.offset[draftCar]!;
    }
    // Never squeeze a car alongside: keep a lane's width from any car level with this one
    let lowest = -this.halfWidth;
    let highest = this.halfWidth;
    for (let j = 0; j < TRAFFIC_SLOTS; j++) {
      if (j === i || this.active[j] === 0 || Math.abs(this.gap(i, j)) >= ALONGSIDE_M) continue;
      if (this.offset[j]! >= myOffset) highest = Math.min(highest, this.offset[j]! - LANE_M);
      else lowest = Math.max(lowest, this.offset[j]! + LANE_M);
    }
    lateral = lowest <= highest ? Math.max(lowest, Math.min(highest, lateral)) : myOffset;
    // Last resort: two cars overlapping side by side move apart
    if (overlap >= 0) {
      const away = myOffset >= this.offset[overlap]! ? 1 : -1;
      lateral = this.offset[overlap]! + away * (LANE_M + 0.4);
      rate = 4;
    }
    out.lateralTarget = this.clampOffset(lateral);
    out.lateralRate = rate;
  }

  /** True if no other car (besides `passing`) is near `lateral` alongside or just ahead. */
  private isSideClear(i: number, passing: number, lateral: number): boolean {
    const reach = this.gap(i, passing) + 8;
    for (let k = 0; k < TRAFFIC_SLOTS; k++) {
      if (k === i || k === passing || this.active[k] === 0) continue;
      const g = this.gap(i, k);
      if (g > -7 && g < reach && Math.abs(this.offset[k]! - lateral) < LANE_M) return false;
    }
    return true;
  }

  private clampOffset(offset: number): number {
    return Math.max(-this.halfWidth, Math.min(this.halfWidth, offset));
  }
}
