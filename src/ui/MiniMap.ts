import * as THREE from 'three';
import type { TrackSpline } from '../track/TrackSpline';
import type { AICarState } from '../ai/AIDriverManager';
import { teamColourFor } from './HubScreen';

/** Where a world position lands on the map, and how the track fits it. */
interface MapFit {
  scale: number; // map pixels per metre
  offsetX: number;
  offsetY: number;
}

/**
 * Fits a track's bounding box into a `width` x `height` map with `padding` pixels all round,
 * keeping its shape. North (-Z) is up, east (+X) is right.
 */
export function fitTrack(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  width: number,
  height: number,
  padding: number
): MapFit {
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanZ);
  return {
    scale,
    offsetX: (width - spanX * scale) / 2 - minX * scale,
    offsetY: (height - spanZ * scale) / 2 - minZ * scale
  };
}

const OUTLINE_POINTS = 240;

/**
 * The route map on the race HUD (owner playtest 2026-11-16): the track outline with a dot
 * for every car. The outline is drawn once per track onto its own canvas; each refresh
 * copies it and adds the dots, so nothing is allocated while racing.
 * Markup: #mini-map (a canvas) in index.html.
 */
export class MiniMap {
  private readonly canvas: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly outline: HTMLCanvasElement | null;
  private fit: MapFit = { scale: 1, offsetX: 0, offsetY: 0 };
  private spline: TrackSpline | null = null;
  /** The canvas's CSS width when the outline was last drawn; 0 while hidden */
  private shownWidth = 0;
  private width = 0;
  private height = 0;
  private readonly colours: {
    track: string;
    trackEdge: string;
    player: string;
    playerRing: string;
    start: string;
    teams: string[];
  };

  constructor() {
    this.canvas = document.getElementById('mini-map') as HTMLCanvasElement | null;
    this.context = this.canvas?.getContext('2d') ?? null;
    this.outline = this.canvas ? document.createElement('canvas') : null;

    // Canvas drawing can't use CSS variables directly: read the design tokens once
    const style = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string): string => style.getPropertyValue(name).trim() || fallback;
    const teams: string[] = [''];
    for (let i = 1; i <= 10; i++) teams.push(token(`--color-team-${i}`, '#9aa3b5'));
    this.colours = {
      track: token('--color-text-primary', '#ffffff'),
      trackEdge: token('--color-bg-base', '#121319'),
      player: token('--color-accent', '#ff3347'),
      playerRing: token('--color-text-primary', '#ffffff'),
      start: token('--color-accent', '#ff3347'),
      teams
    };
  }

  /** Draws the outline of a new track. Call when a track loads. */
  public setTrack(spline: TrackSpline): void {
    this.spline = spline;
    if (!this.canvas || !this.outline) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    // A track loads while the HUD is hidden (the hub is showing), when the canvas has no
    // size yet: draw at the phone size for now; update() redraws once it is on screen
    this.shownWidth = this.canvas.clientWidth;
    const cssWidth = this.shownWidth || 120;
    const cssHeight = this.canvas.clientHeight || 100;
    this.width = Math.round(cssWidth * ratio);
    this.height = Math.round(cssHeight * ratio);
    for (const c of [this.canvas, this.outline]) {
      c.width = this.width;
      c.height = this.height;
    }

    const points: THREE.Vector3[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const last = spline.data.isClosed ? OUTLINE_POINTS : OUTLINE_POINTS - 1;
    for (let i = 0; i < OUTLINE_POINTS; i++) {
      const p = spline.getPointAt(i / last > 1 ? 1 : i / last);
      points.push(p);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const padding = 8 * ratio;
    this.fit = fitTrack(minX, maxX, minZ, maxZ, this.width, this.height, padding);

    const ctx = this.outline.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const trace = (): void => {
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = p.x * this.fit.scale + this.fit.offsetX;
        const y = p.z * this.fit.scale + this.fit.offsetY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (spline.data.isClosed) ctx.closePath();
    };
    // A dark casing under a light line, so the route reads over any scenery
    trace();
    ctx.strokeStyle = this.colours.trackEdge;
    ctx.lineWidth = 6 * ratio;
    ctx.stroke();
    trace();
    ctx.strokeStyle = this.colours.track;
    ctx.lineWidth = 2.5 * ratio;
    ctx.stroke();

    // Start/finish mark
    const start = points[0]!;
    ctx.fillStyle = this.colours.start;
    ctx.fillRect(
      start.x * this.fit.scale + this.fit.offsetX - 3 * ratio,
      start.z * this.fit.scale + this.fit.offsetY - 3 * ratio,
      6 * ratio,
      6 * ratio
    );
  }

  /** Redraws the cars. `aiCars` is null in solo qualifying. */
  public update(player: THREE.Vector3, aiCars: readonly AICarState[] | null): void {
    const ctx = this.context;
    if (!ctx || !this.outline || !this.canvas) return;
    // Sized differently from when the outline was drawn (first shown, or the window resized)
    const shown = this.canvas.clientWidth;
    if (shown > 0 && shown !== this.shownWidth && this.spline) this.setTrack(this.spline);
    const ratio = this.width / Math.max(1, shown || this.width);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.outline, 0, 0);

    if (aiCars) {
      for (let i = 0; i < aiCars.length; i++) {
        const car = aiCars[i]!;
        if (car.isParked) continue;
        ctx.fillStyle = this.colours.teams[teamColourFor(car.profile.id)] ?? this.colours.track;
        ctx.beginPath();
        ctx.arc(
          car.position.x * this.fit.scale + this.fit.offsetX,
          car.position.z * this.fit.scale + this.fit.offsetY,
          2.2 * ratio,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // The player on top: a larger red dot with a white ring
    const x = player.x * this.fit.scale + this.fit.offsetX;
    const y = player.z * this.fit.scale + this.fit.offsetY;
    ctx.beginPath();
    ctx.arc(x, y, 4.5 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = this.colours.playerRing;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 3 * ratio, 0, Math.PI * 2);
    ctx.fillStyle = this.colours.player;
    ctx.fill();
  }
}
