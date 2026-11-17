import { ALL_TRACKS } from '../track/TrackDefinitions';
import { Championship, CHAMPIONSHIPS, isChampionshipUnlocked, trackIndexOf } from '../engine/Championships';

/** Where you are in a championship's saved season, for the list */
interface ChampionshipProgress {
  /** 0-based round you are on */
  round: number;
  totalRaces: number;
}

interface ChampionshipRow {
  id: string;
  name: string;
  detail: string;
  status: string;
  locked: boolean;
  active: boolean;
}

/** One row per championship: its tracks, and your progress or the level it unlocks at */
export function championshipRows(
  level: number,
  activeId: string,
  progress: (championship: Championship) => ChampionshipProgress
): ChampionshipRow[] {
  return CHAMPIONSHIPS.map((championship) => {
    const locked = !isChampionshipUnlocked(championship, level);
    const tracks = championship.trackIds.map((id) => ALL_TRACKS[trackIndexOf(id)]!.name.split(' ')[0]).join(', ');
    let status = `Unlocks at level ${championship.unlockLevel}`;
    if (!locked) {
      const p = progress(championship);
      status = p.round === 0 ? `${p.totalRaces} rounds` : `Round ${p.round + 1} of ${p.totalRaces}`;
    }
    return {
      id: championship.id,
      name: championship.name,
      detail: `${championship.blurb} · ${tracks}`,
      status,
      locked,
      active: championship.id === activeId
    };
  });
}

/**
 * Championships (R9 part 3): the Grand Prix and the short championships your level has
 * unlocked. Each keeps its own season; choosing one makes it the hub's next race.
 * Markup: index.html (#championships-screen).
 */
export class ChampionshipsScreen {
  private readonly root: HTMLElement | null;
  private readonly list: HTMLElement | null;

  constructor(private readonly onChoose: (championshipId: string) => void) {
    this.root = document.getElementById('championships-screen');
    this.list = document.getElementById('championships-list');
    document.getElementById('championships-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  public get isOpen(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  public open(rows: ChampionshipRow[]): void {
    this.list?.replaceChildren(
      ...rows.map((row) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'qr-track';
        button.classList.toggle('on', row.active);
        button.setAttribute('aria-pressed', String(row.active));
        button.disabled = row.locked;
        const name = document.createElement('span');
        name.className = 'qr-track-name';
        name.textContent = row.name;
        const status = document.createElement('span');
        status.className = row.locked ? 'champ-status locked' : 'champ-status';
        status.textContent = row.status;
        const detail = document.createElement('small');
        detail.className = 'qr-track-detail';
        detail.textContent = row.detail;
        button.append(name, status, detail);
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          this.close();
          this.onChoose(row.id);
        });
        return button;
      })
    );
    this.root?.classList.add('active');
  }

  public close(): void {
    this.root?.classList.remove('active');
  }
}
