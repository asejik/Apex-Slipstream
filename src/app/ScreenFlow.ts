/**
 * Which screen the game is on (R3 part 3). Screens follow docs/DESIGN.md section 5:
 * the hub, a race in progress, and the pause menu over a race. The race weekend steps
 * (qualifying choice, results, standings, podium) are still modals inside 'racing'.
 */
export type Screen = 'hub' | 'racing' | 'paused';

const ALLOWED: Record<Screen, readonly Screen[]> = {
  hub: ['racing'],
  racing: ['paused', 'hub'],
  paused: ['racing', 'hub']
};

export class ScreenFlow {
  private screen: Screen;
  private readonly onChange: (to: Screen, from: Screen) => void;

  constructor(initial: Screen, onChange: (to: Screen, from: Screen) => void = () => {}) {
    this.screen = initial;
    this.onChange = onChange;
  }

  public get current(): Screen {
    return this.screen;
  }

  /** True only while a race runs: physics, AI, timers and lap counting move. */
  public get isSimulating(): boolean {
    return this.screen === 'racing';
  }

  public canGo(to: Screen): boolean {
    return ALLOWED[this.screen].includes(to);
  }

  /** Moves to `to` and returns true, or returns false (and stays) if that move is not allowed. */
  public go(to: Screen): boolean {
    if (!this.canGo(to)) return false;
    const from = this.screen;
    this.screen = to;
    this.onChange(to, from);
    return true;
  }

  /** Pause during a race, resume from the pause menu. Does nothing on the hub. */
  public togglePause(): boolean {
    if (this.screen === 'racing') return this.go('paused');
    if (this.screen === 'paused') return this.go('racing');
    return false;
  }
}

/**
 * Leaving a race for the hub: free in practice and qualifying. In a championship race it
 * re-runs the round, so it costs a restart token like a restart does; with none left the
 * race has to be finished.
 */
export function quitToHubCost(isChampionshipRace: boolean, tokensLeft: number): 'free' | 'token' | 'blocked' {
  if (!isChampionshipRace) return 'free';
  return tokensLeft > 0 ? 'token' : 'blocked';
}
