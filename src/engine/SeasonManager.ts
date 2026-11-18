import { AI_DRIVER_ROSTER } from '../ai/AIDriverProfiles';
import { ALL_TRACKS, TrackData } from '../track/TrackDefinitions';
import { ChampionshipEngine, DriverFinish, DriverStanding } from './ChampionshipEngine';
import { Championship, GRAND_PRIX, trackIndexOf } from './Championships';

export interface CompletedRaceRecord {
  trackId: string;
  trackName: string;
  playerFinish: number;
  playerPoints: number;
  fastestLapMs: number;
  winnerName: string;
}

export type ChampionshipTrophy = 'none' | 'gold' | 'silver' | 'bronze';

export interface SeasonData {
  seasonId: string;
  currentRaceIndex: number; // 0 to 7
  restartTokensRemaining: number;
  standings: DriverStanding[];
  raceHistory: CompletedRaceRecord[];
  seasonCompleted: boolean;
  trophy: ChampionshipTrophy;
}


function createInitialStandings(): DriverStanding[] {
  return [
    {
      driverId: 'player',
      driverName: 'Player (You)',
      team: 'Apex Slipstream GP',
      isPlayer: true,
      points: 0,
      wins: 0,
      podiums: 0,
      bestFinish: 20,
      history: []
    },
    ...AI_DRIVER_ROSTER.map((ai) => ({
      driverId: ai.id,
      driverName: ai.name,
      team: ai.team,
      isPlayer: false,
      points: 0,
      wins: 0,
      podiums: 0,
      bestFinish: 20,
      history: []
    }))
  ];
}

const DEFAULT_SEASON: SeasonData = {
  seasonId: 'season_01',
  currentRaceIndex: 0,
  restartTokensRemaining: 3,
  standings: createInitialStandings(),
  raceHistory: [],
  seasonCompleted: false,
  trophy: 'none'
};

/** A new season with its own standings and history (never DEFAULT_SEASON's shared arrays) */
function freshSeason(): SeasonData {
  return { ...DEFAULT_SEASON, standings: createInitialStandings(), raceHistory: [] };
}

export class SeasonManager {
  private data: SeasonData;

  constructor(public readonly championship: Championship = GRAND_PRIX) {
    this.data = this.loadState();
  }

  /** This season's id: a new season gets a new one, and with it new weather (R7) */
  public get seasonId(): string {
    return this.data.seasonId;
  }

  public get currentRaceIndex(): number {
    return this.data.currentRaceIndex;
  }

  public get totalRaces(): number {
    return this.championship.trackIds.length;
  }

  /** The current round's track, as an index into ALL_TRACKS */
  public get currentTrackIndex(): number {
    return trackIndexOf(this.championship.trackIds[this.data.currentRaceIndex] ?? '');
  }

  public get currentTrack(): TrackData {
    return ALL_TRACKS[this.currentTrackIndex] ?? ALL_TRACKS[0]!;
  }

  /** The round (0-based) a track is raced in this championship, or null if it is not */
  public roundOfTrack(trackIndex: number): number | null {
    const round = this.championship.trackIds.indexOf(ALL_TRACKS[trackIndex]?.id ?? '');
    return round < 0 ? null : round;
  }

  public get restartTokensRemaining(): number {
    return this.data.restartTokensRemaining;
  }

  public get isSeasonCompleted(): boolean {
    return this.data.seasonCompleted;
  }

  public get trophy(): ChampionshipTrophy {
    return this.data.trophy;
  }

  public get standings(): DriverStanding[] {
    return [...this.data.standings];
  }

  public get raceHistory(): CompletedRaceRecord[] {
    return [...this.data.raceHistory];
  }

  public getPlayerStanding(): DriverStanding | undefined {
    return this.data.standings.find((s) => s.isPlayer);
  }

  public canRestart(): boolean {
    return this.data.restartTokensRemaining > 0;
  }

