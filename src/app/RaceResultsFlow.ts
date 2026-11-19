import { RaceWorld } from '../engine/RaceWorld';
import { HUDController } from '../ui/HUDController';
import { SeasonManager } from '../engine/SeasonManager';
import { CareerManager, xpSummary } from '../engine/CareerManager';
import { AudioEngine } from '../audio/AudioEngine';
import { buildRaceParticipants } from '../engine/RaceResults';
import { ChampionshipEngine, DriverFinish } from '../engine/ChampionshipEngine';
import { unlocksBetween } from './Unlocks';
import { rivalResultLine } from '../engine/Rivals';
import { askToKeepSave } from './SaveFile';
import { Session } from './Session';

/** What the results flow reads and shows */
export interface ResultsParts {
  readonly world: RaceWorld;
  readonly hudController: HUDController;
  /** The season being raced; a new one replaces it when you choose another championship */
  season(): SeasonManager;
  readonly career: CareerManager;
  readonly audioEngine: AudioEngine;
}

/** What the results flow asks the game to do next */
export interface ResultsHooks {
  /** Line up the season's next round behind the hub and show it */
  returnToHub(): void;
  /** Practice is over: line up again on the same track */
  rerunPractice(): void;
  /** A new level may have unlocked a new AI tier */
  refreshAiDifficulty(): void;
}

/** The race just finished, as the game saw it */
export interface FinishedRace {
  session: Session;
  /** Your rival this race; null in practice, qualifying and time trials */
  rivalId: string | null;
  /** Your fastest lap that counts for the fastest-lap bonus (U-09); null if none */
  bestLapMs: number | null;
}

/**
 * After the chequered flag's cool-down (P09-R02 step 4): the classification, points, career
 * XP and unlocks, the results and standings screens, and the season's podium.
 */
export class RaceResultsFlow {
  constructor(
    private readonly parts: ResultsParts,
    private readonly hooks: ResultsHooks
  ) {}

  /** Scores the race just finished and shows its results */
  show(race: FinishedRace): void {
    const { world, hudController, career } = this.parts;
    const seasonManager = this.parts.season();
    const finishTimeSeconds = world.playerFinishTime ?? world.totalRaceElapsedSeconds;
    // The engine falls silent with the results: the results screens are quiet
    this.parts.audioEngine.setActive(false);

    if (race.session.kind === 'practice') {
      // Practice results never count toward the season: line up again on the same track
      this.hooks.rerunPractice();
      return;
    }
    const quickRace = race.session.kind === 'quick';

    // Main 20-Car Grand Prix completed: compute official points and standing
    const participants = buildRaceParticipants(
      {
        finishTimeSeconds,
        bestLapMs: race.bestLapMs,
        severeCrashes: world.severeCrashesThisRace
      },
      world.aiDriverManager.cars,
      world.lapManager.state.totalLaps
    );

    const finishes: DriverFinish[] = ChampionshipEngine.computeRaceFinishes(participants);
    const trackName = world.trackSpline.data.name;

    // A finished race is worth keeping: ask the browser not to clear the save (P07-R02)
    askToKeepSave();

    // Career XP for the race (R9): a Quick Race earns half
    const playerFinish = finishes.find((finish) => finish.isPlayer);
    const rivalFinish = race.rivalId ? finishes.find((finish) => finish.driverId === race.rivalId) : undefined;
    let xpLine: string | null = null;
    if (playerFinish) {
      const beatRival = rivalFinish ? playerFinish.finishPosition < rivalFinish.finishPosition : undefined;
      const award = career.awardRace({
        rivalId: rivalFinish?.driverId,
        beatRival,
        kind: quickRace ? 'quick' : 'championship',
        trackId: world.trackSpline.data.id,
        finishPosition: playerFinish.finishPosition,
        gridPosition: world.raceGridPosition,
        hasFastestLap: playerFinish.hasFastestLap,
        isCleanDriver: playerFinish.isCleanDriver
      });
      xpLine = xpSummary(award, career.xp);
      if (rivalFinish && beatRival !== undefined) {
        xpLine += ` · ${rivalResultLine(rivalFinish.driverId, beatRival, career.headToHead(rivalFinish.driverId))}`;
      }
      const unlocked = unlocksBetween(award.levelBefore, award.levelAfter);
      if (unlocked.length > 0) {
        xpLine += ` · Unlocked: ${unlocked.join(', ')}`;
        // A new AI tier may now apply
        this.hooks.refreshAiDifficulty();
      }
    }

    if (quickRace) {
      // A Quick Race shows its result and goes back to the hub; the season is untouched
      const showQuickResults = (): void => {
        hudController.showResultsModal(
          finishes,
          `Quick race · ${trackName}`,
          () => this.hooks.returnToHub(),
          () =>
            hudController.showStandingsModal(
              seasonManager.standings,
              seasonManager.raceHistory.length,
              seasonManager.totalRaces,
              showQuickResults
            ),
          { nextLabel: 'Back to hub', note: "Quick race results don't count for the championship" }
        );
        hudController.setResultsXp(xpLine);
      };
      showQuickResults();
      return;
    }

    // The track just raced: recording the result moves the season on to the next round
    const alreadyFinished = seasonManager.isSeasonCompleted;
    const result = seasonManager.recordRaceResult(finishes);
    // A finished championship goes in the trophy cabinet once (R9, P15-16)
    if (result.isSeasonFinale && !alreadyFinished) career.recordSeason(result.trophy);

    const showResults = (): void => {
      hudController.showResultsModal(
        finishes,
        trackName,
        () => {
          // Next race: back to the hub, which shows the updated standings
          if (result.isSeasonFinale) {
            this.showSeasonEnd();
          } else {
            this.hooks.returnToHub();
          }
        },
        () => {
          // Standings, then back to these results (not left stranded on the track)
          hudController.showStandingsModal(
            result.updatedStandings,
            seasonManager.raceHistory.length,
            seasonManager.totalRaces,
            showResults
          );
        }
      );
      hudController.setResultsXp(xpLine);
    };
    showResults();
  }

  /** The podium for the season just finished; its button starts the next season */
  showSeasonEnd(): void {
    const hudController = this.parts.hudController;
    const seasonManager = this.parts.season();
    hudController.showPodiumModal(
      seasonManager.trophy,
      () => {
        seasonManager.resetSeason();
        this.hooks.returnToHub();
      },
      seasonManager.totalRaces
    );
  }

  /**
   * A season that finished but was never closed (the game was shut on the results or the
   * podium) shows its podium on the hub, instead of offering the final round again (P15-16)
   */
  showSeasonEndIfDue(): void {
    if (this.parts.season().isSeasonCompleted) this.showSeasonEnd();
  }
}
