/**
 * The lights-out start (U-06, docs/DESIGN.md section 7): five red lights come on one a
 * second, hold for a short random time, then all go out together and the race starts.
 * While they run, every car is held on the grid. Advanced in fixed physics steps.
 */
export class StartLights {
  public static readonly LIGHT_COUNT = 5;
  public static readonly SECONDS_PER_LIGHT = 1.0;
  /** Random hold after the fifth light, in seconds, so the start can't be timed by rhythm */
  public static readonly MIN_HOLD = 0.2;
  public static readonly MAX_HOLD = 1.2;
  /** How long the dark lights stay on screen after they go out */
  public static readonly SHOW_AFTER_OUT = 1.0;

  private elapsed = 0;
  private outAt = 0;
  private running = false;
  private sinceOut = Infinity;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  /** Starts a new sequence: the first light comes on now. */
  public reset(): void {
    this.elapsed = 0;
    this.running = true;
    this.sinceOut = Infinity;
    const hold = StartLights.MIN_HOLD + (StartLights.MAX_HOLD - StartLights.MIN_HOLD) * this.random();
    this.outAt = StartLights.LIGHT_COUNT * StartLights.SECONDS_PER_LIGHT + hold;
  }

  /** No lights: the session starts at once (solo qualifying runs). */
  public skip(): void {
    this.running = false;
    this.sinceOut = Infinity;
  }

  public step(dt: number): void {
    if (this.running) {
      this.elapsed += dt;
      if (this.elapsed >= this.outAt) {
        this.running = false;
        this.sinceOut = 0;
      }
    } else if (this.sinceOut !== Infinity) {
      this.sinceOut += dt;
    }
  }

  /** True while the cars must stay on the grid. */
  public get isHolding(): boolean {
    return this.running;
  }

  /** How many lights are on (0 to 5). All five go out together at the start. */
  public get litCount(): number {
    if (!this.running) return 0;
    return Math.min(StartLights.LIGHT_COUNT, Math.floor(this.elapsed / StartLights.SECONDS_PER_LIGHT) + 1);
  }

  /** True while the lights panel should be on screen. */
  public get isVisible(): boolean {
    return this.running || this.sinceOut < StartLights.SHOW_AFTER_OUT;
  }
}
