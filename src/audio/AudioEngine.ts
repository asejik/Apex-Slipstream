/**
 * AudioEngine.ts
 * Procedural Web Audio API sound synthesizer for Apex Slipstream.
 *
 * Implements 100% asset-free synthesis:
 * - Engine RPM dual oscillator with dynamic harmonics and low-pass filter.
 * - Tire screech generated from filtered white noise loop modulated by drift velocity.
 * - Aerodynamic wind and slipstream resonant whoosh.
 * - Curb and gravel low-frequency rumble.
 *
 * Adheres strictly to browser autoplay policies (unlocked via pointer gesture).
 */

export interface AudioTelemetry {
  speedKmh: number;
  rpmRatio: number; // 0.0 to 1.0 (idle to redline)
  throttle: number; // 0.0 to 1.0
  driftIntensity: number; // 0.0 to 1.0 (lateral slip)
  isDrafting: boolean;
  isDraftBoostActive: boolean;
  isOnCurb: boolean;
  isOnGravel: boolean;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isAudioUnlocked = false;
  private muted = false;
  /** Master volume when not muted (0.75 is the mix the engine sounds were tuned at) */
  private volume = 0.75;

  // Master output
  private masterGain: GainNode | null = null;

  // Engine nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Screech nodes
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;

  // Wind & Slipstream nodes
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private slipstreamGain: GainNode | null = null;

  // Rumble nodes (curbs & gravel)
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;

