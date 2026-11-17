/**
 * Career XP and levels (R9 part 1, Decision 14). XP comes from how you race: where you
 * finish, places gained, fastest laps, clean races, and beating your Time Trial best. Levels
 * unlock things in later parts (harder AI, championships, liveries, the licence); they
 * never change how the car or the driver performs (Decision 12).
 * Saved on this device only (localStorage).
 */

/** What a race was, for XP: practice earns none, a Quick Race half */
type RaceKind = 'championship' | 'quick';

interface RaceXpInput {
  kind: RaceKind;
  /** For your best finish on each track (Records, R9 part 2) */
  trackId?: string;
  finishPosition: number; // 1 to 20
  gridPosition: number; // 1 to 20
  hasFastestLap: boolean;
  isCleanDriver: boolean;
}

interface XpPart {
  label: string;
  xp: number;
}

interface CareerStats {
  races: number;
  wins: number;
  podiums: number;
  fastestLaps: number;
  cleanRaces: number;
  placesGained: number;
  ghostBeats: number;
  /** Championships finished, and the trophies won: P1 gold, P2 silver, P3 bronze */
  seasons: number;
  goldTrophies: number;
  silverTrophies: number;
  bronzeTrophies: number;
}

interface CareerData extends CareerStats {
  xp: number;
}

/** A season's trophy, as SeasonManager awards it */
type SeasonTrophy = 'none' | 'gold' | 'silver' | 'bronze';

interface XpAward {
  gained: number;
  parts: XpPart[];
  levelBefore: number;
  levelAfter: number;
}

const STORAGE_KEY = 'apex_career_v1';

/** XP for finishing: P1 100, P2 95 ... P20 5 */
const XP_PER_PLACE = 5;
const WIN_BONUS = 50;
const PLACE_GAINED_XP = 5;
const FASTEST_LAP_XP = 25;
const CLEAN_RACE_XP = 20;
/** Beating your stored best lap in a Time Trial */
export const GHOST_BEAT_XP = 30;
/** A Quick Race earns this share of a championship race's XP */
const QUICK_RACE_SHARE = 0.5;

/** Levels need a little more XP each time: 150 to reach level 2, 300 more for 3, ... */
const LEVEL_STEP_XP = 150;
export const MAX_LEVEL = 30;

/** Total XP needed to reach `level` (level 1 needs none) */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level))) - 1;
  return (LEVEL_STEP_XP * n * (n + 1)) / 2;
}

/** The level you are at with `xp` in total */
export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Share of the way from your level to the next, 0 to 1 (1 at the top level) */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const from = xpForLevel(level);
  return (xp - from) / (xpForLevel(level + 1) - from);
}

/** The XP a race earns, part by part */
export function raceXp(input: RaceXpInput): XpPart[] {
  const parts: XpPart[] = [];
  const position = Math.max(1, Math.min(20, Math.round(input.finishPosition)));
  parts.push({ label: `P${position}`, xp: (21 - position) * XP_PER_PLACE });
  if (position === 1) parts.push({ label: 'Win', xp: WIN_BONUS });
  const gained = Math.max(0, Math.round(input.gridPosition) - position);
  if (gained > 0) parts.push({ label: `${gained} places gained`, xp: gained * PLACE_GAINED_XP });
  if (input.hasFastestLap) parts.push({ label: 'Fastest lap', xp: FASTEST_LAP_XP });
  if (input.isCleanDriver) parts.push({ label: 'Clean race', xp: CLEAN_RACE_XP });
  if (input.kind === 'quick') {
    return parts.map((part) => ({ label: part.label, xp: Math.round(part.xp * QUICK_RACE_SHARE) }));
  }
  return parts;
}

/** One line for the results screen: "+185 XP · Level 3 · 40% to level 4", or a level-up */
export function xpSummary(award: XpAward, xpNow: number): string {
  const head = `+${award.gained} XP`;
  if (award.levelAfter > award.levelBefore) return `${head} · Level up! Level ${award.levelAfter}`;
  if (award.levelAfter >= MAX_LEVEL) return `${head} · Level ${award.levelAfter}`;
  const percent = Math.floor(levelProgress(xpNow) * 100);
  return `${head} · Level ${award.levelAfter} · ${percent}% to level ${award.levelAfter + 1}`;
}

