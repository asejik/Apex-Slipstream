import { describe, it, expect, afterEach } from 'vitest';
import { AudioEngine } from '../src/audio/AudioEngine';
import { AIDriverManager } from '../src/ai/AIDriverManager';
import { livePosition } from '../src/engine/RaceResults';
import { playerLapFraction, RaceProgress } from '../src/engine/RaceOrder';

/** A minimal stand-in for the Web Audio API that records what the engine asks for. */
class FakeParam {
  public value = 0;
  public targets: number[] = [];
  setValueAtTime(v: number): void { this.value = v; this.targets.push(v); }
  setTargetAtTime(v: number): void { this.value = v; this.targets.push(v); }
  linearRampToValueAtTime(v: number): void { this.value = v; this.targets.push(v); }
}
class FakeNode {
  public gain = new FakeParam();
  public frequency = new FakeParam();
  public Q = new FakeParam();
  public type = '';
  public buffer: unknown = null;
  public loop = false;
  public started = false;
  public connectedTo: unknown = null;
  connect(target: unknown): void { this.connectedTo = target; }
  start(): void { this.started = true; }
  stop(): void {}
}
class FakeAudioContext {
  public static last: FakeAudioContext | null = null;
  public state = 'running';
  public currentTime = 0;
  public sampleRate = 8000;
  public destination = { isDestination: true };
  public gains: FakeNode[] = [];
  public oscillators: FakeNode[] = [];
  constructor() { FakeAudioContext.last = this; }
  createGain(): FakeNode { const n = new FakeNode(); this.gains.push(n); return n; }
  createOscillator(): FakeNode { const n = new FakeNode(); this.oscillators.push(n); return n; }
  createBiquadFilter(): FakeNode { return new FakeNode(); }
  createBufferSource(): FakeNode { return new FakeNode(); }
  createBuffer(_c: number, length: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume(): Promise<void> { return Promise.resolve(); }
  close(): Promise<void> { return Promise.resolve(); }
}

function unlockedEngine(): { audio: AudioEngine; ctx: FakeAudioContext; master: FakeNode } {
  (globalThis as { window?: unknown }).window = { AudioContext: FakeAudioContext };
  const audio = new AudioEngine();
  expect(audio.unlock()).toBe(true);
  const ctx = FakeAudioContext.last!;
  // The master bus is the gain node wired to the speakers
  const master = ctx.gains.find((g) => g.connectedTo === ctx.destination)!;
  return { audio, ctx, master };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  FakeAudioContext.last = null;
});

describe('Silent hub (owner playtest 2026-11-16)', () => {
  it('starts silent, plays only while a race is running, and goes quiet again after', () => {
    const { audio, master } = unlockedEngine();
    expect(master.gain.value).toBe(0); // on the hub when audio first starts

    audio.setActive(true);
    expect(master.gain.value).toBe(0.75);
    audio.setActive(false); // back on the hub, or paused
    expect(master.gain.value).toBe(0);
  });

  it('stays silent in a race when sound is off', () => {
    const { audio, master } = unlockedEngine();
    audio.setMuted(true);
    audio.setActive(true);
    expect(master.gain.value).toBe(0);
  });
});

describe('Start light beeps (owner playtest 2026-11-16)', () => {
  it('plays a tone of the asked pitch straight to the speakers', () => {
    const { audio, ctx } = unlockedEngine();
    const before = ctx.oscillators.length;
    audio.beep(440, 0.15);
    expect(ctx.oscillators.length).toBe(before + 1);
    const tone = ctx.oscillators[ctx.oscillators.length - 1]!;
    expect(tone.frequency.value).toBe(440);
    expect(tone.started).toBe(true);
    // Heard even though the car mix is silent before the lights go out
    const gain = tone.connectedTo as FakeNode;
    expect(gain.connectedTo).toBe(ctx.destination);
    expect(Math.max(...gain.gain.targets)).toBeGreaterThan(0.05);
  });

  it('makes no tone when sound is off or audio has not started', () => {
    const { audio, ctx } = unlockedEngine();
    audio.setMuted(true);
    const before = ctx.oscillators.length;
    audio.beep(880, 0.6);
    expect(ctx.oscillators.length).toBe(before);

    delete (globalThis as { window?: unknown }).window;
    expect(() => new AudioEngine().beep(440, 0.15)).not.toThrow();
  });
});

describe('Live position at the line and after the flag (U-15, owner playtest 2026-11-16)', () => {
  it('keeps the lap fraction in step with the lap counter around the start line', () => {
    // Mid-lap: unchanged
    expect(playerLapFraction(0.4, 0.33, false)).toBe(0.4);
    // A metre before the line, but the closest-point search already says "start of the lap"
    expect(playerLapFraction(0.0003, 0.92, false)).toBe(1);
    // Just over the line: the lap counter has moved on, the search still says "end of the lap"
    expect(playerLapFraction(0.9997, 0, false)).toBe(0);
    // On the grid behind the line
    expect(playerLapFraction(0.97, 0, true)).toBe(0.97);
    expect(playerLapFraction(0.0003, 0, true)).toBe(1);
  });

  it('classifies the player first after winning, while the others are still lapping', () => {
    const manager = new AIDriverManager();
    const totalLaps = 3;
    // Every AI car is on its last lap, none has finished
    manager.cars.forEach((car, i) => {
      car.lap = 3;
      car.splineT = 0.5 + i * 0.01;
      car.finishTime = null;
    });
    const scratch: RaceProgress = { completedLaps: 0, lapFraction: 0, finishTime: null };

    // What the game used to pass after the flag: lap counter stuck on the last lap, fraction 0
    const stuck: RaceProgress = { completedLaps: totalLaps - 1, lapFraction: 0, finishTime: null };
    expect(livePosition(stuck, manager.cars, totalLaps, scratch)).toBe(20);

    // With the finish time recorded, the winner is P1
    const finished: RaceProgress = { completedLaps: totalLaps - 1, lapFraction: 0, finishTime: 250 };
    expect(livePosition(finished, manager.cars, totalLaps, scratch)).toBe(1);
  });
});
