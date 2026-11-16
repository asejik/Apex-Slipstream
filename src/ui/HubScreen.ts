import { AI_DRIVER_ROSTER } from '../ai/AIDriverProfiles';
import { ChampionshipEngine, DriverStanding } from '../engine/ChampionshipEngine';

/** One row of the hub's live standings table. */
interface HubStandingRow {
  position: number;
  /** Surname in capitals, or YOU for the player */
  name: string;
  points: number;
  isPlayer: boolean;
  /** 1 to 10: which --color-team-N strip to draw. 0 for the player */
  teamColour: number;
}

/** What the hub shows. Built from the season each time the hub opens. */
export interface HubModel {
  round: number; // 1-based
  totalRaces: number;
  trackName: string;
  laps: number;
  isCircuit: boolean;
  /** The round's weather forecast, e.g. "Rain" (R7) */
  forecast: string;
  standings: DriverStanding[];
  restartTokens: number;
}

/** AI driver N gets team colour ((N mod 10) + 1), as docs/DESIGN.md section 3 sets out. */
export function teamColourFor(driverId: string): number {
  const index = AI_DRIVER_ROSTER.findIndex((d) => d.id === driverId);
  return index < 0 ? 0 : (index % 10) + 1;
}

function shortName(standing: DriverStanding): string {
  if (standing.isPlayer) return 'YOU';
  const parts = standing.driverName.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? standing.driverName).toUpperCase();
}

/**
 * The championship top `size`, in order. If the player is outside it, the last row is
 * replaced by the player's own row, so you always see where you are.
 */
export function hubStandingsRows(standings: DriverStanding[], size = 5): HubStandingRow[] {
  const sorted = ChampionshipEngine.sortStandings(standings);
  const toRow = (s: DriverStanding, i: number): HubStandingRow => ({
    position: i + 1,
    name: shortName(s),
    points: s.points,
    isPlayer: s.isPlayer,
    teamColour: s.isPlayer ? 0 : teamColourFor(s.driverId)
  });

  const rows = sorted.slice(0, size).map(toRow);
  const playerIndex = sorted.findIndex((s) => s.isPlayer);
  if (playerIndex >= size && rows.length === size) {
    rows[size - 1] = toRow(sorted[playerIndex]!, playerIndex);
  }
  return rows;
}

/** The player's place and points, and the gap to the leader ("LEADER" when first). */
export function playerSeasonSummary(standings: DriverStanding[]): { position: number; points: number; gapLabel: string } {
  const sorted = ChampionshipEngine.sortStandings(standings);
  const index = sorted.findIndex((s) => s.isPlayer);
  const player = sorted[index];
  const leader = sorted[0];
  if (!player || !leader) return { position: 0, points: 0, gapLabel: '—' };
  const gap = leader.points - player.points;
  return {
    position: index + 1,
    points: player.points,
    gapLabel: index === 0 ? 'Leader' : `${gap} pts`
  };
}

/**
 * The home hub (docs/DESIGN.md section 5): the next race, the live championship standings,
 * and the other modes. The markup is in index.html (#hub-screen); this fills and shows it.
 */
export class HubScreen {
  private readonly root: HTMLElement | null;
  private readonly onStartWeekend: () => void;
  private readonly onOpenStandings: () => void;

  constructor(onStartWeekend: () => void, onOpenStandings: () => void, onOpenSettings: () => void) {
    this.root = document.getElementById('hub-screen');
    this.onStartWeekend = onStartWeekend;
    this.onOpenStandings = onOpenStandings;

    document.getElementById('hub-start-weekend')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onStartWeekend();
    });
    document.getElementById('hub-standings-tile')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onOpenStandings();
    });
    document.getElementById('hub-tab-settings')?.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpenSettings();
    });
  }

  public get isVisible(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  public show(model: HubModel): void {
    this.render(model);
    this.root?.classList.add('active');
  }

  public hide(): void {
    this.root?.classList.remove('active');
  }

  private setText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  private render(model: HubModel): void {
    const summary = playerSeasonSummary(model.standings);

    this.setText('hub-round', `Championship · Round ${model.round} of ${model.totalRaces}`);
    this.setText('hub-track-name', model.trackName);
    this.setText('hub-laps', model.isCircuit ? String(model.laps) : 'Sprint');
    this.setText('hub-forecast', model.forecast);
    this.setText('hub-gap', summary.gapLabel);
    this.setText('hub-restarts', String(model.restartTokens));
    this.setText('hub-season-chip', `P${summary.position} · ${summary.points} pts`);

    const body = document.getElementById('hub-standings-rows');
    if (!body) return;
    body.replaceChildren(
      ...hubStandingsRows(model.standings).map((row) => {
        const el = document.createElement('div');
        el.className = row.isPlayer ? 'tower-row me' : 'tower-row';

        const pos = document.createElement('span');
        pos.className = 'tower-pos';
        pos.textContent = String(row.position);

        const strip = document.createElement('span');
        strip.className = 'tower-strip';
        if (row.teamColour > 0) {
          strip.style.background = `var(--color-team-${row.teamColour})`;
        }

        const name = document.createElement('span');
        name.className = 'tower-name';
        name.textContent = row.name;

        const pts = document.createElement('span');
        pts.className = 'tower-value';
        pts.textContent = String(row.points);

        el.append(pos, strip, name, pts);
        return el;
      })
    );
  }
}
