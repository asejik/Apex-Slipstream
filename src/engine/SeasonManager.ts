import { AI_DRIVER_ROSTER } from '../ai/AIDriverProfiles';
import { ALL_TRACKS, TrackData } from '../track/TrackDefinitions';
import { ChampionshipEngine, DriverFinish, DriverStanding } from './ChampionshipEngine';

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

const STORAGE_KEY = 'apex_season_v1';

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

export class SeasonManager {
  private data: SeasonData;

  constructor() {
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
    return ALL_TRACKS.length;
  }

  public get currentTrack(): TrackData {
    const track = ALL_TRACKS[this.data.currentRaceIndex];
    return track ?? ALL_TRACKS[0]!;
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

    const isSeasonFinale = this.data.currentRaceIndex >= ALL_TRACKS.length - 1;

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
      return { ...DEFAULT_SEASON };
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { ...DEFAULT_SEASON };
      }
      const parsed = JSON.parse(stored) as Partial<SeasonData>;
      return {
        seasonId: parsed.seasonId ?? DEFAULT_SEASON.seasonId,
        currentRaceIndex: typeof parsed.currentRaceIndex === 'number'
          ? Math.max(0, Math.min(ALL_TRACKS.length - 1, parsed.currentRaceIndex))
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
      return { ...DEFAULT_SEASON };
    }
  }

  private saveState(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('SeasonManager: failed to save state to localStorage', e);
    }
  }
}
