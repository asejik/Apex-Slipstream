import * as THREE from 'three';
import { GameSettings, loadSettings, motionReduced, saveSettings, VOLUME_LEVELS } from './Settings';
import { KeyBindings, loadKeyBindings, saveKeyBindings } from './KeyBindings';
import { effectiveDifficulty } from './Unlocks';
import { DIFFICULTY_LIMIT } from '../ai/AIRacecraft';
import { SettingsScreen } from '../ui/SettingsScreen';
import { KeyBindingsPanel } from '../ui/KeyBindingsPanel';
import { SaveBackupPanel } from '../ui/SaveBackupPanel';
import { CameraController } from '../engine/CameraController';
import { InputManager } from '../engine/InputManager';
import { CareerManager } from '../engine/CareerManager';
import { RaceWorld } from '../engine/RaceWorld';
import { AudioEngine } from '../audio/AudioEngine';
import { HUDController } from '../ui/HUDController';
import { WeatherEffects } from '../effects/WeatherEffects';
import { PlayerCarVisual } from '../render/PlayerCarVisual';
import { FrameRenderer } from '../render/FrameRenderer';
import { GhostLaps } from '../replay/GhostLaps';
import { GhostStorage } from '../storage/GhostStorage';

/** What the settings change */
export interface SettingsParts {
  readonly world: RaceWorld;
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraController: CameraController;
  readonly inputManager: InputManager;
  readonly career: CareerManager;
  readonly audioEngine: AudioEngine;
  readonly hudController: HUDController;
  readonly weatherEffects: WeatherEffects;
  readonly playerCar: PlayerCarVisual;
  readonly frameRenderer: FrameRenderer;
  readonly ghosts: GhostLaps;
  /** For Settings → Your save (P07-R02) */
  readonly ghostStorage: GhostStorage;
}

/**
 * Your settings and driving keys (P09-R02 step 6), saved on this device (R5, R9): the
 * Settings screen, putting every setting into effect, and keeping the camera, ghost and sound
 * toggled in a race as settings too.
 */
export class SettingsControl {
  private readonly settings: GameSettings = loadSettings();
  private keyBindings: KeyBindings = loadKeyBindings();
  private readonly keyBindingsPanel = new KeyBindingsPanel((bindings) => this.changeKeys(bindings));
  readonly screen: SettingsScreen;
  /** Calmer camera and screens (Settings, R9 accessibility) */
  reduceMotion = false;
  private readonly deviceReducedMotion =
    typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null : null;
  private appliedGraphics: GameSettings['graphics'] | null = null;

  constructor(private readonly parts: SettingsParts) {
    // Settings → Your save: download or load the whole save (P07-R02)
    const saveBackup = new SaveBackupPanel(parts.ghostStorage);
    this.screen = new SettingsScreen(
      (key, value) => this.change(key, value),
      () => saveBackup.reset()
    );
  }

  /** Saved settings and keys apply from the first frame */
  start(): void {
    this.apply();
    // Auto reduce-motion follows the device setting if it changes while playing
    this.deviceReducedMotion?.addEventListener?.('change', () => this.apply());
    // Your driving keys (R9)
    this.parts.inputManager.setBindings(this.keyBindings);
    this.keyBindingsPanel.show(this.keyBindings);
  }

  /** Opens the Settings screen */
  open(): void {
    this.screen.open(this.settings, this.parts.career.level);
  }

  private change<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.settings[key] = value;
    saveSettings(this.settings);
    this.apply();
    this.screen.show(this.settings);
  }

  /** Puts every setting into effect. Cheap enough to run on each change. */
  private apply(): void {
    const s = this.settings;
    const { cameraController, audioEngine, hudController, playerCar } = this.parts;
    cameraController.setMode(s.camera);
    this.parts.ghosts.setVisible(s.ghost);
    audioEngine.setMuted(!s.sound);
    audioEngine.setVolume(VOLUME_LEVELS[s.volume]);
    hudController.setUnits(s.units);
    this.parts.world.aiDriverManager.setDifficultyLimit(this.aiDifficultyLimit);
    this.applyGraphics(s.graphics);
    this.reduceMotion = motionReduced(s.reduceMotion, this.deviceReducedMotion?.matches ?? false);
    document.documentElement.classList.toggle('reduce-motion', this.reduceMotion);
    playerCar.setLean(!this.reduceMotion);
    this.parts.frameRenderer.setFpsVisible(s.showFps);
  }

  /** The AI's share of the car's limit: your difficulty, if your level has unlocked it (R9) */
  get aiDifficultyLimit(): number {
    return DIFFICULTY_LIMIT[effectiveDifficulty(this.settings.difficulty, this.parts.career.level)];
  }

  /** High: shadows and up to 2x pixel density. Low: no shadows, 1x, for slower phones. */
  private applyGraphics(level: GameSettings['graphics']): void {
    if (level === this.appliedGraphics) return;
    this.appliedGraphics = level;
    const high = level === 'high';
    const renderer = this.parts.renderer;
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = high;
    this.parts.weatherEffects.setQuality(high);
    // Materials compile their shadow code once; they must rebuild after the switch
    this.parts.scene.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (Array.isArray(material)) material.forEach((m) => (m.needsUpdate = true));
      else if (material) material.needsUpdate = true;
    });
  }

  /** Camera, ghost and sound changed in the pause menu or by key are kept as settings too. */
  rememberQuickToggles(): void {
    this.settings.camera = this.parts.cameraController.currentMode;
    this.settings.ghost = this.parts.ghosts.visible;
    this.settings.sound = !this.parts.audioEngine.isMuted();
    saveSettings(this.settings);
    if (this.screen.isOpen) this.screen.show(this.settings);
  }

  /** New driving keys from Settings: saved and used at once */
  private changeKeys(bindings: KeyBindings): void {
    this.keyBindings = bindings;
    saveKeyBindings(bindings);
    this.parts.inputManager.setBindings(bindings);
    this.keyBindingsPanel.show(bindings);
  }
}
