import * as THREE from 'three';
import { easeTightCorners } from './TrackSmoothing';

export type TrackType = 'circuit' | 'sprint';
export type SurfaceType = 'asphalt' | 'curb' | 'gravel';

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
}

/**
 * Round 1, redesigned for R5 (U-02): a 6 km lap of about 2 to 2.5 minutes, the length the
 * owner asked for after driving the 4 km version (Decision 15). The points are drawn at
 * 1:1.25 and enlarged by `scale`. Start heading north (-Z), clockwise. Corner list:
 *  T1 medium right · T2-T3 fast esses · T4 long carousel right · back straight ·
 *  T5 hairpin left · T6 medium right · T7 fast kink · T8 medium right · T9-T10 slow chicane ·
 *  T11 medium right onto the main straight.
 * The 4 km layout was stretched, not enlarged: its north side moved 300 further north and
 * its east side 300 further east (drawn units), so the straights grew and every corner
 * kept its radius. Parallel sections stay at least 110 m apart.
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
  description: 'A 6 km lap: long main straight, fast esses, a sweeping carousel, a hairpin and a slow chicane.',
  points: [
    new THREE.Vector3(0, 0, -300),       // Start / finish line, heading north
    new THREE.Vector3(0, 0, -450),       // Main straight
    new THREE.Vector3(0, 1, -600),       // Braking zone for T1
    new THREE.Vector3(12, 2, -690),      // T1 turn-in
    new THREE.Vector3(55, 3, -745),      // T1 medium right apex
    new THREE.Vector3(130, 4, -762),     // T1 exit, heading east
    new THREE.Vector3(220, 5, -760),     // Short straight
    new THREE.Vector3(340, 5, -760),     // North straight
    new THREE.Vector3(460, 5, -760),     // North straight
    new THREE.Vector3(530, 5, -757),     // Esses entry
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
    new THREE.Vector3(680, 1, -490),     // Back straight
    new THREE.Vector3(540, 1, -490),     // Back straight
    new THREE.Vector3(400, 2, -490),     // Back straight
    new THREE.Vector3(260, 2, -490),     // Back straight, braking zone for T5
    new THREE.Vector3(160, 2, -490),     // T5 hairpin entry
    new THREE.Vector3(118, 2, -477),     // T5 hairpin left
    new THREE.Vector3(105, 2, -445),     // T5 hairpin apex
    new THREE.Vector3(118, 2, -413),     // T5 hairpin
    new THREE.Vector3(160, 2, -400),     // T5 exit, heading east
    new THREE.Vector3(260, 1, -400),     // Infield straight
    new THREE.Vector3(390, 1, -400),     // Infield straight
    new THREE.Vector3(520, 0, -400),     // Infield straight
    new THREE.Vector3(600, 0, -400),     // Infield straight
    new THREE.Vector3(650, 0, -400),     // T6 entry
    new THREE.Vector3(709, 0, -380),      // T6 medium right
    new THREE.Vector3(730, 0, -330),      // T6 exit, heading south
    new THREE.Vector3(730, 0, -270),     // South straight
    new THREE.Vector3(730, 0, -140),     // South straight
    new THREE.Vector3(730, 1, -30),      // South straight
    new THREE.Vector3(730, 1, 50),       // South straight
    new THREE.Vector3(742, 2, 130),      // T7 fast kink
    new THREE.Vector3(730, 2, 210),      // South straight
    new THREE.Vector3(730, 1, 260),      // T8 entry
    new THREE.Vector3(709, 0, 310),      // T8 medium right
    new THREE.Vector3(660, 0, 330),      // T8 exit, heading west
    new THREE.Vector3(600, 0, 330),      // Run to the chicane
    new THREE.Vector3(480, 0, 330),      // West straight
    new THREE.Vector3(360, 0, 330),      // West straight
    new THREE.Vector3(300, 0, 330),      // Chicane entry
    new THREE.Vector3(240, 0, 318),      // T9 chicane, right
    new THREE.Vector3(190, 0, 342),      // T10 chicane, left
    new THREE.Vector3(130, 0, 330),      // Chicane exit
    new THREE.Vector3(70, 0, 330),       // T11 entry
    new THREE.Vector3(21, 0, 310),       // T11 medium right
    new THREE.Vector3(0, 0, 260),        // T11 exit onto the main straight
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
