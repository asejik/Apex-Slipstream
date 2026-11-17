import * as THREE from 'three';
import { easeTightCorners } from './TrackSmoothing';

export type TrackType = 'circuit' | 'sprint';
/** 'dirt' is a dirt stretch of the road itself (R7); 'gravel' is the run-off beside it */
export type SurfaceType = 'asphalt' | 'curb' | 'gravel' | 'dirt';

export interface TrackData {
  id: string;
  name: string;
  type: TrackType;
  laps: number;
  roadWidth: number; // meters
  points: THREE.Vector3[];
  isClosed: boolean;
  /** How much a circuit's points are enlarged on the ground; CIRCUIT_SCALE when not set */
  scale?: number;
  biome: 'coastal' | 'expressway' | 'city' | 'mountain';
  description: string;
  /** Chance of rain on race day, 0 to 1 (R7). The forecast before the race says which. */
  rainChance: number;
  /**
   * Stretches of the road that are dirt, not tarmac, as [start, end] shares of the lap
   * (0 to 1, start below end) (R7). They make All-Terrain the right tyre on some tracks.
   */
  dirtSections?: ReadonlyArray<readonly [number, number]>;
}

/** Share of the lap that is dirt road (0 to 1) */
export function dirtShare(track: Pick<TrackData, 'dirtSections'>): number {
  let share = 0;
  for (const [start, end] of track.dirtSections ?? []) share += Math.max(0, end - start);
  return Math.min(1, share);
}

/** True when `t` (0 to 1 along the lap) is on a dirt stretch of the road */
export function isDirtAt(track: Pick<TrackData, 'dirtSections'>, t: number): boolean {
  for (const [start, end] of track.dirtSections ?? []) if (t >= start && t <= end) return true;
  return false;
}

/**
 * Round 1, redesigned for R5 (U-02): a 6 km lap of about 2 to 2.5 minutes, the length the
 * owner asked for after driving the 4 km version (Decision 15). The points are drawn at
 * 1:1.25 and enlarged by `scale`. Start heading north (-Z), clockwise. Corner list:
 *  T1 medium right · cliff road sweeps · T2-T3 fast esses · T4 long carousel right ·
 *  back straight with two kinks · T5 hairpin left · T6 slow right · T7 harbour hairpin left ·
 *  T8 slow right · T9 medium right · south road sweeps · T10 medium right · west road dip ·
 *  T11-T12 slow chicane · T13 medium right onto the main straight.
 * Owner, R6: the straights were too straight, so only the main straight stays dead straight;
 * the others sweep, and the infield straight became the harbour section. With the car's grip
 * limit, the hairpins, the harbour and the chicane need braking.
 * Separate parts of the lap stay at least 96 m apart.
 */
