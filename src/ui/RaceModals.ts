import { TrackData } from '../track/TrackDefinitions';
import { DriverFinish, DriverStanding } from '../engine/ChampionshipEngine';
import { QualifyingMode } from '../engine/QualifyingManager';
import { ChampionshipTrophy } from '../engine/SeasonManager';
import { pointsBreakdown, renderResultRows, renderStandingRows, standingsProgressLabel } from './ClassificationRows';

/**
 * Swaps a button for a fresh copy with one click handler, so showing a screen again never
 * stacks a second handler on its button.
 */
function onlyHandler(id: string, onClick: () => void): HTMLElement | null {
  const button = document.getElementById(id);
  if (!button) return null;
  const fresh = button.cloneNode(true) as HTMLElement;
  button.parentNode?.replaceChild(fresh, button);
  fresh.addEventListener('click', onClick);
  return fresh;
}

/** One of the race pop-ups: shown by adding `active` to its element */
abstract class RaceModal {
  protected readonly root: HTMLElement | null;

  constructor(id: string) {
    this.root = document.getElementById(id);
  }

  public get isOpen(): boolean {
    return this.root?.classList.contains('active') ?? false;
  }

  public hide(): void {
    this.root?.classList.remove('active');
  }

  protected open(): void {
    this.root?.classList.add('active');
  }
}

/** Before a championship race: flying lap, sector sprint, or skip qualifying */
export class QualifyingModal extends RaceModal {
  private selectedMode: QualifyingMode = 'flying_lap';

  constructor() {
    super('modal-qualifying');
    const cards = [
      { el: document.getElementById('card-mode-flying'), mode: 'flying_lap' as QualifyingMode },
      { el: document.getElementById('card-mode-sector'), mode: 'sector_sprint' as QualifyingMode },
      { el: document.getElementById('card-mode-skip'), mode: 'skip' as QualifyingMode }
    ];
    cards.forEach(({ el, mode }) => {
      el?.addEventListener('click', (e) => {
        e.stopPropagation();
        cards.forEach((c) => c.el?.classList.remove('selected'));
        el.classList.add('selected');
        this.selectedMode = mode;
      });
    });
  }

  public show(track: TrackData, onStart: (mode: QualifyingMode) => void): void {
    const titleEl = document.getElementById('qualify-track-name');
    const descEl = document.getElementById('qualify-track-desc');
    if (titleEl) titleEl.textContent = track.name;
    if (descEl) descEl.textContent = `${track.description} · ${track.laps} Laps · ${track.biome.toUpperCase()}`;
    onlyHandler('btn-start-qualifying', () => {
      this.hide();
      onStart(this.selectedMode);
    });
    this.open();
  }
}

/** A race's classification, your points and XP */
export class ResultsModal extends RaceModal {
  constructor(private readonly playerName: () => string) {
    super('modal-race-results');
  }

  public show(
    finishes: DriverFinish[],
    trackName: string,
    onNextRace: () => void,
    onViewStandings: () => void,
    /** A race that does not count (Quick Race, R8): no points shown, and the button says where it goes */
    notCounted: { nextLabel: string; note: string } | null = null
  ): void {
    const playerFinish = finishes.find((f) => f.isPlayer);
    const headlineEl = document.getElementById('results-headline');
    const pointsTotalEl = document.getElementById('results-points-total');
    const pointsBreakdownEl = document.getElementById('results-points-breakdown');
    const tbody = document.getElementById('results-table-body');

    if (headlineEl && playerFinish) {
      // "P4 · Coastal Highway Circuit", with the position in the accent colour
      const position = document.createElement('b');
      position.textContent = `P${playerFinish.finishPosition}`;
      headlineEl.replaceChildren(position, ` · ${trackName}`);
    }
    if (pointsTotalEl && playerFinish) {
      pointsTotalEl.textContent = notCounted ? 'Not counted' : `+${playerFinish.totalPoints} pts`;
    }
    if (pointsBreakdownEl && playerFinish) {
      pointsBreakdownEl.textContent = notCounted ? notCounted.note : pointsBreakdown(playerFinish);
    }

    // All 20 cars; the table scrolls to your row once the screen is showing
    const playerRow = tbody ? renderResultRows(tbody, finishes, this.playerName()) : null;

    const next = onlyHandler('btn-next-race', () => {
      this.hide();
      onNextRace();
    });
    if (next) next.textContent = notCounted ? notCounted.nextLabel : 'Next race';
    onlyHandler('btn-view-standings-from-results', () => {
      this.hide();
      onViewStandings();
    });

    this.open();
    playerRow?.scrollIntoView({ block: 'nearest' });
  }

