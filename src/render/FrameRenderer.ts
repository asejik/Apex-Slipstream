import * as THREE from 'three';
import { InputState } from '../engine/InputManager';
import { SurfaceEvaluation } from '../track/TrackSpline';
import { RaceWorld } from '../engine/RaceWorld';
import { CameraController, SLIPSTREAM_FOV_BOOST, SLIPSTREAM_FOV_WAKE } from '../engine/CameraController';
import { PlayerCarVisual } from './PlayerCarVisual';
import { followWithSun } from './SceneSetup';
import { WindStreamlines } from '../effects/WindStreamlines';
import { WeatherEffects } from '../effects/WeatherEffects';
import { AudioEngine } from '../audio/AudioEngine';
import { HUDController } from '../ui/HUDController';
import { TimingTower } from '../engine/TimingTower';
import { TimingTowerView } from '../ui/TimingTowerView';
import { StartLights } from '../engine/StartLights';
import { StartLightsView } from '../ui/StartLightsView';
import { MiniMap } from '../ui/MiniMap';
import { GhostPlayback } from '../replay/GhostPlayback';
import { Session, hudSessionNote, soloKind } from '../app/Session';
import { RacingLineView } from './RacingLineView';
import type { TrackProfile } from '../ai/AIRacecraft';

/** What the game owns that a frame draws, sounds or shows */
export interface FrameParts {
  readonly world: RaceWorld;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraController: CameraController;
  readonly playerCar: PlayerCarVisual;
  readonly windStreamlines: WindStreamlines;
  readonly weatherEffects: WeatherEffects;
  readonly audioEngine: AudioEngine;
  readonly hudController: HUDController;
  readonly towerView: TimingTowerView;
  readonly miniMap: MiniMap;
  readonly startLights: StartLights;
  /** Your best lap's ghost */
  readonly ghostPlayback: GhostPlayback;
  /** Time Trial's second ghost: your previous lap */
  readonly lastLapGhost: GhostPlayback;
}

/**
 * The game's state for this frame, beyond the race world. One object, refilled by the game
 * every frame (no allocations in the frame loop).
 */
export interface FrameState {
  /** The race is moving: not the hub, not paused, not held by the start lights */
  running: boolean;
  /** How far between the last physics step and the next the frame falls (0 to 1) */
  stepAlpha: number;
  session: Session;
  /** Alone on track: no AI drawn, no timing tower rows */
  solo: boolean;
  reduceMotion: boolean;
  ghostVisible: boolean;
  /** The mini map is shown only on the race screen */
  onRaceScreen: boolean;
  /** A session is on track: the race screen, the grid or paused (not the hub) */
  onTrack: boolean;
  /** The round on track: after a race the season has already moved on to the next one */
  round: number;
  totalRaces: number;
}

/**
 * Everything drawn or heard in one frame (P09-R02 step 3): the camera, the cars between
 * physics steps, the ghosts, effects, engine sound, the HUD, the timing tower, the mini map
 * and the FPS readout. Changes no race state.
 */
export class FrameRenderer {
  /** Race HUD timing tower (R5): cars around the player, refreshed TOWER_REFRESH_SECONDS apart */
  private readonly timingTower = new TimingTower();
  private towerTimer = 0;
  private static readonly TOWER_REFRESH_SECONDS = 0.25;
  private readonly startLightsView = new StartLightsView();
  private readonly fpsElement = document.getElementById('fps-counter');
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private readonly scratchTangent = new THREE.Vector3();
  /** The racing-line guide (driving aids) and the line profile it was built from */
  private readonly racingLine = new RacingLineView();
  private racingLineBuiltFrom: TrackProfile | null = null;

  constructor(private readonly parts: FrameParts) {
    parts.scene.add(this.racingLine.mesh);
  }

  /** The timing tower refreshes on the next frame (a new grid has lined up) */
  refreshTowerNextFrame(): void {
    this.towerTimer = FrameRenderer.TOWER_REFRESH_SECONDS;
  }

  /** Shows or hides the FPS readout (Settings) */
  setFpsVisible(visible: boolean): void {
    if (this.fpsElement) this.fpsElement.hidden = !visible;
  }