export const TRACK_1_COASTAL: TrackData = {
  id: 'track_01_coastal',
  name: 'Coastal Highway Circuit',
  type: 'circuit',
  laps: 3,
  roadWidth: 14.0,
  isClosed: true,
  scale: 1.25,
  biome: 'coastal',
  description: 'A 6.5 km lap: long main straight, cliff-top sweeps, a carousel, two hairpins, a harbour section and a slow chicane.',
  rainChance: 0.35, // sea showers
  points: [
    new THREE.Vector3(0, 0, -300),       // Start / finish line, heading north
    new THREE.Vector3(0, 0, -450),       // Main straight
    new THREE.Vector3(0, 1, -600),       // Braking zone for T1
    new THREE.Vector3(12, 2, -690),      // T1 turn-in
    new THREE.Vector3(55, 3, -745),      // T1 medium right apex
    new THREE.Vector3(130, 4, -762),     // T1 exit, heading east
    new THREE.Vector3(210, 5, -768),     // Cliff road
    new THREE.Vector3(290, 6, -800),     // Cliff road sweeps left
    new THREE.Vector3(370, 6, -816),     // Cliff road crest
    new THREE.Vector3(450, 6, -800),     // Cliff road sweeps right
    new THREE.Vector3(510, 5, -770),     // Esses approach
    new THREE.Vector3(580, 5, -747),     // T2 fast esses, right
    new THREE.Vector3(680, 4, -773),     // T3 fast esses, left
    new THREE.Vector3(760, 3, -756),     // Run to the carousel
    // T4 carousel: nine points on a true circle (centre 800, -620, radius 130) so it is
    // one steady sweep; with fewer points the curve bulged and tightened along the way
    new THREE.Vector3(800, 2, -750),     // T4 carousel entry, heading east
    new THREE.Vector3(849.7, 2, -740.1),
    new THREE.Vector3(891.9, 1, -711.9),
    new THREE.Vector3(920.1, 1, -669.7),
    new THREE.Vector3(930, 0, -620),     // T4 carousel apex, heading south
    new THREE.Vector3(920.1, 0, -570.3),
    new THREE.Vector3(891.9, 0, -528.1),
    new THREE.Vector3(849.7, 0, -499.9),
    new THREE.Vector3(800, 0, -490),     // T4 exit, heading west
    new THREE.Vector3(690, 1, -494),     // Back straight
    new THREE.Vector3(590, 1, -518),     // Back straight bends right
    new THREE.Vector3(490, 2, -528),     // Back straight
    new THREE.Vector3(400, 2, -512),     // Back straight bends left
    new THREE.Vector3(330, 2, -494),     // Back straight, braking zone for T5
    new THREE.Vector3(250, 2, -490),     // Back straight
    new THREE.Vector3(160, 2, -490),     // T5 hairpin entry
    new THREE.Vector3(118, 2, -477),     // T5 hairpin left
    new THREE.Vector3(105, 2, -445),     // T5 hairpin apex
    new THREE.Vector3(118, 2, -413),     // T5 hairpin
    new THREE.Vector3(160, 2, -400),     // T5 exit, heading east
    // Harbour: a slow right, a tight hairpin round the harbour wall, and a slow right out
    new THREE.Vector3(225, 1, -400),     // Harbour straight
    new THREE.Vector3(290, 1, -400),     // T6 entry
    new THREE.Vector3(311.2, 1, -391.2), // T6 slow right
    new THREE.Vector3(320, 1, -370),     // T6 exit, heading south
    new THREE.Vector3(324, 1, -330),     // Harbour run
    new THREE.Vector3(336, 0, -292),     // Braking zone for T7
    new THREE.Vector3(354, 0, -250),     // T7 hairpin entry (circle centre 380, -250, radius 26)
    new THREE.Vector3(361.6, 0, -231.6), // T7 hairpin left
    new THREE.Vector3(380, 0, -224),     // T7 hairpin apex
    new THREE.Vector3(398.4, 0, -231.6), // T7 hairpin
    new THREE.Vector3(406, 0, -250),     // T7 exit, heading north
    new THREE.Vector3(418, 0, -290),     // Harbour run
    new THREE.Vector3(434, 0, -325),     // T8 entry
    new THREE.Vector3(455, 0, -352),     // T8 slow right
    new THREE.Vector3(485, 0, -362),     // T8 exit, heading east
    new THREE.Vector3(510, 0, -360),     // Run to T9
    new THREE.Vector3(580, 0, -360),     // Run to T10
    new THREE.Vector3(680, 0, -360),     // T9 entry
    new THREE.Vector3(715.4, 0, -345.4), // T9 medium right
    new THREE.Vector3(730, 0, -310),     // T9 exit, heading south
    new THREE.Vector3(730, 0, -240),     // South road
    new THREE.Vector3(748, 0, -160),     // South road sweeps left
    new THREE.Vector3(776, 1, -70),      // South road
    new THREE.Vector3(786, 1, 10),       // South road crest
    new THREE.Vector3(770, 2, 90),       // South road sweeps right
    new THREE.Vector3(742, 2, 160),      // South road
    new THREE.Vector3(730, 1, 230),      // T10 entry
    new THREE.Vector3(709, 0, 300),      // T10 medium right
    new THREE.Vector3(660, 0, 325),      // T10 exit, heading west
    new THREE.Vector3(590, 0, 334),      // West road
    new THREE.Vector3(520, 0, 356),      // West road dips left
    new THREE.Vector3(450, 0, 362),      // West road
    new THREE.Vector3(390, 0, 346),      // West road bends right
    new THREE.Vector3(340, 0, 332),      // Chicane approach
    new THREE.Vector3(300, 0, 330),      // Chicane entry
    new THREE.Vector3(240, 0, 318),      // T11 chicane, right
    new THREE.Vector3(190, 0, 342),      // T12 chicane, left
    new THREE.Vector3(130, 0, 330),      // Chicane exit
    new THREE.Vector3(70, 0, 330),       // T13 entry
    new THREE.Vector3(21, 0, 310),       // T13 medium right
    new THREE.Vector3(0, 0, 260),        // T13 exit onto the main straight
    new THREE.Vector3(0, 0, 150),        // Main straight
    new THREE.Vector3(0, 0, 0),          // Main straight
    new THREE.Vector3(0, 0, -150)        // Main straight: the grid lines up here
  ]
};

