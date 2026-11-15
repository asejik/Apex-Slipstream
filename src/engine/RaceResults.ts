import type { AICarState } from '../ai/AIDriverManager';
import type { RawRaceParticipant } from './ChampionshipEngine';
import { RaceProgress, classificationProgress, isAhead } from './RaceOrder';

/** Copies the race progress of an AI car into `out` (reused, no allocation). */
function copyAIProgress(ai: AICarState, out: RaceProgress): RaceProgress {
  out.completedLaps = ai.lap - 1;
  out.lapFraction = ai.splineT;
  out.finishTime = ai.finishTime;
  return out;
}

/**
 * The live position of the player (1 = leading) among the AI cars.
 * `scratch` is a reused record: no allocation per call.
 */
export function livePosition(
  player: RaceProgress,
  aiCars: AICarState[],
  totalLaps: number,
  scratch: RaceProgress
): number {
  let rank = 1;
  for (let i = 0; i < aiCars.length; i++) {
    const ai = aiCars[i];
    if (!ai) continue;
    if (isAhead(copyAIProgress(ai, scratch), player, totalLaps)) {
      rank++;
    }
  }
  return rank;
}

interface PlayerRaceSummary {
  /** Seconds from the start to the player completing the race distance. */
  finishTimeSeconds: number;
  /** Fastest lap that counts for the bonus, in ms; null if none (U-09). */
  bestLapMs: number | null;
  severeCrashes: number;
}

/** The raw result of all 20 drivers at the moment the player finishes, ready for the points engine. */
export function buildRaceParticipants(
  player: PlayerRaceSummary,
  aiCars: AICarState[],
  totalLaps: number
): RawRaceParticipant[] {
  // The player has just completed the race distance: finishers share one progress value
  // and are ordered by finish time (see RaceOrder)
  const playerProgress = classificationProgress(
    { completedLaps: totalLaps, lapFraction: 0, finishTime: player.finishTimeSeconds },
    totalLaps
  );
  const scratch: RaceProgress = { completedLaps: 0, lapFraction: 0, finishTime: null };

  return [
    {
      id: 'player',
      name: 'Player (You)',
      team: 'Apex Slipstream GP',
      isPlayer: true,
      progress: playerProgress,
      raceTimeMs: Math.round(player.finishTimeSeconds * 1000),
      // 0 = no counted lap; the engine ignores it for the bonus
      fastestLapMs: Math.round(player.bestLapMs ?? 0),
      severeCrashes: player.severeCrashes
    },
    ...aiCars.map((ai) => ({
      id: ai.profile.id,
      name: ai.profile.name,
      team: ai.profile.team,
      isPlayer: false,
      progress: classificationProgress(copyAIProgress(ai, scratch), totalLaps),
      raceTimeMs: ai.finishTime !== null
        ? Math.round(ai.finishTime * 1000)
        : Math.round(player.finishTimeSeconds * 1000 + (1.02 - ai.profile.skill) * 4000),
      // Real lap times (U-09); before, these were invented from the best lap of the player
      fastestLapMs: Math.round((ai.bestLapTime ?? 0) * 1000),
      severeCrashes: ai.isSpinningOut ? 1 : 0
    }))
  ];
}