  draw(input: InputState, currentSurface: SurfaceEvaluation, frameDelta: number, frame: FrameState): void {
    const { world, camera, scene, cameraController, hudController, audioEngine } = this.parts;
    const slipstream = world.latestSlipstream;
    // The view widens in the slipstream, unless motion is reduced (R9). The camera applies it
    // over its own mode's width (R10-06: setting the FOV here was undone by its update)
    cameraController.setFovBoost(
      frame.reduceMotion
        ? 0
        : slipstream.isBoostActive
        ? SLIPSTREAM_FOV_BOOST
        : slipstream.inWake
        ? SLIPSTREAM_FOV_WAKE
        : 0
    );

    // Draw the cars between physics steps so motion is smooth at any refresh rate (U-03).
    // When the race is not running (hub, paused) they are drawn where they stand.
    const running = frame.running;
    const motionDelta = running ? frameDelta : 0;
    const renderPose = world.playerRenderPose;
    renderPose.sample(world.vehiclePhysics.state.position, world.vehiclePhysics.state.heading, frame.stepAlpha);
    if (!frame.solo) {
      world.aiDriverManager.render(frame.stepAlpha);
    }

    cameraController.update(camera, renderPose, frameDelta);

    this.drawRacingLine(frame, currentSurface.trackT);

    // Ghost hologram and the time gap to it
    const ghostDeltaSeconds = this.updateGhost(currentSurface);
    hudController.updateGhostTelemetry(this.parts.ghostPlayback.hasGhost, frame.ghostVisible, ghostDeltaSeconds);

    // Player car model
    const state = world.vehiclePhysics.state;
    const trackTangent = world.trackSpline.getTangentAt(currentSurface.trackT, this.scratchTangent);
    const slopePitch = Math.atan2(trackTangent.y, Math.hypot(trackTangent.x, trackTangent.z));
    this.parts.playerCar.update(renderPose.position, renderPose.heading, state, slopePitch, motionDelta);
    followWithSun(scene, renderPose.position);

    // Aerodynamic wind streamlines
    this.parts.windStreamlines.update(
      renderPose.position,
      renderPose.heading,
      state.speedKmh,
      slipstream.inWake,
      slipstream.isBoostActive,
      motionDelta
    );

    // Rain round the camera and spray behind every car on track (R7 part 2)
    this.parts.weatherEffects.update(
      camera,
      window.innerHeight,
      state,
      world.aiDriverManager.group.visible ? world.aiDriverManager.cars : null,
      frameDelta,
      motionDelta
    );

    // Procedural Web Audio engine; the engine idles when the race is not running
    audioEngine.update({
      speedKmh: running ? state.speedKmh : 0,
      rpmRatio: running ? state.rpm : 0,
      throttle: running ? input.throttle : 0,
      driftIntensity: running ? state.driftFactor : 0,
      isDrafting: running && slipstream.inWake,
      isDraftBoostActive: running && slipstream.isBoostActive,
      isOnCurb: running && currentSurface.surface === 'curb',
      isOnGravel: running && (currentSurface.surface === 'gravel' || currentSurface.surface === 'dirt')
    });

    // Timing tower, a few times a second; solo qualifying has no field to show
    this.towerTimer += frameDelta;
    if (this.towerTimer >= FrameRenderer.TOWER_REFRESH_SECONDS) {
      this.towerTimer = 0;
      // Qualifying keeps the tower up with its "Qualifying" header, so the session is clear
      if (frame.solo) {
        this.parts.towerView.clearRows();
      } else {
        this.timingTower.update(
          world.playerProgress,
          state.speedKmh,
          world.aiDriverManager.cars,
          world.trackSpline.totalLength
        );
        this.parts.towerView.update(this.timingTower);
      }
    }

    // HUD telemetry
    hudController.update(
      state,
      cameraController.currentMode,
      world.lapManager.state,
      currentSurface,
      world.trackSpline.data.name,
      slipstream,
      world.activeTire,
      audioEngine.isMuted(),
      world.playerRank,
      frame.round,
      frame.totalRaces,
      soloKind(frame.session),
      hudSessionNote(frame.session)
    );

    const startLights = this.parts.startLights;
    this.startLightsView.update(startLights.litCount, startLights.isVisible);
    if (frame.onRaceScreen) {
      this.parts.miniMap.update(renderPose.position, frame.solo ? null : world.aiDriverManager.cars);
    }
    this.updateFpsCounter(frameDelta);

    this.parts.renderer.render(scene, camera);
  }

  /** The racing-line guide, when it is on and a session is on track (Decision 16) */
  private drawRacingLine(frame: FrameState, trackT: number): void {
    const world = this.parts.world;
    const aids = world.aids;
    const show = aids.choices.racingLine && frame.onTrack;
    this.racingLine.setVisible(show);
    if (!show) return;
    aids.prepare(world.trackSpline, world.raceWeather, world.activeTire);
    const profile = aids.trackProfile;
    if (!profile) return;
    if (profile !== this.racingLineBuiltFrom) {
      this.racingLine.build(world.trackSpline, profile);
      this.racingLineBuiltFrom = profile;
    }
    const state = world.vehiclePhysics.state;
    this.racingLine.update(trackT * profile.length, Math.max(0, state.forwardSpeed), aids);
  }

  /**
   * Moves the ghost hologram to its place at the current lap time. Returns the gap to it
   * in seconds (negative = ahead of the ghost), or null when no ghost is shown.
   */
  private updateGhost(currentSurface: SurfaceEvaluation): number | null {
    const { world, ghostPlayback, lastLapGhost } = this.parts;
    lastLapGhost.update(world.lapManager.state.currentLapTime);
    const ghostSample = ghostPlayback.update(world.lapManager.state.currentLapTime);
    if (!ghostPlayback.hasGhost || !ghostPlayback.visible || !ghostSample) {
      return null;
    }

    const playerPos = world.vehiclePhysics.state.position;
    const ghostPos = ghostSample.position;
    const dx = playerPos.x - ghostPos.x;
    const dz = playerPos.z - ghostPos.z;
    const dist = Math.hypot(dx, dz);
    const speedMs = Math.max(10.0, (world.vehiclePhysics.state.speedKmh * 1000) / 3600);
    const timeOffset = dist / speedMs;

    // Compare progress along spline
    const playerT = currentSurface.trackT;
    const ghostSurface = world.trackSpline.evaluateSurface(ghostPos);
    let tDiff = playerT - ghostSurface.trackT;
    if (tDiff > 0.5) tDiff -= 1.0;
    if (tDiff < -0.5) tDiff += 1.0;

    return tDiff >= 0 ? -timeOffset : timeOffset;
  }

  /** FPS and pacing readout, refreshed twice a second. */
  private updateFpsCounter(frameDelta: number): void {
    this.frameCount++;
    this.fpsTimer += frameDelta;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.currentFps} | Physics: 60Hz Fixed | Compound: ${this.parts.world.activeTire.toUpperCase()}`;
      }
    }
  }
}