  /** The XP line under the points (R9); null hides it */
  public setXp(text: string | null): void {
    const el = document.getElementById('results-xp');
    if (!el) return;
    el.hidden = text === null;
    el.textContent = text ?? '';
  }
}

/** The championship table */
export class StandingsModal extends RaceModal {
  constructor(private readonly playerName: () => string) {
    super('modal-standings');
  }

  /** `completedRounds` is how many rounds of the season have been raced so far. */
  public show(standings: DriverStanding[], completedRounds: number, totalRaces: number, onClose: () => void): void {
    const progressEl = document.getElementById('standings-season-progress');
    if (progressEl) progressEl.textContent = standingsProgressLabel(completedRounds, totalRaces);

    const tbody = document.getElementById('standings-table-body');
    const playerRow = tbody ? renderStandingRows(tbody, standings, this.playerName()) : null;

    const handleClose = (): void => {
      this.hide();
      onClose();
    };
    onlyHandler('btn-close-standings', handleClose);
    onlyHandler('btn-continue-from-standings', handleClose);

    this.open();
    playerRow?.scrollIntoView({ block: 'nearest' });
  }
}

/** The season's end: your trophy, and a new season */
export class PodiumModal extends RaceModal {
  constructor() {
    super('modal-podium');
  }

  public show(trophy: ChampionshipTrophy, onNewSeason: () => void, totalRaces = 8): void {
    const iconEl = document.getElementById('podium-trophy-icon');
    const bannerEl = document.getElementById('podium-banner-text');
    const subEl = document.getElementById('podium-sub-text');

    // A gold, silver or bronze block with your championship place (Broadcast style, no emoji)
    const ending =
      trophy === 'gold'
        ? { mark: 'P1', banner: 'World champion', sub: 'You won the championship.' }
        : trophy === 'silver'
        ? { mark: 'P2', banner: 'Runner-up', sub: 'Second in the championship.' }
        : trophy === 'bronze'
        ? { mark: 'P3', banner: 'On the podium', sub: 'Third in the championship.' }
        : { mark: '—', banner: 'Season complete', sub: `All ${totalRaces} rounds raced. Go again for the title?` };
    if (iconEl) {
      iconEl.textContent = ending.mark;
      iconEl.dataset.trophy = trophy;
    }
    if (bannerEl) bannerEl.textContent = ending.banner;
    if (subEl) subEl.textContent = ending.sub;

    onlyHandler('btn-start-new-season', () => {
      this.hide();
      onNewSeason();
    });
    this.open();
  }
}

/**
 * The race pop-ups (P09-R11: they were part of HUDController): qualifying choice, results,
 * standings and the season's podium. Your name in the tables is set once, from the Garage.
 */
export class RaceModals {
  private playerName = 'You';
  readonly qualifying = new QualifyingModal();
  readonly results = new ResultsModal(() => this.playerName);
  readonly standings = new StandingsModal(() => this.playerName);
  readonly podium = new PodiumModal();

  /** Your name in the results and standings tables (Garage, R9) */
  public setPlayerName(name: string): void {
    this.playerName = name;
  }

  /** Any pop-up is showing: Esc leaves the race alone while one is up */
  public get isAnyOpen(): boolean {
    return this.qualifying.isOpen || this.results.isOpen || this.standings.isOpen || this.podium.isOpen;
  }
}