export const TRACK_2_EXPRESSWAY: TrackData = {
  id: 'track_02_expressway',
  name: 'Sunlit Expressway Sprint',
  type: 'sprint',
  laps: 1,
  roadWidth: 16.0,
  isClosed: false,
  biome: 'expressway',
  description: 'Point-to-point multi-lane highway sprint with gravel shoulder shortcuts.',
  rainChance: 0.15,
  points: [
    new THREE.Vector3(0, 0, 0),         // Start line
    new THREE.Vector3(0, 0, -100),      // Launch straightaway
    new THREE.Vector3(30, 2, -220),     // Gentle right curve
    new THREE.Vector3(90, 5, -340),     // Canyon rise
    new THREE.Vector3(120, 6, -460),    // High-speed ridge
    new THREE.Vector3(80, 4, -580),     // Gentle left downhill sweep
    new THREE.Vector3(10, 2, -700),     // Expressway bridge straight
    new THREE.Vector3(-40, 0, -820),    // Right kink
    new THREE.Vector3(-30, 0, -960),    // Final sprint straight
    new THREE.Vector3(0, 0, -1100)      // Sprint Finish Line gantry
  ]
};

export const TRACK_3_METROPOLIS: TrackData = {
  id: 'track_03_metropolis',
  name: 'Neon City Circuit',
  type: 'circuit',
  laps: 3,
  roadWidth: 13.0,
  isClosed: true,
  biome: 'city',
  description: 'High-speed urban canyon between glowing towers with tight 90-degree city intersections.',
  rainChance: 0.3,
  points: [
    new THREE.Vector3(0, 0, 0),         // Main boulevard start
    new THREE.Vector3(0, 0, -110),      // High-speed boulevard straight
    new THREE.Vector3(45, 0, -160),     // 90° Right onto Neon Plaza
    new THREE.Vector3(110, 1, -160),    // Plaza straight
    new THREE.Vector3(160, 2, -210),    // 90° Left into Overpass rise
    new THREE.Vector3(160, 4, -300),    // Overpass crest
    new THREE.Vector3(120, 3, -370),    // Banking downhill turn
    new THREE.Vector3(50, 1, -380),     // Lower city subway bend
    new THREE.Vector3(-20, 0, -320),    // Underpass straight
    new THREE.Vector3(-70, 0, -220),    // Technical warehouse chicane
    new THREE.Vector3(-50, 1, -110),    // Fast left sweep
    new THREE.Vector3(-30, 0, -30)      // Turn into start straight
  ]
};

