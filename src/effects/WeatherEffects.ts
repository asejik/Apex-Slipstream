import * as THREE from 'three';
import { SCENE_COLOURS } from '../render/SceneSetup';
import type { WeatherCondition } from '../tires/TireTypes';

/** A car that throws up spray: the player's car or an AI car. */
export interface SprayEmitter {
  position: THREE.Vector3;
  heading: number;
  speedKmh: number;
}

/** The scene in each weather (docs/DESIGN.md section 10) */
const LOOK = {
  dry: { fog: 0.0022, sunIntensity: 1.3, ambientIntensity: 0.75 },
  wet: { fog: 0.006, sunIntensity: 0.55, ambientIntensity: 0.85 }
} as const;

/** Rain streaks around the camera: High and Low graphics */
const RAIN_STREAKS = { high: 1400, low: 500 } as const;
/** Spray particles shared by every car: High and Low graphics */
const SPRAY_PARTICLES = { high: 900, low: 300 } as const;

/** The box of falling rain kept round the camera, metres (half widths) */
const RAIN_HALF_X = 35;
const RAIN_HALF_Y = 18;
const RAIN_HALF_Z = 35;
const RAIN_FALL_MS = 22;
/** A slight sideways wind, so the rain falls at an angle */
const RAIN_WIND_X = 3;
/** Each streak is the distance a drop falls in this long (motion blur) */
const STREAK_SECONDS = 0.035;

/** Cars spray only above this speed, and only near the camera */
const SPRAY_MIN_KMH = 40;
const SPRAY_RANGE_M = 140;
/** Particles per second from each car at top speed (180 km/h) */
const SPRAY_RATE_AT_TOP = 90;
const SPRAY_LIFE_S = 0.75;
/** A particle's size (m) when thrown and when it has faded */
const SPRAY_SIZE_START = 0.7;
const SPRAY_SIZE_END = 3.2;
const SPRAY_OPACITY = 0.32;

const SPRAY_VERTEX = /* glsl */ `
  attribute float alpha;
  attribute float size;
  varying float vAlpha;
  uniform float pixelsPerMetre;
  #include <fog_pars_vertex>
  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * pixelsPerMetre / max(0.1, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const SPRAY_FRAGMENT = /* glsl */ `
  uniform vec3 colour;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    // A soft round puff
    vec2 d = gl_PointCoord - 0.5;
    float fade = smoothstep(0.5, 0.0, length(d));
    gl_FragColor = vec4(colour, vAlpha * fade);
    #include <fog_fragment>
  }
