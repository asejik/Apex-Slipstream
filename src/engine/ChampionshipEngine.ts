export const POINTS_TABLE: Record<number, number> = {
  1: 25,
  2: 20,
  3: 16,
  4: 13,
  5: 11,
  6: 10,
  7: 9,
  8: 8,
  9: 7,
  10: 6,
  11: 5,
  12: 4,
  13: 3,
  14: 2,
  15: 1
};

export const FASTEST_LAP_BONUS = 1;
export const CLEAN_DRIVER_BONUS = 2;

export interface RawRaceParticipant {
  id: string;
  name: string;
  team: string;
  isPlayer: boolean;
  progress: number; // total spline progress (e.g., laps + trackT)
  raceTimeMs: number;
  fastestLapMs: number;
  severeCrashes: number;
}

export interface DriverFinish {
  driverId: string;
  driverName: string;
  team: string;
  isPlayer: boolean;
  finishPosition: number; // 1 to 20
  raceTimeMs: number;
  fastestLapMs: number;
  hasFastestLap: boolean;
  isCleanDriver: boolean;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
}

export interface DriverStanding {
  driverId: string;
  driverName: string;
  team: string;
  isPlayer: boolean;
  points: number;
  wins: number;
  podiums: number; // 1st, 2nd, or 3rd
  bestFinish: number;
  history: number[]; // Points scored per race
}

export class ChampionshipEngine {
  /**
   * Returns standard 1st-15th points for a given finishing rank.
   */
  public static getBasePoints(position: number): number {
    return POINTS_TABLE[position] ?? 0;
  }

  /**
   * Compiles final positions, assigns points, and calculates fastest lap and clean driver bonuses.
   */
  public static computeRaceFinishes(participants: RawRaceParticipant[]): DriverFinish[] {
    // Sort primarily by progress descending (furthest along track), tie-break by race time ascending
    const sorted = [...participants].sort((a, b) => {
      if (Math.abs(b.progress - a.progress) > 0.001) {
        return b.progress - a.progress;
      }
      return a.raceTimeMs - b.raceTimeMs;
    });

    // Determine driver with the single fastest lap
    let minLapTime = Infinity;
    let fastestLapDriverId: string | null = null;
    for (const p of sorted) {
      if (p.fastestLapMs > 0 && p.fastestLapMs < minLapTime) {
        minLapTime = p.fastestLapMs;
        fastestLapDriverId = p.id;
      }
    }

    return sorted.map((p, index) => {
      const finishPosition = index + 1;
      const basePoints = this.getBasePoints(finishPosition);
      const hasFastestLap = p.id === fastestLapDriverId;
      const isCleanDriver = p.isPlayer && p.severeCrashes === 0;

      let bonusPoints = 0;
      if (hasFastestLap) {
        bonusPoints += FASTEST_LAP_BONUS;
      }
      if (isCleanDriver) {
        bonusPoints += CLEAN_DRIVER_BONUS;
      }

      return {
        driverId: p.id,
        driverName: p.name,
        team: p.team,
        isPlayer: p.isPlayer,
        finishPosition,
        raceTimeMs: p.raceTimeMs,
        fastestLapMs: p.fastestLapMs,
        hasFastestLap,
        isCleanDriver,
        basePoints,
        bonusPoints,
        totalPoints: basePoints + bonusPoints
      };
    });
  }

  /**
   * Updates seasonal standings with the results of a completed race.
   */
  public static updateStandings(
    currentStandings: DriverStanding[],
    finishes: DriverFinish[]
  ): DriverStanding[] {
    const standingsMap = new Map<string, DriverStanding>();

    for (const standing of currentStandings) {
      standingsMap.set(standing.driverId, {
        ...standing,
        history: [...standing.history]
      });
    }

    for (const finish of finishes) {
      let driver = standingsMap.get(finish.driverId);
      if (!driver) {
        driver = {
          driverId: finish.driverId,
          driverName: finish.driverName,
          team: finish.team,
          isPlayer: finish.isPlayer,
          points: 0,
          wins: 0,
          podiums: 0,
          bestFinish: 20,
          history: []
        };
        standingsMap.set(finish.driverId, driver);
      }

      driver.points += finish.totalPoints;
      driver.history.push(finish.totalPoints);
      if (finish.finishPosition === 1) {
        driver.wins++;
      }
      if (finish.finishPosition <= 3) {
        driver.podiums++;
      }
      if (finish.finishPosition < driver.bestFinish) {
        driver.bestFinish = finish.finishPosition;
      }
    }

    return this.sortStandings(Array.from(standingsMap.values()));
  }

  /**
   * Sorts standings by points descending, using wins and best finishes as tiebreakers.
   */
  public static sortStandings(standings: DriverStanding[]): DriverStanding[] {
    return [...standings].sort((a, b) => {
      // 1. Total points
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      // 2. Total wins
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      // 3. Total podiums
      if (b.podiums !== a.podiums) {
        return b.podiums - a.podiums;
      }
      // 4. Best finishing position (lower number is better)
      return a.bestFinish - b.bestFinish;
    });
  }
}
