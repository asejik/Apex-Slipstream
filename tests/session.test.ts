import { describe, it, expect } from 'vitest';
import {
  RACE,
  Session,
  canChangeTyresMidSession,
  canQualify,
  countsForSeason,
  hudSessionNote,
  isSolo,
  pauseSessionLabel,
  restartIsFree,
  sessionAfterLoad,
  soloKind
} from '../src/app/Session';

const QUALIFYING: Session = { kind: 'qualifying' };
const PRACTICE: Session = { kind: 'practice' };
const QUICK: Session = { kind: 'quick', setup: { trackIndex: 2, weather: 'wet', laps: 4 } };
const TIME_TRIAL: Session = { kind: 'timeTrial', setup: { trackIndex: 1, tyre: 'street' } };
const ALL = [RACE, QUALIFYING, PRACTICE, QUICK, TIME_TRIAL];

/** Each rule as a table of the five sessions, in ALL's order */
const table = (rule: (s: Session) => unknown): unknown[] => ALL.map(rule);

describe('One session value (P09-R02 step 1)', () => {
  it('a race or practice is decided by the track loaded; other sessions keep themselves', () => {
    expect(sessionAfterLoad(RACE, true)).toEqual(PRACTICE);
    expect(sessionAfterLoad(RACE, false)).toEqual(RACE);
    expect(sessionAfterLoad(PRACTICE, false)).toEqual(RACE);
    for (const s of [QUALIFYING, QUICK, TIME_TRIAL]) expect(sessionAfterLoad(s, true)).toBe(s);
  });

  it('only a championship race counts for the season', () => {
    expect(table(countsForSeason)).toEqual([true, false, false, false, false]);
  });

  it('qualifying and Time Trial run alone', () => {
    expect(table(isSolo)).toEqual([false, true, false, false, true]);
    expect(table(soloKind)).toEqual([null, 'qualifying', null, null, 'time_trial']);
  });

  it('a restart costs a token only in a championship race (qualifying included, as before)', () => {
    expect(table(restartIsFree)).toEqual([false, false, true, true, true]);
  });

  it('qualifying is offered in a weekend or practice, never in a Quick Race or Time Trial', () => {
    expect(table(canQualify)).toEqual([true, true, true, false, false]);
  });

  it('tyres change mid-session only in practice and Time Trial', () => {
    expect(table(canChangeTyresMidSession)).toEqual([false, false, true, false, true]);
  });

  it('labels the pause menu and the HUD as the game always has', () => {
    expect(ALL.map((s) => pauseSessionLabel(s, 4, 3))).toEqual([
      'Lap 3/3',
      'Qualifying',
      'Practice',
      'Quick race · Lap 3/3',
      'Time trial · Lap 4'
    ]);
    expect(table(hudSessionNote)).toEqual([
      null,
      null,
      "Practice · results don't count",
      "Quick race · results don't count",
      'Time trial · beat your ghost'
    ]);
  });
});