  // Shared noise buffer
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // AudioContext is lazy-created or activated on user pointer gesture
  }

  /**
   * Initializes and resumes the AudioContext upon user gesture.
   */
  public unlock(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    if (this.isAudioUnlocked && this.ctx && this.ctx.state === 'running') {
      return true;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        return false;
      }

      if (!this.ctx) {
        this.ctx = new AudioCtxClass();
        this.setupGraph();
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      this.isAudioUnlocked = true;
      return true;
    } catch (e) {
      console.warn('AudioEngine: failed to initialize AudioContext', e);
      return false;
    }
  }

  public isUnlocked(): boolean {
    return this.isAudioUnlocked;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
  }

  /** Master volume, 0 to 1 (Settings: low 0.4, medium 0.75, high 1.0) */
  public setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyMasterGain();
  }

  private applyMasterGain(): void {
    if (this.masterGain && this.ctx) {
      const targetGain = this.muted ? 0.0 : this.volume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.unlock();
    this.setMuted(!this.muted);
    return this.muted;
  }

  private setupGraph(): void {
    if (!this.ctx) return;

    // Master bus
    this.masterGain = this.ctx.createGain();
    // Honour a mute or volume chosen before the first tap unlocked audio
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Create 2-second looped white noise buffer
    this.noiseBuffer = this.createNoiseBuffer(2.0);

    // --- 1. Engine Sound Synthesizer ---
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(65, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.setValueAtTime(32.5, this.ctx.currentTime); // 1 octave below

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // --- 2. Tire Screech Synthesizer ---
    const screechNoise = this.ctx.createBufferSource();
    screechNoise.buffer = this.noiseBuffer;
    screechNoise.loop = true;

    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.setValueAtTime(1600, this.ctx.currentTime);
    this.screechFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    screechNoise.connect(this.screechFilter);
    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.masterGain);
    screechNoise.start();

    // --- 3. Wind & Aerodynamic Slipstream Synthesizer ---
    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = this.noiseBuffer;
    windNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(600, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    windNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windNoise.start();

    // Slipstream resonance whoosh
    const slipNoise = this.ctx.createBufferSource();
    slipNoise.buffer = this.noiseBuffer;
    slipNoise.loop = true;

    const slipFilter = this.ctx.createBiquadFilter();
    slipFilter.type = 'bandpass';
    slipFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    slipFilter.Q.setValueAtTime(6.0, this.ctx.currentTime);

    this.slipstreamGain = this.ctx.createGain();
    this.slipstreamGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    slipNoise.connect(slipFilter);
    slipFilter.connect(this.slipstreamGain);
    this.slipstreamGain.connect(this.masterGain);
    slipNoise.start();

    // --- 4. Curb & Gravel Rumble Synthesizer ---
    this.rumbleOsc = this.ctx.createOscillator();
    this.rumbleOsc.type = 'sine';
    this.rumbleOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.rumbleOsc.connect(this.rumbleGain);
    this.rumbleGain.connect(this.masterGain);
    this.rumbleOsc.start();
  }

  private createNoiseBuffer(durationSeconds: number): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext missing');
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate * durationSeconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // White noise between -1.0 and 1.0
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Updates sound parameters per frame based on vehicle telemetry.
   * Safe to call every frame (zero allocations).
   */
  public update(telemetry: AudioTelemetry): void {
    if (!this.ctx || !this.isAudioUnlocked || this.ctx.state !== 'running' || this.muted) {
      return;
    }

    const t = this.ctx.currentTime;
    const smooth = 0.04;

    // --- 1. Engine Pitch & Harmonics ---
    // Idle 50Hz up to 340Hz redline
    const baseFreq = 50 + telemetry.rpmRatio * 290;
    if (this.engineOsc1) {
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, smooth);
    }
    if (this.engineOsc2) {
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, t, smooth);
    }

    // Engine filter opens up with throttle
    if (this.engineFilter) {
      const filterCutoff = 350 + telemetry.throttle * 700 + telemetry.rpmRatio * 1200;
      this.engineFilter.frequency.setTargetAtTime(filterCutoff, t, smooth);
    }

    if (this.engineGain) {
      const engineVol = 0.15 + telemetry.throttle * 0.15 + telemetry.rpmRatio * 0.1;
      this.engineGain.gain.setTargetAtTime(engineVol, t, smooth);
    }

    // --- 2. Tire Screech ---
    if (this.screechGain) {
      const screechTarget = telemetry.driftIntensity > 0.15 ? Math.min(0.4, (telemetry.driftIntensity - 0.15) * 0.8) : 0.0;
      this.screechGain.gain.setTargetAtTime(screechTarget, t, 0.03);
    }
    if (this.screechFilter) {
      const centerFreq = 1400 + telemetry.driftIntensity * 600;
      this.screechFilter.frequency.setTargetAtTime(centerFreq, t, 0.05);
    }

    // --- 3. Wind & Aerodynamics ---
    const speedRatio = Math.min(1.0, telemetry.speedKmh / 200.0);
    if (this.windGain && this.windFilter) {
      const windVol = speedRatio > 0.3 ? (speedRatio - 0.3) * 0.35 : 0.0;
      this.windGain.gain.setTargetAtTime(windVol, t, smooth);
      this.windFilter.frequency.setTargetAtTime(400 + speedRatio * 1800, t, smooth);
    }

    // Slipstream whoosh
    if (this.slipstreamGain) {
      let slipTarget = 0.0;
      if (telemetry.isDraftBoostActive) {
        slipTarget = 0.45;
      } else if (telemetry.isDrafting) {
        slipTarget = 0.22;
      }
      this.slipstreamGain.gain.setTargetAtTime(slipTarget, t, 0.05);
    }

    // --- 4. Curb & Gravel Rumble ---
    if (this.rumbleGain && this.rumbleOsc) {
      let rumbleTarget = 0.0;
      let rumbleFreq = 50;

      if (telemetry.isOnGravel && telemetry.speedKmh > 10) {
        rumbleTarget = 0.32;
        rumbleFreq = 42 + Math.random() * 15;
      } else if (telemetry.isOnCurb && telemetry.speedKmh > 20) {
        rumbleTarget = 0.25;
        rumbleFreq = 70 + (telemetry.speedKmh / 180) * 40;
      }
      this.rumbleGain.gain.setTargetAtTime(rumbleTarget, t, 0.03);
      this.rumbleOsc.frequency.setTargetAtTime(rumbleFreq, t, 0.03);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
