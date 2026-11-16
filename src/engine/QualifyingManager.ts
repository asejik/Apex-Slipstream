import {
  buildSpeedPlan,
  buildTrackProfile,
  conditionsConfig,
  DIFFICULTY_LIMIT,
  driverLimit,
  planLapSeconds,
  TrackProfile
} from '../ai/AIRacecraft';
import type { WeatherCondition } from '../tires/TireTypes';
import { TrackSpline } from '../track/TrackSpline';
import { AI_DRIVER_ROSTER, AIDriverProfile } from '../ai/AIDriverProfiles';
import { TrackData } from '../track/TrackDefinitions';
import type { LapState } from './LapManager';

export type QualifyingMode = 'flying_lap' | 'sector_sprint' | 'skip';

export interface AIQualifyingResult {
  driverId: string;
  driverName: string;
  team: string;
  lapTimeMs: number;
}

export interface QualifyingOutcome {
  mode: QualifyingMode;
  playerPosition: number; // 1 to 20
  playerTimeMs: number;
  poleTimeMs: number;
  deltaToPoleMs: number;
  gridOrder: string[]; // driver IDs ordered 1 to 20 (including 'player')
}

export class QualifyingManager {
  /** Racing line and corner speeds per track, built once (they never change) */
  private static readonly profiles = new Map<string, TrackProfile>();

  private static profileFor(track: TrackData, weather: WeatherCondition): TrackProfile {
    const key = `${track.id}:${track.points.length}:${weather}`;
    let profile = QualifyingManager.profiles.get(key);
    if (!profile) {
      profile = buildTrackProfile(new TrackSpline(track), conditionsConfig(weather));
      QualifyingManager.profiles.set(key, profile);
    }
    return profile;
  }

  /**
   * The player's session time once the qualifying run is over, or null while it is still running.
   * A flying lap ends after one lap; a sector sprint ends when sector 1 is complete.
   */
  public static sessionTimeMs(mode: QualifyingMode, lap: LapState): number | null {
    if (mode === 'flying_lap' && lap.lastLapTime !== null) return lap.lastLapTime * 1000;
    if (mode === 'sector_sprint' && lap.sector1Time !== null) return lap.sector1Time * 1000;
    return null;
  }

  /**
   * Generates realistic baseline AI qualifying times tailored to the track and driver skills.
   * `distanceFraction` scales them to part of a lap (sector sprint); 1 is a full lap.
   * `difficultyLimit` is the difficulty's share of the car's limit (DIFFICULTY_LIMIT).
   * Each driver's time is their real speed plan round the racing line (R6), so qualifying
   * matches how they race; a driver's specialty counts on tracks that suit it (P15-13).
   */
  public static generateAIBenchmarks(
    track: TrackData,
    distanceFraction = 1,
    difficultyLimit = DIFFICULTY_LIMIT.medium,
    weather: WeatherCondition = 'dry'
  ): AIQualifyingResult[] {
    const profile = QualifyingManager.profileFor(track, weather);
    const config = conditionsConfig(weather);

    const results: AIQualifyingResult[] = AI_DRIVER_ROSTER.map((driver: AIDriverProfile, idx: number) => {
      const plan = buildSpeedPlan(profile, driverLimit(driver, difficultyLimit, track, weather), config);
      const lapMs = planLapSeconds(plan, profile, distanceFraction) * 1000;
      // A little lap-to-lap variety, the same every time for a driver on a track (±1.5%)
      const jitter = 1.0 + (((idx * 17 + track.id.length) % 31) - 15) * 0.001;
      const lapTimeMs = Math.round((lapMs / jitter) * 10) / 10;

      return {
        driverId: driver.id,
        driverName: driver.name,
        team: driver.team,
        lapTimeMs
      };
    });

    // Sort AI times ascending (fastest first)
    results.sort((a, b) => a.lapTimeMs - b.lapTimeMs);
    return results;
  }

  /**
   * Calculates the starting grid position and ordered roster based on player qualifying time.
   */
  public static evaluateQualifying(
    mode: QualifyingMode,
    playerTimeMs: number,
    aiBenchmarks: AIQualifyingResult[]
  ): QualifyingOutcome {
    if (mode === 'skip' || playerTimeMs <= 0) {
      // Player starts at the rear of the grid (P20)
      const gridOrder = aiBenchmarks.map((ai) => ai.driverId);
      gridOrder.push('player');

      const poleTime = aiBenchmarks[0]?.lapTimeMs ?? 60000;
      return {
        mode: 'skip',
        playerPosition: 20,
        playerTimeMs: 0,
        poleTimeMs: poleTime,
        deltaToPoleMs: 0,
        gridOrder
      };
    }

    // Combine player with AI and rank ascending by time
    const poleTime = aiBenchmarks[0]?.lapTimeMs ?? 60000;
    let playerPosition = 20;

    // Count how many AI cars are slower than player
    const gridOrder: string[] = [];
    let playerPlaced = false;

    for (let i = 0; i < aiBenchmarks.length; i++) {
      const ai = aiBenchmarks[i];
      if (ai && !playerPlaced && playerTimeMs <= ai.lapTimeMs) {
        gridOrder.push('player');
        playerPosition = gridOrder.length;
        playerPlaced = true;
      }
      if (ai) {
        gridOrder.push(ai.driverId);
      }
    }

    if (!playerPlaced) {
      gridOrder.push('player');
      playerPosition = gridOrder.length;
    }

    const deltaToPoleMs = playerTimeMs - poleTime;

    return {
      mode,
      playerPosition,
      playerTimeMs,
      poleTimeMs: poleTime,
      deltaToPoleMs,
      gridOrder
    };
  }
}
