import { describe, it, expect } from 'vitest';
import { AudioEngine } from '../src/audio/AudioEngine';

describe('AudioEngine Synthesizer', () => {
  it('instantiates safely without throwing in headless environments', () => {
    const audio = new AudioEngine();
    expect(audio.isUnlocked()).toBe(false);
    expect(audio.isMuted()).toBe(false);
  });

  it('update does not throw when audio is not unlocked', () => {
    const audio = new AudioEngine();
    expect(() => {
      audio.update({
        speedKmh: 120,
        rpmRatio: 0.7,
        throttle: 1.0,
        driftIntensity: 0.2,
        isDrafting: false,
        isDraftBoostActive: false,
        isOnCurb: false,
        isOnGravel: false,
      });
    }).not.toThrow();
  });

  it('handles mute and unmute toggling', () => {
    const audio = new AudioEngine();
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.setMuted(false);
    expect(audio.isMuted()).toBe(false);
  });

  it('unlock falls back gracefully if AudioContext is not defined in jsdom', () => {
    const audio = new AudioEngine();
    const unlocked = audio.unlock();
    // In node/vitest environment without Web Audio API, returns false safely
    expect(typeof unlocked).toBe('boolean');
  });
});