function emptyCareer(): CareerData {
  return {
    xp: 0,
    races: 0,
    wins: 0,
    podiums: 0,
    fastestLaps: 0,
    cleanRaces: 0,
    placesGained: 0,
    ghostBeats: 0,
    seasons: 0,
    goldTrophies: 0,
    silverTrophies: 0,
    bronzeTrophies: 0
  };
}

/** A whole number of at least 0, or 0 */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Best finish per track id, keeping only whole positions 1 to 20 */
function trackBests(value: unknown): Record<string, number> {
  const bests: Record<string, number> = {};
  if (!value || typeof value !== 'object') return bests;
  for (const [trackId, position] of Object.entries(value as Record<string, unknown>)) {
    if (typeof position === 'number' && Number.isInteger(position) && position >= 1 && position <= 20) {
      bests[trackId] = position;
    }
  }
  return bests;
}

export class CareerManager {
  private data: CareerData;
  /** Your best finish on each track, in races that count (Records) */
  private bests: Record<string, number> = {};

  constructor(private readonly storage: Storage | null = typeof window !== 'undefined' ? window.localStorage : null) {
    this.data = this.load();
  }

  /** Your best finish on a track, or null if you have not raced there */
  public bestFinish(trackId: string): number | null {
    return this.bests[trackId] ?? null;
  }

  public get xp(): number {
    return this.data.xp;
  }

  public get level(): number {
    return levelForXp(this.data.xp);
  }

  public get stats(): Readonly<CareerStats> {
    return this.data;
  }

  /** Adds a finished race to the career and returns the XP it earned */
  public awardRace(input: RaceXpInput): XpAward {
    const parts = raceXp(input);
    this.data.races++;
    if (input.finishPosition === 1) this.data.wins++;
    if (input.finishPosition <= 3) this.data.podiums++;
    if (input.hasFastestLap) this.data.fastestLaps++;
    if (input.isCleanDriver) this.data.cleanRaces++;
    this.data.placesGained += Math.max(0, input.gridPosition - input.finishPosition);
    if (input.trackId) {
      const before = this.bests[input.trackId];
      if (before === undefined || input.finishPosition < before) this.bests[input.trackId] = input.finishPosition;
    }
    return this.add(parts);
  }

  /** A finished championship goes in the trophy cabinet */
  public recordSeason(trophy: SeasonTrophy): void {
    this.data.seasons++;
    if (trophy === 'gold') this.data.goldTrophies++;
    else if (trophy === 'silver') this.data.silverTrophies++;
    else if (trophy === 'bronze') this.data.bronzeTrophies++;
    this.save();
  }

  /** Beating your stored best lap in a Time Trial */
  public awardGhostBeat(): XpAward {
    this.data.ghostBeats++;
    return this.add([{ label: 'Beat your ghost', xp: GHOST_BEAT_XP }]);
  }

  private add(parts: XpPart[]): XpAward {
    const levelBefore = this.level;
    const gained = parts.reduce((sum, part) => sum + part.xp, 0);
    this.data.xp += gained;
    this.save();
    return { gained, parts, levelBefore, levelAfter: this.level };
  }

  private load(): CareerData {
    const career = emptyCareer();
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return career;
      const parsed = JSON.parse(raw) as Partial<Record<keyof CareerData, unknown>>;
      for (const key of Object.keys(career) as (keyof CareerData)[]) career[key] = count(parsed[key]);
      this.bests = trackBests((parsed as { trackBests?: unknown }).trackBests);
    } catch (e) {
      console.warn('CareerManager: saved career unreadable, starting a new one', e);
    }
    return career;
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify({ ...this.data, trackBests: this.bests }));
    } catch (e) {
      console.warn('CareerManager: could not save the career', e);
    }
  }
}
