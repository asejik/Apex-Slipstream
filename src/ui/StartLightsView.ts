/**
 * Draws the start lights (#start-lights in index.html). Touches the page only when the
 * number of lit lights or the visibility changes, not every frame.
 */
export class StartLightsView {
  private readonly root: HTMLElement | null;
  private readonly lights: HTMLElement[];
  private shownLit = -1;
  private shownVisible: boolean | null = null;

  constructor() {
    this.root = document.getElementById('start-lights');
    this.lights = this.root ? Array.from(this.root.querySelectorAll<HTMLElement>('.start-light')) : [];
  }

  public update(litCount: number, visible: boolean): void {
    if (visible !== this.shownVisible) {
      this.shownVisible = visible;
      this.root?.classList.toggle('active', visible);
    }
    if (litCount !== this.shownLit) {
      this.shownLit = litCount;
      for (let i = 0; i < this.lights.length; i++) {
        this.lights[i]?.classList.toggle('on', i < litCount);
      }
    }
  }
}