export const TRACK_4_ALPINE: TrackData = {
  id: 'track_04_alpine',
  name: 'Alpine Ridge Pass',
  type: 'circuit',
  laps: 2,
  roadWidth: 12.0,
  isClosed: true,
  biome: 'mountain',
  description: 'Extreme mountain pass with steep elevation gradients, cliffside hairpins, and narrow bridges.',
  rainChance: 0.45, // mountain weather
  // Forest tracks on the climb and the descent: 30% of the lap
  dirtSections: [[0.2, 0.35], [0.55, 0.7]],
  points: [
    new THREE.Vector3(0, 0, 0),         // Valley start line
    new THREE.Vector3(20, 2, -90),      // Initial mountain ascent
    new THREE.Vector3(70, 5, -160),     // Climb to switchback 1
    new THREE.Vector3(110, 8, -130),    // Switchback 1 hairpin apex
    new THREE.Vector3(80, 11, -60),     // High ridge climb
    new THREE.Vector3(130, 14, 20),     // Ridge crest summit
    new THREE.Vector3(160, 12, 100),    // Mountain bridge
    new THREE.Vector3(110, 8, 160),     // Switchback 2 downhill entry
    new THREE.Vector3(50, 5, 140),      // Hairpin descent
    new THREE.Vector3(-10, 3, 90),      // Canyon floor run
    new THREE.Vector3(-50, 1, 40),      // Valley chicane
    new THREE.Vector3(-30, 0, 10)       // Approach to start/finish
  ]
};

export const TRACK_5_DESERT: TrackData = {
  id: 'track_05_desert',
  name: 'Desert Dunes Sprint',
  type: 'sprint',
  laps: 1,
  roadWidth: 16.0,
  isClosed: false,
  biome: 'expressway',
  description: 'Blistering point-to-point desert sprint across sand dunes with long slipstream drafting straights.',
  rainChance: 0, // it never rains in the desert
  // Packed sand across the dunes: 35% of the road
  dirtSections: [[0.15, 0.35], [0.6, 0.75]],
  points: [
    new THREE.Vector3(0, 0, 0),         // Desert Oasis start
    new THREE.Vector3(0, 0, -140),      // High-speed sand flat
    new THREE.Vector3(40, 2, -280),     // Dune crest rise
    new THREE.Vector3(20, 3, -420),     // Downward dune sweep
    new THREE.Vector3(-50, 1, -560),    // Canyon oasis curve
    new THREE.Vector3(-80, 0, -700),    // Mirage straightaway
    new THREE.Vector3(-40, 2, -850),    // Rocky pass kink
    new THREE.Vector3(30, 4, -1000),    // Sandstone archway
    new THREE.Vector3(10, 2, -1150),    // Sprint finish straight
    new THREE.Vector3(0, 0, -1300)      // Finish Gantry
  ]
};

export const TRACK_6_CYBER_DOCKS: TrackData = {
  id: 'track_06_cyber_docks',
  name: 'Cyber Docks Circuit',
  type: 'circuit',
  laps: 3,
  roadWidth: 14.0,
  isClosed: true,
  biome: 'city',
  description: 'Waterfront container port circuit with heavy braking zones and wide industrial chicanes.',
  rainChance: 0.35,
  points: [
    new THREE.Vector3(0, 0, 0),         // Crane alley start
    new THREE.Vector3(0, 0, -100),      // Cargo straight
    new THREE.Vector3(60, 0, -140),     // Pier 1 right turn
    new THREE.Vector3(140, 1, -120),    // Wharf straightaway
    new THREE.Vector3(190, 2, -50),     // Container yard turn
    new THREE.Vector3(160, 1, 30),      // Drydock bridge
    new THREE.Vector3(90, 0, 70),       // Warehouse hairpin entry
    new THREE.Vector3(20, 0, 80),       // Gantry chicane
    new THREE.Vector3(-50, 1, 40),      // Fast shipyard sweeper
    new THREE.Vector3(-40, 0, -10)      // Exit onto main crane straight
  ]
};

