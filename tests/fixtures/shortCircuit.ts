import * as THREE from 'three';
import { TRACK_6_CYBER_DOCKS, TrackData } from '../../src/track/TrackDefinitions';

/**
 * A short circuit (about 600 m) for the tests that time laps in seconds. They used Coastal
 * until it became a 4 km lap (R5), then Cyber Docks until it became a 6 km lap (R8); this is
 * the old Cyber Docks layout kept as a test track, so the checks and durations are unchanged.
 */
export const SHORT_CIRCUIT: TrackData = {
  ...TRACK_6_CYBER_DOCKS,
  id: 'test_short_circuit',
  points: [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -100),
    new THREE.Vector3(60, 0, -140),
    new THREE.Vector3(140, 1, -120),
    new THREE.Vector3(190, 2, -50),
    new THREE.Vector3(160, 1, 30),
    new THREE.Vector3(90, 0, 70),
    new THREE.Vector3(20, 0, 80),
    new THREE.Vector3(-50, 1, 40),
    new THREE.Vector3(-40, 0, -10)
  ]
};
