/** A frame longer than this is a hitch (three frames at 60 fps) */
export const HITCH_MS = 50;
/** Recent long tasks and hitches remembered, to match against each other */
const MEMORY = 32;

/**
 * Counts the rare long frames (EF-R02) and tells what caused each, on the device itself,
 * with no developer tools. Chrome reports every JavaScript task over 50 ms ("long tasks",
 * garbage collection included). A hitch that overlaps one came from the game's own work; one
 * that doesn't came from the GPU or the phone's system. Shown with Settings → Show FPS.
 *
 * Long tasks are reported a moment after they end, so a match is made from either side:
 * when a hitch is counted, and when a task arrives. Each hitch is counted once.
 */
export class HitchMonitor {
  /** Frames over HITCH_MS since the game started */
  hitches = 0;
  /** Of those, the ones that overlapped a long JavaScript task */
  fromScript = 0;
  /** The longest frame seen, in ms */
  worstMs = 0;
  /** Whether this browser reports long tasks (Chrome, including on Android) */
  readonly canAttribute: boolean;
  // Rings of recent long tasks and hitches: start and end times (performance.now() ms)
  private readonly taskStart = new Float64Array(MEMORY);
  private readonly taskEnd = new Float64Array(MEMORY);
  private nextTask = 0;
  private readonly hitchStart = new Float64Array(MEMORY);
  private readonly hitchEnd = new Float64Array(MEMORY);
  private readonly hitchMatched = new Uint8Array(MEMORY);
  private nextHitch = 0;

  constructor(observe = true) {
    let observing = false;
    try {
      if (observe && typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) this.recordTask(entry.startTime, entry.startTime + entry.duration);
        }).observe({ type: 'longtask', buffered: true });
        observing = true;
      }
    } catch {
      observing = false;
    }
    this.canAttribute = observing;
  }

  /** A long JavaScript task (from the observer, or a test) */
  recordTask(start: number, end: number): void {
    this.taskStart[this.nextTask] = start;
    this.taskEnd[this.nextTask] = end;
    this.nextTask = (this.nextTask + 1) % MEMORY;
    // A hitch already counted may be this task's
    for (let i = 0; i < MEMORY; i++) {
      if (this.hitchMatched[i] === 0 && this.hitchEnd[i]! > start && this.hitchStart[i]! < end) {
        this.hitchMatched[i] = 1;
        this.fromScript++;
      }
    }
  }

  /** One drawn frame that took `frameMs` and ended at `now`. Allocates nothing. */
  frame(frameMs: number, now: number): void {
    if (frameMs <= HITCH_MS) return;
    this.hitches++;
    if (frameMs > this.worstMs) this.worstMs = frameMs;
    const slot = this.nextHitch;
    this.nextHitch = (slot + 1) % MEMORY;
    const from = now - frameMs;
    this.hitchStart[slot] = from;
    this.hitchEnd[slot] = now;
    this.hitchMatched[slot] = 0;
    for (let i = 0; i < MEMORY; i++) {
      if (this.taskEnd[i]! > from && this.taskStart[i]! < now) {
        this.hitchMatched[slot] = 1;
        this.fromScript++;
        return;
      }
    }
  }

  /** For the FPS readout, e.g. "Hitches 2 · worst 283 ms · 1 from scripts" */
  summary(): string {
    if (this.hitches === 0) return 'Hitches 0';
    const cause = this.canAttribute ? ` · ${this.fromScript} from scripts` : '';
    return `Hitches ${this.hitches} · worst ${Math.round(this.worstMs)} ms${cause}`;
  }
}