export const TRACK_7_STORMY_PASS: TrackData = {
  id: 'track_07_stormy_pass',
  name: 'Stormy Summit Pass',
  type: 'circuit',
  laps: 2,
  roadWidth: 12.0,
  isClosed: true,
  biome: 'mountain',
  description: 'Treacherous high-altitude circuit wrapped in rain clouds with slick surfaces and extreme banking.',
  rainChance: 1, // always raining
  points: [
    new THREE.Vector3(0, 0, 0),         // Storm peak starting grid
    new THREE.Vector3(25, 3, -80),      // Uphill climb to thunder ridge
    new THREE.Vector3(70, 7, -130),     // Ridge curve apex
    new THREE.Vector3(120, 9, -100),    // High-altitude ledge
    new THREE.Vector3(150, 7, -20),     // Downward winding S-turn
    new THREE.Vector3(130, 4, 60),      // Wet surface canyon
    new THREE.Vector3(70, 2, 100),      // Hairpin over cliff edge
    new THREE.Vector3(10, 1, 70),       // Rapid downhill chute
    new THREE.Vector3(-40, 0, 30),      // Rainwater chicane
    new THREE.Vector3(-30, 0, -10)      // Approach to finish gantry
  ]
};

export const TRACK_8_APEX_FINALE: TrackData = {
  id: 'track_08_apex_finale',
  name: 'Apex Grand Prix Finale',
  type: 'circuit',
  laps: 3,
  roadWidth: 15.0,
  isClosed: true,
  biome: 'coastal',
  description: 'The premier championship finale: broad multi-groove straights, double-apex corners, and grandstands.',
  rainChance: 0.25,
  points: [
    new THREE.Vector3(0, 0, 0),         // Grand Prix Main Straight
    new THREE.Vector3(0, 0, -120),      // High-speed DRS straight
    new THREE.Vector3(30, 1, -190),     // Turn 1 entry
    new THREE.Vector3(90, 3, -230),     // Sweeping turn 2 apex
    new THREE.Vector3(160, 2, -200),    // Rapid transition to esses
    new THREE.Vector3(210, 1, -120),    // Infield esses 1
    new THREE.Vector3(180, 0, -40),     // Infield esses 2
    new THREE.Vector3(190, 1, 40),      // Hairpin carousel entry
    new THREE.Vector3(140, 2, 100),     // Carousel double-apex
    new THREE.Vector3(70, 1, 100),      // Exit onto backstraight
    new THREE.Vector3(0, 0, 70),        // Final stadium chicane left
    new THREE.Vector3(-40, 0, 30),      // Final chicane right
    new THREE.Vector3(-25, 0, 0)        // Turn onto start/finish line
  ]
};

/** No bend on any track is tighter than this, in metres (U-02). */
export const MIN_CORNER_RADIUS = 30;

/** Tracks as drawn, before tight bends are eased. */
const DRAWN_TRACKS: TrackData[] = [
  TRACK_1_COASTAL,
  TRACK_2_EXPRESSWAY,
  TRACK_3_METROPOLIS,
  TRACK_4_ALPINE,
  TRACK_5_DESERT,
  TRACK_6_CYBER_DOCKS,
  TRACK_7_STORMY_PASS,
  TRACK_8_APEX_FINALE
];

/** Circuits not yet redesigned are enlarged by this factor so laps are longer and bends wider (U-02). */
export const CIRCUIT_SCALE = 1.5;

function enlarge(points: THREE.Vector3[], scale: number): THREE.Vector3[] {
  return points.map((p) => new THREE.Vector3(p.x * scale, p.y, p.z * scale));
}

export const ALL_TRACKS: TrackData[] = DRAWN_TRACKS.map((track) => ({
  ...track,
  points: easeTightCorners(
    track.isClosed ? enlarge(track.points, track.scale ?? CIRCUIT_SCALE) : track.points,
    track.isClosed,
    MIN_CORNER_RADIUS
  )
}));
