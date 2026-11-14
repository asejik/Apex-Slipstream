import { describe, it, expect } from 'vitest';
import {
  ChampionshipEngine,
  FASTEST_LAP_BONUS,
  CLEAN_DRIVER_BONUS,
  RawRaceParticipant,
  DriverStanding
} from '../src/engine/ChampionshipEngine';

describe('ChampionshipEngine Scoring & Points System', () => {
  it('correctly maps 1st to 15th finishing points', () => {
    expect(ChampionshipEngine.getBasePoints(1)).toBe(25);
    expect(ChampionshipEngine.getBasePoints(2)).toBe(20);
    expect(ChampionshipEngine.getBasePoints(3)).toBe(16);
    expect(ChampionshipEngine.getBasePoints(4)).toBe(13);
    expect(ChampionshipEngine.getBasePoints(5)).toBe(11);
    expect(ChampionshipEngine.getBasePoints(6)).toBe(10);
    expect(ChampionshipEngine.getBasePoints(7)).toBe(9);
    expect(ChampionshipEngine.getBasePoints(8)).toBe(8);
    expect(ChampionshipEngine.getBasePoints(9)).toBe(7);
    expect(ChampionshipEngine.getBasePoints(10)).toBe(6);
    expect(ChampionshipEngine.getBasePoints(11)).toBe(5);
    expect(ChampionshipEngine.getBasePoints(12)).toBe(4);
    expect(ChampionshipEngine.getBasePoints(13)).toBe(3);
    expect(ChampionshipEngine.getBasePoints(14)).toBe(2);
    expect(ChampionshipEngine.getBasePoints(15)).toBe(1);
    expect(ChampionshipEngine.getBasePoints(16)).toBe(0);
    expect(ChampionshipEngine.getBasePoints(20)).toBe(0);
  });

  it('evaluates race finishes and awards fastest lap and clean driver bonuses', () => {
    const participants: RawRaceParticipant[] = [
      {
        id: 'player',
        name: 'Player',
        team: 'Apex GP',
        isPlayer: true,
        progress: 3.5,
        raceTimeMs: 120500,
        fastestLapMs: 38200, // Fastest overall!
        severeCrashes: 0 // Clean driver!
      },
      {
        id: 'ai_01_vance',
        name: 'Marcus Vance',
        team: 'Apex Velocity',
        isPlayer: false,
        progress: 3.2,
        raceTimeMs: 121800,
        fastestLapMs: 38900,
        severeCrashes: 1
      },
      {
        id: 'ai_02_rostova',
        name: 'Elena Rostova',
        team: 'Nordic Sprint',
        isPlayer: false,
        progress: 3.0,
        raceTimeMs: 123400,
        fastestLapMs: 39100,
        severeCrashes: 0
      }
    ];

    const finishes = ChampionshipEngine.computeRaceFinishes(participants);

    expect(finishes.length).toBe(3);
    const playerFinish = finishes[0];
    expect(playerFinish?.isPlayer).toBe(true);
    expect(playerFinish?.finishPosition).toBe(1);
    expect(playerFinish?.hasFastestLap).toBe(true);
    expect(playerFinish?.isCleanDriver).toBe(true);
    // 25 base + 1 fastest lap + 2 clean driver = 28 points
    expect(playerFinish?.totalPoints).toBe(25 + FASTEST_LAP_BONUS + CLEAN_DRIVER_BONUS);

    const secondFinish = finishes[1];
    expect(secondFinish?.finishPosition).toBe(2);
    expect(secondFinish?.basePoints).toBe(20);
    expect(secondFinish?.hasFastestLap).toBe(false);
    expect(secondFinish?.totalPoints).toBe(20);
  });

  it('does not award clean driver bonus if player suffered a severe crash', () => {
    const participants: RawRaceParticipant[] = [
      {
        id: 'player',
        name: 'Player',
        team: 'Apex GP',
        isPlayer: true,
        progress: 3.5,
        raceTimeMs: 120000,
        fastestLapMs: 40000,
        severeCrashes: 2 // Suffered crashes
      }
    ];

    const finishes = ChampionshipEngine.computeRaceFinishes(participants);
    expect(finishes[0]?.isCleanDriver).toBe(false);
    expect(finishes[0]?.bonusPoints).toBe(FASTEST_LAP_BONUS); // only fastest lap (sole participant)
  });

  it('updates standings and sorts by points and tiebreakers', () => {
    const currentStandings: DriverStanding[] = [
      {
        driverId: 'player',
        driverName: 'Player',
        team: 'Apex GP',
        isPlayer: true,
        points: 25,
        wins: 1,
        podiums: 1,
        bestFinish: 1,
        history: [25]
      },
      {
        driverId: 'ai_01_vance',
        driverName: 'Marcus Vance',
        team: 'Apex Velocity',
        isPlayer: false,
        points: 25,
        wins: 0,
        podiums: 1,
        bestFinish: 2,
        history: [25]
      }
    ];

    const sorted = ChampionshipEngine.sortStandings(currentStandings);
    // Player has 1 win vs Marcus Vance 0 wins -> Player is ranked #1
    expect(sorted[0]?.driverId).toBe('player');
  });
});