  public consumeRestartToken(): boolean {
    if (this.canRestart()) {
      this.data.restartTokensRemaining--;
      this.saveState();
      return true;
    }
    return false;
  }

  /**
   * Records completed race results, updates points, and advances to the next track.
   */
  public recordRaceResult(finishes: DriverFinish[]): {
    updatedStandings: DriverStanding[];
    isSeasonFinale: boolean;
    trophy: ChampionshipTrophy;
  } {
    // A finished season takes no more results: replaying the finale after a reload must
    // not count it twice (P15-16). The podium starts the next season.
    if (this.data.seasonCompleted) {
      return { updatedStandings: this.standings, isSeasonFinale: true, trophy: this.data.trophy };
    }

    // Update standings using ChampionshipEngine
    const updatedStandings = ChampionshipEngine.updateStandings(this.data.standings, finishes);
    this.data.standings = updatedStandings;

    // Record race history entry
    const playerFinish = finishes.find((f) => f.isPlayer);
    const winner = finishes[0];
    const track = this.currentTrack;

    this.data.raceHistory.push({
      trackId: track.id,
      trackName: track.name,
      playerFinish: playerFinish?.finishPosition ?? 20,
      playerPoints: playerFinish?.totalPoints ?? 0,
      fastestLapMs: playerFinish?.fastestLapMs ?? 0,
      winnerName: winner?.driverName ?? 'Marcus Vance'
    });

    const isSeasonFinale = this.data.currentRaceIndex >= this.totalRaces - 1;

    if (isSeasonFinale) {
      this.data.seasonCompleted = true;
      const playerRank = updatedStandings.findIndex((s) => s.isPlayer) + 1;
      if (playerRank === 1) {
        this.data.trophy = 'gold';
      } else if (playerRank === 2) {
        this.data.trophy = 'silver';
      } else if (playerRank === 3) {
        this.data.trophy = 'bronze';
      } else {
        this.data.trophy = 'none';
      }
    } else {
      this.data.currentRaceIndex++;
    }

    this.saveState();

    return {
      updatedStandings,
      isSeasonFinale,
      trophy: this.data.trophy
    };
  }

  /**
   * Resets the entire championship season back to Race 1 with refreshed restart tokens.
   */
  public resetSeason(): void {
    this.data = {
      ...DEFAULT_SEASON,
      seasonId: `season_${Date.now().toString(36)}`,
      standings: createInitialStandings(),
      raceHistory: []
    };
    this.saveState();
  }

  private loadState(): SeasonData {
    if (typeof window === 'undefined' || !window.localStorage) {
      return freshSeason();
    }

    try {
      const stored = window.localStorage.getItem(this.championship.storageKey);
      if (!stored) {
        return freshSeason();
      }
      const parsed = JSON.parse(stored) as Partial<SeasonData>;
      return {
        seasonId: parsed.seasonId ?? DEFAULT_SEASON.seasonId,
        currentRaceIndex: typeof parsed.currentRaceIndex === 'number'
          ? Math.max(0, Math.min(this.totalRaces - 1, parsed.currentRaceIndex))
          : DEFAULT_SEASON.currentRaceIndex,
        restartTokensRemaining: typeof parsed.restartTokensRemaining === 'number'
          ? Math.max(0, Math.min(3, parsed.restartTokensRemaining))
          : DEFAULT_SEASON.restartTokensRemaining,
        standings: Array.isArray(parsed.standings) && parsed.standings.length === 20
          ? parsed.standings
          : createInitialStandings(),
        raceHistory: Array.isArray(parsed.raceHistory) ? parsed.raceHistory : [],
        seasonCompleted: !!parsed.seasonCompleted,
        trophy: parsed.trophy ?? 'none'
      };
    } catch (e) {
      console.warn('SeasonManager: corrupted state detected, resetting to defaults', e);
      return freshSeason();
    }
  }

  private saveState(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(this.championship.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('SeasonManager: failed to save state to localStorage', e);
    }
  }
}
