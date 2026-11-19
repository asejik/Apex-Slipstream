import type { QuickRaceSetup } from './QuickRace';
import type { TimeTrialSetup } from './TimeTrial';

/**
 * What is on track right now (P09-R02 step 1). One value instead of four flags
 * (`quickRace`, `timeTrial`, `isQualifying`, `loadedAsPractice`) that every start, restart,
 * quit and track change had to keep in step by hand; two of them disagreeing caused P09-R01.
 *
 * - race: a championship weekend's race on the season's round
 * - qualifying: a solo qualifying run before it
 * - practice: the track button has loaded another track; results never count
 * - quick: a Quick Race; results never count for the season
 * - timeTrial: alone against your ghosts
 */
export type Session =
  | { kind: 'race' }
  | { kind: 'qualifying' }
  | { kind: 'practice' }
  | { kind: 'quick'; setup: QuickRaceSetup }
  | { kind: 'timeTrial'; setup: TimeTrialSetup };

export const RACE: Session = { kind: 'race' };

/**
 * After a track loads: a race or practice session becomes practice when the track isn't the
 * season's round, and a race otherwise. Decided at load, so recording a result (which moves
 * the season on) never turns the race just finished into practice. Others are unchanged.
 */
export function sessionAfterLoad(session: Session, isPracticeTrack: boolean): Session {
  if (session.kind !== 'race' && session.kind !== 'practice') return session;
  return isPracticeTrack ? { kind: 'practice' } : RACE;
}

/** A race that counts for the championship: not qualifying, practice, Quick Race or Time Trial */
export function countsForSeason(session: Session): boolean {
  return session.kind === 'race';
}

/** Alone on track, with no AI: qualifying or a time trial */
export function isSolo(session: Session): boolean {
  return session.kind === 'qualifying' || session.kind === 'timeTrial';
}

/** A restart costs a season token only in a championship race */
export function restartIsFree(session: Session): boolean {
  return session.kind === 'quick' || session.kind === 'timeTrial' || session.kind === 'practice';
}

/** Qualifying is part of a championship weekend, practice included (P09-R01) */
export function canQualify(session: Session): boolean {
  return session.kind !== 'quick' && session.kind !== 'timeTrial';
}

/** Tyres can be changed mid-session (then the run restarts) in practice and Time Trial */
export function canChangeTyresMidSession(session: Session): boolean {
  return session.kind === 'practice' || session.kind === 'timeTrial';
}

/** The pause menu's session line, for example "Quick race · Lap 2/3" */
export function pauseSessionLabel(session: Session, currentLap: number, totalLaps: number): string {
  switch (session.kind) {
    case 'qualifying':
      return 'Qualifying';
    case 'practice':
      return 'Practice';
    case 'timeTrial':
      return `Time trial · Lap ${currentLap}`;
    case 'quick':
      return `Quick race · Lap ${Math.min(currentLap, totalLaps)}/${totalLaps}`;
    case 'race':
      return `Lap ${Math.min(currentLap, totalLaps)}/${totalLaps}`;
  }
}

/** The line under the lap counter instead of the championship round; null shows the round */
export function hudSessionNote(session: Session): string | null {
  switch (session.kind) {
    case 'timeTrial':
      return 'Time trial · beat your ghost';
    case 'quick':
      return "Quick race · results don't count";
    case 'practice':
      return "Practice · results don't count";
    default:
      return null;
  }
}

/** Which solo session the HUD is showing, if any */
export function soloKind(session: Session): 'qualifying' | 'time_trial' | null {
  return session.kind === 'qualifying' ? 'qualifying' : session.kind === 'timeTrial' ? 'time_trial' : null;
}
