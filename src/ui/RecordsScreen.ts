import { ALL_TRACKS } from '../track/TrackDefinitions';
import { formatLapTime } from '../app/TimeTrial';
import { levelProgress, MAX_LEVEL, xpForLevel } from '../engine/CareerManager';

/** What the Records tab shows (R9 part 2). Built each time it opens. */
export interface RecordsModel {
  level: number;
  xp: number;
  stats: {
    races: number;
    wins: number;
    podiums: number;
    fastestLaps: number;
    cleanRaces: number;
    placesGained: number;
    ghostBeats: number;
    seasons: number;
    goldTrophies: number;
    silverTrophies: number;
    bronzeTrophies: number;
  };
  /** Your best lap on each track in ms (from the saved ghosts), in ALL_TRACKS order; null: none */
  bestLaps: (number | null)[];
  /** Your best race finish on each track, in ALL_TRACKS order; null: not raced */
  bestFinishes: (number | null)[];
}

interface RecordsTrackRow {
  name: string;
  bestLap: string;
  bestFinish: string;
  /** Podium colour for the best finish, or null */
  medal: 'gold' | 'silver' | 'bronze' | null;
}

const MEDALS = ['gold', 'silver', 'bronze'] as const;

/** One row per track: best lap and best finish */
export function recordsTrackRows(model: RecordsModel): RecordsTrackRow[] {
  return ALL_TRACKS.map((track, index) => {
    const lap = model.bestLaps[index] ?? null;
    const finish = model.bestFinishes[index] ?? null;
    return {
      name: track.name,
      bestLap: lap === null ? '—' : formatLapTime(lap),
      bestFinish: finish === null ? '—' : `P${finish}`,
      medal: finish !== null && finish <= 3 ? MEDALS[finish - 1]! : null
    };
  });
}

/** "Level 4 · 1,020 XP · 40% to level 5" */
export function levelLine(level: number, xp: number): string {
  const total = `${xp.toLocaleString('en-GB')} XP`;
  if (level >= MAX_LEVEL) return `Level ${level} · ${total} · top level`;
  const percent = Math.floor(levelProgress(xp) * 100);
  const toGo = (xpForLevel(level + 1) - xp).toLocaleString('en-GB');
  return `Level ${level} · ${total} · ${percent}% to level ${level + 1} (${toGo} to go)`;
}

/** The career numbers, in the order shown */
export function careerStatRows(model: RecordsModel): [string, string][] {
  const s = model.stats;
  const winRate = s.races > 0 ? `${Math.round((s.wins / s.races) * 100)}%` : '—';
  return [
    ['Races', String(s.races)],
    ['Wins', `${s.wins} (${winRate})`],
    ['Podiums', String(s.podiums)],
    ['Fastest laps', String(s.fastestLaps)],
    ['Clean races', String(s.cleanRaces)],
    ['Places gained', String(s.placesGained)],
    ['Ghosts beaten', String(s.ghostBeats)],
    ['Seasons finished', String(s.seasons)]
  ];
}

/**
 * Records (R9 part 2, docs/DESIGN.md section 5): your level, career numbers, the trophy
 * cabinet, and your best lap and best finish on every track. Opens over the hub.
 * Markup: index.html (#records-screen).
 */
export class RecordsScreen {
  private readonly root: HTMLElement | null;

  constructor() {
    this.root = document.getElementById('records-screen');
    document.getElementById('records-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  public get isOpen(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  public open(model: RecordsModel): void {
    this.render(model);
    this.root?.classList.add('active');
  }

  /** Best laps arrive from storage after the screen opens */
  public update(model: RecordsModel): void {
    if (this.isOpen) this.render(model);
  }

  public close(): void {
    this.root?.classList.remove('active');
  }

  private render(model: RecordsModel): void {
    const level = document.getElementById('records-level');
    if (level) level.textContent = levelLine(model.level, model.xp);

    const stats = document.getElementById('records-stats');
    stats?.replaceChildren(
      ...careerStatRows(model).flatMap(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      })
    );

    const counts = { gold: model.stats.goldTrophies, silver: model.stats.silverTrophies, bronze: model.stats.bronzeTrophies };
    this.root?.querySelectorAll<HTMLElement>('[data-trophy-count]').forEach((el) => {
      const kind = el.dataset.trophyCount as keyof typeof counts;
      el.textContent = String(counts[kind] ?? 0);
      el.closest('.records-trophy')?.classList.toggle('won', (counts[kind] ?? 0) > 0);
    });

    const tracks = document.getElementById('records-tracks');
    tracks?.replaceChildren(
      ...recordsTrackRows(model).map((row) => {
        const el = document.createElement('div');
        el.className = 'records-track';
        const name = document.createElement('span');
        name.className = 'records-track-name';
        name.textContent = row.name;
        const lap = document.createElement('span');
        lap.className = 'records-track-lap';
        lap.textContent = row.bestLap;
        const finish = document.createElement('span');
        finish.className = 'records-track-finish';
        finish.textContent = row.bestFinish;
        if (row.medal) finish.dataset.medal = row.medal;
        el.append(name, lap, finish);
        return el;
      })
    );
  }
}
