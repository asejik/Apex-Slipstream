import { AI_DRIVER_ROSTER } from '../ai/AIDriverProfiles';
import { ChampionshipEngine, DriverStanding } from './ChampionshipEngine';

/**
 * Rivals (R9 part 5). Your rival is the driver just ahead of you in the championship, or
 * the driver in P2 while you lead: the one to beat next. The AI do not drive any
 * differently for it (no rubber-banding); the rivalry is in the head-to-head record and
 * the XP for beating them.
 */

/** Head-to-head against one driver: races you finished ahead, and races they did */
export interface HeadToHead {
  won: number;
  lost: number;
}

/** The AI driver id of your rival in these standings, or null if there is none */
export function pickRival(standings: DriverStanding[]): string | null {
  const sorted = ChampionshipEngine.sortStandings(standings);
  const index = sorted.findIndex((s) => s.isPlayer);
  if (index < 0) return null;
  const rival = index > 0 ? sorted[index - 1] : sorted[1];
  return rival && !rival.isPlayer ? rival.driverId : null;
}

/** An AI driver's surname in capitals, as the timing tower shows it */
export function rivalShortName(driverId: string): string {
  const driver = AI_DRIVER_ROSTER.find((d) => d.id === driverId);
  if (!driver) return '—';
  const parts = driver.name.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? driver.name).toUpperCase();
}

/** "VANCE · 3–1" (your wins first), or just "VANCE" before you have raced them as a rival */
export function rivalLabel(driverId: string, record: HeadToHead): string {
  const name = rivalShortName(driverId);
  return record.won + record.lost === 0 ? name : `${name} · ${record.won}–${record.lost}`;
}

/** The results line: "Rival: you beat VANCE (4–1)" or "Rival: VANCE beat you (3–2)" */
export function rivalResultLine(driverId: string, beat: boolean, record: HeadToHead): string {
  const name = rivalShortName(driverId);
  const score = `${record.won}–${record.lost}`;
  return beat ? `Rival: you beat ${name} (${score})` : `Rival: ${name} beat you (${score})`;
}