`;

/**
 * How rain looks (R7 part 2): streaks of rain round the camera, spray thrown up behind
 * cars, a greyer sky with shorter visibility, and a dark, glossy road. Nothing shows in the
 * dry. Every buffer is made once; the per-frame update allocates nothing.
 */
export class WeatherEffects {
  public readonly group = new THREE.Group();
  private weather: WeatherCondition = 'dry';
  private isHighQuality = true;

  private readonly rain: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  /** Where each drop is, relative to the rain box (x, y, z per drop) */
  private readonly drops: Float32Array;

  private readonly spray: THREE.Points;
  private readonly sprayPositions: Float32Array;
  private readonly sprayAlpha: Float32Array;
  private readonly spraySize: Float32Array;
  private readonly sprayVelocity: Float32Array;
  private readonly sprayAge: Float32Array;
  private readonly sprayUniforms: { colour: { value: THREE.Color }; pixelsPerMetre: { value: number } };
  private nextParticle = 0;
  /** Fractional particles still owed to each emitter, so slow cars still spray */
  private readonly owed = new Float32Array(32);

  constructor() {
    this.group.name = 'weather-effects';

    // Rain: one line per drop, from its head to where it was a moment ago
    const maxDrops = RAIN_STREAKS.high;
    this.drops = new Float32Array(maxDrops * 3);
    for (let i = 0; i < maxDrops; i++) {
      this.drops[i * 3] = (Math.random() * 2 - 1) * RAIN_HALF_X;
      this.drops[i * 3 + 1] = (Math.random() * 2 - 1) * RAIN_HALF_Y;
      this.drops[i * 3 + 2] = (Math.random() * 2 - 1) * RAIN_HALF_Z;
    }
    this.rainPositions = new Float32Array(maxDrops * 2 * 3);
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(
      rainGeometry,
      new THREE.LineBasicMaterial({
        color: SCENE_COLOURS.rainStreak,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        fog: true
      })
    );
    this.rain.name = 'rain';
    this.rain.frustumCulled = false;
    this.group.add(this.rain);

    // Spray: a ring buffer of soft puffs shared by every car
    const maxParticles = SPRAY_PARTICLES.high;
    this.sprayPositions = new Float32Array(maxParticles * 3);
    this.sprayAlpha = new Float32Array(maxParticles);
    this.spraySize = new Float32Array(maxParticles);
    this.sprayVelocity = new Float32Array(maxParticles * 3);
    this.sprayAge = new Float32Array(maxParticles).fill(SPRAY_LIFE_S);
    const sprayGeometry = new THREE.BufferGeometry();
    sprayGeometry.setAttribute('position', new THREE.BufferAttribute(this.sprayPositions, 3).setUsage(THREE.DynamicDrawUsage));
    sprayGeometry.setAttribute('alpha', new THREE.BufferAttribute(this.sprayAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    sprayGeometry.setAttribute('size', new THREE.BufferAttribute(this.spraySize, 1).setUsage(THREE.DynamicDrawUsage));
    this.sprayUniforms = {
      colour: { value: new THREE.Color(SCENE_COLOURS.spray) },
      pixelsPerMetre: { value: 600 }
    };
    this.spray = new THREE.Points(
      sprayGeometry,
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, this.sprayUniforms]),
        vertexShader: SPRAY_VERTEX,
        fragmentShader: SPRAY_FRAGMENT,
        transparent: true,
        depthWrite: false,
        fog: true
      })
    );
    // UniformsUtils.merge clones: keep the material's own uniforms for updates
    const material = this.spray.material as THREE.ShaderMaterial;
    this.sprayUniforms = material.uniforms as typeof this.sprayUniforms;
    this.spray.name = 'spray';
    this.spray.frustumCulled = false;
    this.group.add(this.spray);

    this.group.visible = false;
  }

  public get isRaining(): boolean {
    return this.weather === 'wet';
  }

  /** Spray particles alive now (for tests and tuning) */
  public get liveSprayParticles(): number {
    let live = 0;
    for (let i = 0; i < this.sprayCapacity; i++) if (this.sprayAge[i]! < SPRAY_LIFE_S) live++;
    return live;
  }

  /** Rain streaks drawn now */
  public get rainStreakCount(): number {
    return this.isRaining ? this.dropCount : 0;
  }

  private get dropCount(): number {
    return this.isHighQuality ? RAIN_STREAKS.high : RAIN_STREAKS.low;
  }

  private get sprayCapacity(): number {
    return this.isHighQuality ? SPRAY_PARTICLES.high : SPRAY_PARTICLES.low;
  }

  /** Graphics setting: Low draws fewer streaks and puffs for slower phones */
  public setQuality(high: boolean): void {
    this.isHighQuality = high;
    this.rain.geometry.setDrawRange(0, this.dropCount * 2);
    this.spray.geometry.setDrawRange(0, this.sprayCapacity);
    this.sprayAge.fill(SPRAY_LIFE_S);
    this.nextParticle = 0;
  }

  /**
   * Sets the weather's look on the scene: sky, visibility and sunlight, and shows or hides
   * the rain and spray. `scene` must come from createScene.
   */
  public setWeather(weather: WeatherCondition, scene: THREE.Scene): void {
    this.weather = weather;
    this.group.visible = weather === 'wet';
    this.sprayAge.fill(SPRAY_LIFE_S);
    const look = LOOK[weather];
    const sky = weather === 'wet' ? SCENE_COLOURS.rainSky : SCENE_COLOURS.sky;
    if (scene.background instanceof THREE.Color) scene.background.setHex(sky);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.setHex(sky);
      scene.fog.density = look.fog;
    }
    scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight) object.intensity = look.sunIntensity;
      else if (object instanceof THREE.AmbientLight) object.intensity = look.ambientIntensity;
    });
    this.setQuality(this.isHighQuality);
  }

  /** Gives a newly built track's road the weather's surface: dark and glossy when wet */
  public applyToTrack(trackGroup: THREE.Group): void {
    const road = trackGroup.getObjectByName('road') as THREE.Mesh | undefined;
    const material = road?.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    const wet = this.weather === 'wet';
    material.color.setHex(wet ? SCENE_COLOURS.wetAsphalt : SCENE_COLOURS.asphalt);
    material.roughness = wet ? 0.35 : 0.8;
    material.metalness = wet ? 0.3 : 0.1;
  }

  /**
   * One drawn frame. Rain falls round the camera with `frameDelta` (it keeps falling while
   * paused); spray moves with `motionDelta`, which is 0 when the race is not running.
   * `ai` is null when no AI cars are on track (qualifying).
   */
  public update(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    player: SprayEmitter,
    ai: readonly SprayEmitter[] | null,
    frameDelta: number,
    motionDelta: number
  ): void {
    if (!this.isRaining) return;
    this.updateRain(camera.position, frameDelta);

    // Point size in pixels for 1 m at 1 m away
    this.sprayUniforms.pixelsPerMetre.value =
      viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

    if (motionDelta > 0) {
      this.emit(0, player, camera.position, motionDelta);
      if (ai) {
        for (let i = 0; i < ai.length && i + 1 < this.owed.length; i++) {
          this.emit(i + 1, ai[i]!, camera.position, motionDelta);
        }
      }
    }
    this.updateSpray(motionDelta);
  }

  private updateRain(centre: THREE.Vector3, dt: number): void {
    const count = this.dropCount;
    const fall = RAIN_FALL_MS * dt;
    const drift = RAIN_WIND_X * dt;
    const p = this.rainPositions;
    const d = this.drops;
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      let x = d[k]! + drift;
      let y = d[k + 1]! - fall;
      const z = d[k + 2]!;
      if (y < -RAIN_HALF_Y) y += RAIN_HALF_Y * 2;
      if (x > RAIN_HALF_X) x -= RAIN_HALF_X * 2;
      d[k] = x;
      d[k + 1] = y;
      // The box moves with the camera; drops wrap round it so the rain never runs out
      const wx = centre.x + wrap(x - centre.x, RAIN_HALF_X);
      const wz = centre.z + wrap(z - centre.z, RAIN_HALF_Z);
      const wy = centre.y + y;
      const j = i * 6;
      p[j] = wx;
      p[j + 1] = wy;
      p[j + 2] = wz;
      p[j + 3] = wx - RAIN_WIND_X * STREAK_SECONDS;
      p[j + 4] = wy + RAIN_FALL_MS * STREAK_SECONDS;
      p[j + 5] = wz;
    }
    (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Throws spray from car `slot`'s rear wheels, more the faster it goes */
  private emit(slot: number, car: SprayEmitter, camera: THREE.Vector3, dt: number): void {
    if (car.speedKmh < SPRAY_MIN_KMH) {
      this.owed[slot] = 0;
      return;
    }
    const dx = car.position.x - camera.x;
    const dz = car.position.z - camera.z;
    if (dx * dx + dz * dz > SPRAY_RANGE_M * SPRAY_RANGE_M) return;

    const speedMs = car.speedKmh / 3.6;
    let owed = this.owed[slot]! + SPRAY_RATE_AT_TOP * (car.speedKmh / 180) * dt;
    const forwardX = -Math.sin(car.heading);
    const forwardZ = -Math.cos(car.heading);
    const capacity = this.sprayCapacity;
    while (owed >= 1) {
      owed -= 1;
      const i = this.nextParticle;
      this.nextParticle = (i + 1) % capacity;
      // Left or right rear wheel, 2 m behind the car's centre
      const side = Math.random() < 0.5 ? -0.8 : 0.8;
      const k = i * 3;
      this.sprayPositions[k] = car.position.x - forwardX * 2.0 + forwardZ * side * -1;
      this.sprayPositions[k + 1] = car.position.y + 0.3;
      this.sprayPositions[k + 2] = car.position.z - forwardZ * 2.0 + forwardX * side;
      // Carried along at a share of the car's speed, kicked up and out
      const scatter = (Math.random() - 0.5) * 3;
      this.sprayVelocity[k] = forwardX * speedMs * 0.55 + forwardZ * scatter;
      this.sprayVelocity[k + 1] = 1.5 + Math.random() * 2;
      this.sprayVelocity[k + 2] = forwardZ * speedMs * 0.55 - forwardX * scatter;
      this.sprayAge[i] = 0;
    }
    this.owed[slot] = owed;
  }

  private updateSpray(dt: number): void {
    const capacity = this.sprayCapacity;
    for (let i = 0; i < capacity; i++) {
      const age = this.sprayAge[i]! + dt;
      this.sprayAge[i] = age;
      if (age >= SPRAY_LIFE_S) {
        this.sprayAlpha[i] = 0;
        continue;
      }
      const k = i * 3;
      this.sprayVelocity[k + 1] = this.sprayVelocity[k + 1]! - 2.5 * dt;
      this.sprayPositions[k] = this.sprayPositions[k]! + this.sprayVelocity[k]! * dt;
      this.sprayPositions[k + 1] = Math.max(0.05, this.sprayPositions[k + 1]! + this.sprayVelocity[k + 1]! * dt);
      this.sprayPositions[k + 2] = this.sprayPositions[k + 2]! + this.sprayVelocity[k + 2]! * dt;
      const life = age / SPRAY_LIFE_S;
      this.sprayAlpha[i] = SPRAY_OPACITY * (1 - life);
      this.spraySize[i] = SPRAY_SIZE_START + (SPRAY_SIZE_END - SPRAY_SIZE_START) * life;
    }
    const attributes = this.spray.geometry.attributes;
    (attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    (attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** `value` wrapped into [-half, half) */
function wrap(value: number, half: number): number {
  const span = half * 2;
  return ((((value + half) % span) + span) % span) - half;
}
