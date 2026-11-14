import * as THREE from 'three';

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
  biome: 'coastal' | 'expressway' | 'city' | 'mountain';
  description: string;
}

export const TRACK_1_COASTAL: TrackData = {
  id: 'track_01_coastal',
  name: 'Coastal Highway Circuit',
  type: 'circuit',
  laps: 3,
  roadWidth: 14.0,
  isClosed: true,
  biome: 'coastal',
  description: 'Sweeping coastal turns, gentle elevation changes, and a fast chicane.',
  points: [
    new THREE.Vector3(0, 0, 0),         // Start / Finish straight
    new THREE.Vector3(0, 0, -80),       // High-speed straight
    new THREE.Vector3(25, 2, -140),     // Uphill entry into turn 1
    new THREE.Vector3(80, 4, -180),     // Sweeping right turn apex
    new THREE.Vector3(150, 3, -150),    // Downhill right sweeper
    new THREE.Vector3(180, 1, -90),     // Coastal shoreline curve
    new THREE.Vector3(160, 0, -20),     // Turn 2 right bend
    new THREE.Vector3(120, 0, 30),      // Downward slope to ground level
    new THREE.Vector3(60, 0, 60),       // Infield chicane left
    new THREE.Vector3(10, 1, 90),       // Infield chicane right
    new THREE.Vector3(-40, 2, 80),      // Turn 4 hairpin entry
    new THREE.Vector3(-80, 1, 30),      // Hairpin apex
    new THREE.Vector3(-70, 0, -20),     // Hairpin exit
    new THREE.Vector3(-35, 0, -10)      // Final turn onto main straight
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

export const ALL_TRACKS: TrackData[] = [
  TRACK_1_COASTAL,
  TRACK_2_EXPRESSWAY,
  TRACK_3_METROPOLIS,
  TRACK_4_ALPINE,
  TRACK_5_DESERT,
  TRACK_6_CYBER_DOCKS,
  TRACK_7_STORMY_PASS,
  TRACK_8_APEX_FINALE
];
