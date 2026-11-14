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
    new THREE.Vector3(120, -1, 30),     // Downward slope
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

export const ALL_TRACKS: TrackData[] = [
  TRACK_1_COASTAL,
  TRACK_2_EXPRESSWAY
];
