import { AI_DRIVER_ROSTER, AIDriverProfile } from '../ai/AIDriverProfiles';
import { TrackData } from '../track/TrackDefinitions';

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
  /**
   * Generates realistic baseline AI qualifying lap times tailored to the track and driver skills.
   */
  public static generateAIBenchmarks(track: TrackData): AIQualifyingResult[] {
    // Estimate track length from points
    let approxLength = 0;
    for (let i = 0; i < track.points.length; i++) {
      const p1 = track.points[i];
      const p2 = track.points[(i + 1) % track.points.length];
      if (p1 && p2) {
        approxLength += p1.distanceTo(p2);
      }
    }
    if (approxLength <= 0) approxLength = 1200;

    // Approximate baseline lap time at ~40 m/s (144 km/h) average pace
    const baselineLapMs = (approxLength / 40.0) * 1000;

    const results: AIQualifyingResult[] = AI_DRIVER_ROSTER.map((driver: AIDriverProfile, idx: number) => {
      // Deterministic pseudo-jitter based on driver index and track id length
      const affinityBonus = driver.terrainAffinity === driver.terrainAffinity ? 1.01 : 1.0;
      const effectiveSkill = driver.skill * affinityBonus;
      // Spread variance between -1.5% and +1.5%
      const jitter = 1.0 + (((idx * 17 + track.id.length) % 31) - 15) * 0.001;
      const lapTimeMs = Math.round((baselineLapMs / (effectiveSkill * jitter)) * 10) / 10;

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
