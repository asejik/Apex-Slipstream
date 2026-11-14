export interface SeasonData {
  seasonId: string;
  restartTokensRemaining: number;
  racesCompleted: number;
  totalPoints: number;
}

const STORAGE_KEY = 'apex_season_v1';
const DEFAULT_SEASON: SeasonData = {
  seasonId: 'season_01',
  restartTokensRemaining: 3,
  racesCompleted: 0,
  totalPoints: 0
};

export class SeasonManager {
  private data: SeasonData;

  constructor() {
    this.data = this.loadState();
  }

  public get restartTokensRemaining(): number {
    return this.data.restartTokensRemaining;
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

  public resetSeason(): void {
    this.data = { ...DEFAULT_SEASON };
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
        restartTokensRemaining: typeof parsed.restartTokensRemaining === 'number'
          ? Math.max(0, Math.min(3, parsed.restartTokensRemaining))
          : DEFAULT_SEASON.restartTokensRemaining,
        racesCompleted: parsed.racesCompleted ?? 0,
        totalPoints: parsed.totalPoints ?? 0
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
