import { CHAMPIONSHIPS } from '../engine/Championships';
import type { GameSettings } from './Settings';

type Difficulty = GameSettings['difficulty'];

/**
 * Career levels unlock harder AI tiers and new championships (R9, Decision 14). Levels
 * never change the car or the driver (Decision 12).
 */
export const DIFFICULTY_UNLOCK_LEVEL: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  medium: 1,
  hard: 1,
  pro: 4,
  legend: 7
};

const DIFFICULTY_NAMES: Readonly<Record<Difficulty, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  pro: 'Pro',
  legend: 'Legend'
};

export function isDifficultyUnlocked(difficulty: Difficulty, level: number): boolean {
  return level >= DIFFICULTY_UNLOCK_LEVEL[difficulty];
}

/** The difficulty to race at: the chosen one, or Hard if your level has not unlocked it */
export function effectiveDifficulty(difficulty: Difficulty, level: number): Difficulty {
  return isDifficultyUnlocked(difficulty, level) ? difficulty : 'hard';
}

/** What reaching levels above `fromLevel` up to `toLevel` unlocks, e.g. ["Highway Cup"] */
export function unlocksBetween(fromLevel: number, toLevel: number): string[] {
  const reached = (level: number): boolean => level > fromLevel && level <= toLevel;
  const championships = CHAMPIONSHIPS.filter((c) => reached(c.unlockLevel)).map((c) => c.name);
  const tiers = (Object.keys(DIFFICULTY_UNLOCK_LEVEL) as Difficulty[])
    .filter((d) => reached(DIFFICULTY_UNLOCK_LEVEL[d]))
    .map((d) => `${DIFFICULTY_NAMES[d]} AI`);
  return [...championships, ...tiers];
}
