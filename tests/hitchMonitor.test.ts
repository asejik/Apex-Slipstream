import { describe, it, expect } from 'vitest';
import { HITCH_MS, HitchMonitor } from '../src/app/HitchMonitor';

describe('Hitch monitor (EF-R02)', () => {
  it('counts only frames over the hitch limit, and keeps the worst', () => {
    const monitor = new HitchMonitor(false);
    monitor.frame(16.7, 1000);
    monitor.frame(HITCH_MS, 1100);
    expect(monitor.hitches).toBe(0);
    monitor.frame(120, 2000);
    monitor.frame(283, 3000);
    expect(monitor.hitches).toBe(2);
    expect(monitor.worstMs).toBe(283);
    expect(monitor.summary()).toBe('Hitches 2 · worst 283 ms');
  });

  it('blames a long script task that overlapped the hitch, whichever is reported first', () => {
    const monitor = new HitchMonitor(false);
    // The task is known before the hitch
    monitor.recordTask(900, 980);
    monitor.frame(100, 1000);
    // The hitch is counted before its task is reported (Chrome reports tasks a moment later)
    monitor.frame(150, 2000);
    expect(monitor.fromScript).toBe(1);
    monitor.recordTask(1880, 1990);
    expect(monitor.fromScript).toBe(2);
    // A hitch with no task near it: the GPU or the system
    monitor.frame(90, 5000);
    // A task elsewhere, and the same task again, change nothing
    monitor.recordTask(7000, 7100);
    monitor.recordTask(1880, 1990);
    expect(monitor.hitches).toBe(3);
    expect(monitor.fromScript).toBe(2);
  });
});
