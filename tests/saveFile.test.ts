import { describe, it, expect } from 'vitest';
import { buildSaveFile, readSaveFile, saveFileName, SAVE_KEYS } from '../src/app/SaveFile';
import type { GhostRecord } from '../src/storage/GhostStorage';

/** A Storage stand-in with some of the game's keys and one that isn't the game's */
function storage(entries: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (key: string) => entries[key] ?? null };
}

function ghost(trackId: string, samples: number[]): GhostRecord {
  return {
    key: `${trackId}_pb`, trackId, type: 'pb', lapTimeMs: 75_500, recordedAt: 1, sampleCount: samples.length / 4,
    sampleRateHz: 30, frameData: new Float32Array(samples).buffer
  };
}

describe('Save file (P07-R02)', () => {
  it('round-trips every game key and ghost lap, and nothing else', () => {
    const local = { apex_career_v1: '{"xp":420}', apex_season_v1: '{"currentRaceIndex":3}', other_site_key: 'x' };
    const laps = [ghost('track_01_coastal', [1.5, -2.25, 3, 0.125, 4, 5, 6, 7])];
    const file = buildSaveFile(storage(local), laps, new Date('2026-11-18T10:00:00Z'));

    const read = readSaveFile(JSON.stringify(file));
    if ('error' in read) throw new Error(read.error);
    expect(read.local).toEqual({ apex_career_v1: '{"xp":420}', apex_season_v1: '{"currentRaceIndex":3}' });
    expect(read.ghosts).toHaveLength(1);
    expect(Array.from(new Float32Array(read.ghosts[0]!.frameData))).toEqual([1.5, -2.25, 3, 0.125, 4, 5, 6, 7]);
    expect(read.ghosts[0]!.lapTimeMs).toBe(75_500);
  });

  it('lists every key the game writes', () => {
    // The six kinds of save, and all four championships' seasons
    expect(SAVE_KEYS).toContain('apex_career_v1');
    expect(SAVE_KEYS).toContain('apex_settings_v1');
    expect(SAVE_KEYS.filter((key) => key.startsWith('apex_season_'))).toHaveLength(4);
  });

  it('refuses anything that is not a whole, valid save, restoring nothing', () => {
    const good = buildSaveFile(storage({ apex_career_v1: '{}' }), []);
    expect(readSaveFile('not json')).toHaveProperty('error');
    expect(readSaveFile(JSON.stringify({ hello: 1 }))).toHaveProperty('error');
    expect(readSaveFile(JSON.stringify({ ...good, version: 99 }))).toHaveProperty('error');
    // A key the game doesn't write
    expect(readSaveFile(JSON.stringify({ ...good, local: { evil_key: 'x' } }))).toHaveProperty('error');
    // A value that isn't text
    expect(readSaveFile(JSON.stringify({ ...good, local: { apex_career_v1: 5 } }))).toHaveProperty('error');
    // A ghost whose key doesn't match its track
    const bad = { ...good, ghosts: [{ ...buildSaveFile(storage({}), [ghost('t', [0, 0, 0, 0])]).ghosts[0], key: 'other_pb' }] };
    expect(readSaveFile(JSON.stringify(bad))).toHaveProperty('error');
  });

  it('names the file by date', () => {
    expect(saveFileName(new Date('2026-11-18T23:00:00Z'))).toBe('apex-slipstream-save-2026-11-18.json');
  });
});
