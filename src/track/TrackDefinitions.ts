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
  /**
   * Sprints only: metres from the start of the road to the start line (R8, U-11). The grid
   * stands on this run-up behind the line, as on a circuit. 0 when not set.
   */
  startLineM?: number;
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
  description: 'A 6 km highway sprint: fast sweeps, an interchange loop, a toll-plaza chicane and a coast road.',
  rainChance: 0.15,
  // The grid sits on the run-up behind the start line (U-11)
  startLineM: 190,
  points: [
    new THREE.Vector3(0, 0.0, 0), // Road start
    new THREE.Vector3(0, 0.4, -52), // Run-up, grid and start line
    new THREE.Vector3(0, 0.8, -105),
    new THREE.Vector3(0, 1.2, -158),
    new THREE.Vector3(0, 1.6, -210),
    new THREE.Vector3(0, 2.0, -262),
    new THREE.Vector3(0, 2.4, -315),
    new THREE.Vector3(0, 2.7, -368),
    new THREE.Vector3(0, 3.0, -420),
    new THREE.Vector3(13, 3.3, -554), // Fast right onto the expressway
    new THREE.Vector3(51, 3.5, -682),
    new THREE.Vector3(71, 3.7, -732), // Expressway straight
    new THREE.Vector3(91, 3.9, -782),
    new THREE.Vector3(111, 4.0, -832),
    new THREE.Vector3(132, 4.1, -882),
    new THREE.Vector3(152, 4.2, -932),
    new THREE.Vector3(172, 4.2, -982),
    new THREE.Vector3(192, 4.2, -1032),
    new THREE.Vector3(212, 4.1, -1082),
    new THREE.Vector3(233, 4.0, -1132),
    new THREE.Vector3(253, 3.9, -1181),
    new THREE.Vector3(273, 3.8, -1231),
    new THREE.Vector3(293, 3.6, -1281),
    new THREE.Vector3(313, 3.3, -1331),
    new THREE.Vector3(340, 3.1, -1418), // Long left sweep
    new THREE.Vector3(352, 2.8, -1509),
    new THREE.Vector3(350, 2.6, -1600),
    new THREE.Vector3(332, 2.3, -1689),
    new THREE.Vector3(317, 2.0, -1739), // Bridge
    new THREE.Vector3(303, 1.7, -1790),
    new THREE.Vector3(289, 1.4, -1840),
    new THREE.Vector3(274, 1.1, -1891),
    new THREE.Vector3(260, 0.8, -1941),
    new THREE.Vector3(245, 0.5, -1992),
    new THREE.Vector3(231, 0.2, -2042),
    new THREE.Vector3(216, -0.0, -2093),
    new THREE.Vector3(214, -0.3, -2107), // Interchange ramp right
    new THREE.Vector3(214, -0.5, -2122),
    new THREE.Vector3(218, -0.7, -2136),
    new THREE.Vector3(224, -0.8, -2149),
    new THREE.Vector3(233, -0.9, -2161),
    new THREE.Vector3(289, -1.0, -2218), // Ramp
    new THREE.Vector3(293, -1.1, -2224), // Interchange hairpin left
    new THREE.Vector3(297, -1.1, -2231),
    new THREE.Vector3(299, -1.1, -2239),
    new THREE.Vector3(299, -1.0, -2247),
    new THREE.Vector3(298, -0.9, -2254),
    new THREE.Vector3(295, -0.8, -2262),
    new THREE.Vector3(291, -0.7, -2268),
    new THREE.Vector3(286, -0.5, -2274),
    new THREE.Vector3(279, -0.3, -2278),
    new THREE.Vector3(272, -0.1, -2281),
    new THREE.Vector3(264, 0.1, -2282),
    new THREE.Vector3(256, 0.3, -2282),
    new THREE.Vector3(249, 0.6, -2280),
    new THREE.Vector3(242, 0.9, -2277),
    new THREE.Vector3(194, 1.1, -2248), // Lower expressway
    new THREE.Vector3(146, 1.4, -2219),
    new THREE.Vector3(98, 1.6, -2191),
    new THREE.Vector3(50, 1.9, -2162),
    new THREE.Vector3(2, 2.1, -2133),
    new THREE.Vector3(-46, 2.4, -2104),
    new THREE.Vector3(-94, 2.6, -2075),
    new THREE.Vector3(-142, 2.8, -2046),
    new THREE.Vector3(-190, 2.9, -2017),
    new THREE.Vector3(-238, 3.0, -1989),
    new THREE.Vector3(-301, 3.1, -1942), // Left sweep under the gantries
    new THREE.Vector3(-354, 3.2, -1885),
    new THREE.Vector3(-396, 3.2, -1819),
    new THREE.Vector3(-420, 3.2, -1773), // Toll plaza approach
    new THREE.Vector3(-444, 3.2, -1726),
    new THREE.Vector3(-468, 3.1, -1679),
    new THREE.Vector3(-491, 3.0, -1632),
    new THREE.Vector3(-515, 2.8, -1585),
    new THREE.Vector3(-539, 2.6, -1539),
    new THREE.Vector3(-563, 2.4, -1492),
    new THREE.Vector3(-587, 2.2, -1445),
    new THREE.Vector3(-590, 1.9, -1440), // Toll plaza chicane right
    new THREE.Vector3(-594, 1.6, -1436),
    new THREE.Vector3(-599, 1.2, -1432),
    new THREE.Vector3(-605, 0.9, -1430),
    new THREE.Vector3(-611, 0.5, -1429),
    new THREE.Vector3(-617, 0.1, -1429),
    new THREE.Vector3(-642, -0.3, -1432), // Toll booths
    new THREE.Vector3(-648, -0.7, -1432), // Chicane left
    new THREE.Vector3(-654, -1.1, -1431),
    new THREE.Vector3(-660, -1.5, -1429),
    new THREE.Vector3(-665, -1.9, -1425),
    new THREE.Vector3(-669, -2.3, -1421),
    new THREE.Vector3(-672, -2.7, -1416),
    new THREE.Vector3(-675, -3.0, -1410),
    new THREE.Vector3(-676, -3.4, -1404),
    new THREE.Vector3(-675, -3.7, -1398),
    new THREE.Vector3(-674, -3.9, -1392),
    new THREE.Vector3(-671, -4.2, -1387),
    new THREE.Vector3(-668, -4.4, -1382),
    new THREE.Vector3(-651, -4.6, -1363), // Toll booths
    new THREE.Vector3(-647, -4.7, -1359), // Chicane right
    new THREE.Vector3(-644, -4.8, -1353),
    new THREE.Vector3(-643, -4.8, -1347),
    new THREE.Vector3(-643, -4.8, -1341),
    new THREE.Vector3(-644, -4.8, -1335),
    new THREE.Vector3(-646, -4.8, -1329),
    new THREE.Vector3(-671, -4.6, -1281), // Coast road straight
    new THREE.Vector3(-695, -4.5, -1232),
    new THREE.Vector3(-720, -4.3, -1183),
    new THREE.Vector3(-745, -4.1, -1135),
    new THREE.Vector3(-770, -3.9, -1086),
    new THREE.Vector3(-795, -3.6, -1037),
    new THREE.Vector3(-820, -3.3, -988),
    new THREE.Vector3(-844, -3.0, -940),
    new THREE.Vector3(-869, -2.7, -891),
    new THREE.Vector3(-894, -2.3, -842),
    new THREE.Vector3(-919, -2.0, -794),
    new THREE.Vector3(-944, -1.6, -745),
    new THREE.Vector3(-968, -1.3, -696),
    new THREE.Vector3(-993, -0.9, -647),
    new THREE.Vector3(-1018, -0.6, -599),
    new THREE.Vector3(-1047, -0.3, -553), // Harbour bend right
    new THREE.Vector3(-1083, 0.0, -513),
    new THREE.Vector3(-1126, 0.3, -481),
    new THREE.Vector3(-1175, 0.6, -456),
    new THREE.Vector3(-1226, 0.8, -441),
    new THREE.Vector3(-1280, 1.1, -435),
    new THREE.Vector3(-1333, 1.3, -434), // Cliff straight
    new THREE.Vector3(-1385, 1.4, -433),
    new THREE.Vector3(-1438, 1.5, -432),
    new THREE.Vector3(-1490, 1.6, -431),
    new THREE.Vector3(-1543, 1.7, -430),
    new THREE.Vector3(-1595, 1.7, -429),
    new THREE.Vector3(-1648, 1.7, -429),
    new THREE.Vector3(-1700, 1.6, -428),
    new THREE.Vector3(-1711, 1.6, -426), // Last left, brake
    new THREE.Vector3(-1722, 1.4, -423),
    new THREE.Vector3(-1733, 1.3, -417),
    new THREE.Vector3(-1741, 1.1, -410),
    new THREE.Vector3(-1749, 1.0, -401),
    new THREE.Vector3(-1754, 0.8, -391),
    new THREE.Vector3(-1758, 0.5, -380),
    new THREE.Vector3(-1759, 0.3, -369),
    new THREE.Vector3(-1760, 0.1, -312), // Run to the finish
    new THREE.Vector3(-1761, -0.2, -256),
    new THREE.Vector3(-1762, -0.4, -200),
    new THREE.Vector3(-1763, -0.7, -143),
    new THREE.Vector3(-1764, -0.9, -87),
    new THREE.Vector3(-1765, -1.1, -31),
    new THREE.Vector3(-1766, -1.3, 26),
    new THREE.Vector3(-1767, -1.5, 82),
    new THREE.Vector3(-1768, -1.7, 138),
    new THREE.Vector3(-1769, -1.9, 195),
    new THREE.Vector3(-1770, -2.0, 251)
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
  description: 'A 6 km desert sprint: sand switchbacks, a canyon hairpin, a dune field and long drafting straights.',
  rainChance: 0, // it never rains in the desert
  // The grid sits on the run-up behind the start line (U-11)
  startLineM: 190,
  // Packed sand: the dune switchbacks and the dune field, about 29% of the road
  dirtSections: [[0.219, 0.389], [0.726, 0.849]],
  points: [
    new THREE.Vector3(0, 0.0, 0), // Road start
    new THREE.Vector3(0, 0.4, -54), // Run-up, grid and start line
    new THREE.Vector3(0, 0.8, -109),
    new THREE.Vector3(0, 1.2, -163),
    new THREE.Vector3(0, 1.6, -217),
    new THREE.Vector3(0, 2.0, -271),
    new THREE.Vector3(0, 2.4, -326),
    new THREE.Vector3(0, 2.7, -380),
    new THREE.Vector3(11, 3.0, -521), // Oasis right
    new THREE.Vector3(44, 3.3, -658),
    new THREE.Vector3(61, 3.5, -709), // Oasis straight
    new THREE.Vector3(77, 3.7, -760),
    new THREE.Vector3(93, 3.9, -810),
    new THREE.Vector3(110, 4.0, -861),
    new THREE.Vector3(126, 4.1, -912),
    new THREE.Vector3(143, 4.2, -962),
    new THREE.Vector3(159, 4.2, -1013),
    new THREE.Vector3(176, 4.2, -1064),
    new THREE.Vector3(192, 4.1, -1115),
    new THREE.Vector3(209, 4.0, -1165),
    new THREE.Vector3(225, 3.9, -1216),
    new THREE.Vector3(242, 3.8, -1267),
    new THREE.Vector3(245, 3.6, -1279), // Dune switchback 1 left (sand)
    new THREE.Vector3(245, 3.3, -1292),
    new THREE.Vector3(242, 3.1, -1305),
    new THREE.Vector3(237, 2.8, -1317),
    new THREE.Vector3(229, 2.6, -1327),
    new THREE.Vector3(219, 2.3, -1336),
    new THREE.Vector3(171, 2.0, -1371), // Sand
    new THREE.Vector3(122, 1.7, -1407),
    new THREE.Vector3(114, 1.4, -1414), // Dune switchback 2 right (sand)
    new THREE.Vector3(108, 1.1, -1422),
    new THREE.Vector3(103, 0.8, -1432),
    new THREE.Vector3(100, 0.5, -1442),
    new THREE.Vector3(100, 0.2, -1453),
    new THREE.Vector3(101, -0.0, -1464),
    new THREE.Vector3(104, -0.3, -1474),
    new THREE.Vector3(110, -0.5, -1483),
    new THREE.Vector3(117, -0.7, -1491),
    new THREE.Vector3(125, -0.8, -1498),
    new THREE.Vector3(172, -0.9, -1527), // Sand
    new THREE.Vector3(219, -1.0, -1556),
    new THREE.Vector3(229, -1.1, -1564), // Dune switchback 3 left (sand)
    new THREE.Vector3(237, -1.1, -1573),
    new THREE.Vector3(244, -1.1, -1584),
    new THREE.Vector3(249, -1.0, -1595),
    new THREE.Vector3(251, -0.9, -1608),
    new THREE.Vector3(251, -0.8, -1620),
    new THREE.Vector3(247, -0.7, -1678), // Sand flat
    new THREE.Vector3(243, -0.5, -1736),
    new THREE.Vector3(239, -0.3, -1793),
    new THREE.Vector3(235, -0.1, -1851),
    new THREE.Vector3(231, 0.1, -1909),
    new THREE.Vector3(227, 0.3, -1966),
    new THREE.Vector3(223, 0.6, -2024),
    new THREE.Vector3(219, 0.9, -2081),
    new THREE.Vector3(215, 1.1, -2139),
    new THREE.Vector3(216, 1.4, -2189), // Back onto tarmac, right
    new THREE.Vector3(227, 1.6, -2238),
    new THREE.Vector3(247, 1.9, -2283),
    new THREE.Vector3(275, 2.1, -2324),
    new THREE.Vector3(310, 2.4, -2366), // Mirage straight
    new THREE.Vector3(346, 2.6, -2408),
    new THREE.Vector3(381, 2.8, -2450),
    new THREE.Vector3(416, 2.9, -2492),
    new THREE.Vector3(451, 3.0, -2534),
    new THREE.Vector3(486, 3.1, -2576),
    new THREE.Vector3(521, 3.2, -2617),
    new THREE.Vector3(556, 3.2, -2659),
    new THREE.Vector3(592, 3.2, -2701),
    new THREE.Vector3(627, 3.2, -2743),
    new THREE.Vector3(662, 3.1, -2785),
    new THREE.Vector3(697, 3.0, -2827),
    new THREE.Vector3(732, 2.8, -2869),
    new THREE.Vector3(767, 2.6, -2911),
    new THREE.Vector3(802, 2.4, -2952),
    new THREE.Vector3(807, 2.2, -2959), // Canyon hairpin left
    new THREE.Vector3(810, 1.9, -2967),
    new THREE.Vector3(812, 1.6, -2975),
    new THREE.Vector3(811, 1.2, -2983),
    new THREE.Vector3(810, 0.9, -2991),
    new THREE.Vector3(806, 0.5, -2999),
    new THREE.Vector3(801, 0.1, -3005),
    new THREE.Vector3(795, -0.3, -3011),
    new THREE.Vector3(788, -0.7, -3015),
    new THREE.Vector3(780, -1.1, -3017),
    new THREE.Vector3(729, -1.5, -3028), // Canyon floor
    new THREE.Vector3(678, -1.9, -3039),
    new THREE.Vector3(628, -2.3, -3050),
    new THREE.Vector3(577, -2.7, -3061),
    new THREE.Vector3(526, -3.0, -3071),
    new THREE.Vector3(500, -3.4, -3080), // Canyon exit right
    new THREE.Vector3(476, -3.7, -3093),
    new THREE.Vector3(456, -3.9, -3112),
    new THREE.Vector3(440, -4.2, -3134),
    new THREE.Vector3(429, -4.4, -3158),
    new THREE.Vector3(424, -4.6, -3185),
    new THREE.Vector3(424, -4.7, -3212),
    new THREE.Vector3(429, -4.8, -3239),
    new THREE.Vector3(445, -4.8, -3289), // Rocky pass
    new THREE.Vector3(462, -4.8, -3339),
    new THREE.Vector3(478, -4.8, -3388),
    new THREE.Vector3(494, -4.8, -3438),
    new THREE.Vector3(510, -4.6, -3488),
    new THREE.Vector3(527, -4.5, -3538),
    new THREE.Vector3(543, -4.3, -3588),
    new THREE.Vector3(559, -4.1, -3638),
    new THREE.Vector3(566, -3.9, -3653), // Dune field right (sand)
    new THREE.Vector3(576, -3.6, -3667),
    new THREE.Vector3(588, -3.3, -3678),
    new THREE.Vector3(603, -3.0, -3687),
    new THREE.Vector3(618, -2.7, -3692),
    new THREE.Vector3(667, -2.3, -3702), // Sand
    new THREE.Vector3(716, -2.0, -3712),
    new THREE.Vector3(765, -1.6, -3723),
    new THREE.Vector3(778, -1.3, -3727), // Dune field left (sand)
    new THREE.Vector3(789, -0.9, -3733),
    new THREE.Vector3(799, -0.6, -3742),
    new THREE.Vector3(807, -0.3, -3752),
    new THREE.Vector3(813, 0.0, -3764),
    new THREE.Vector3(816, 0.3, -3776),
    new THREE.Vector3(817, 0.6, -3789),
    new THREE.Vector3(815, 0.8, -3802),
    new THREE.Vector3(803, 1.1, -3851), // Sand
    new THREE.Vector3(790, 1.3, -3899),
    new THREE.Vector3(778, 1.4, -3948),
    new THREE.Vector3(776, 1.5, -3964), // Dune field right (sand)
    new THREE.Vector3(776, 1.6, -3980),
    new THREE.Vector3(780, 1.7, -3996),
    new THREE.Vector3(786, 1.7, -4011),
    new THREE.Vector3(795, 1.7, -4025),
    new THREE.Vector3(828, 1.6, -4067), // Sand
    new THREE.Vector3(860, 1.6, -4109),
    new THREE.Vector3(893, 1.4, -4151),
    new THREE.Vector3(928, 1.3, -4195), // Sandstone arch straight to the finish
    new THREE.Vector3(963, 1.1, -4240),
    new THREE.Vector3(997, 1.0, -4284),
    new THREE.Vector3(1032, 0.8, -4328),
    new THREE.Vector3(1066, 0.5, -4373),
    new THREE.Vector3(1101, 0.3, -4417),
    new THREE.Vector3(1136, 0.1, -4461),
    new THREE.Vector3(1170, -0.2, -4506),
    new THREE.Vector3(1205, -0.4, -4550),
    new THREE.Vector3(1240, -0.7, -4594),
    new THREE.Vector3(1274, -0.9, -4639),
    new THREE.Vector3(1309, -1.1, -4683),
    new THREE.Vector3(1344, -1.3, -4727),
    new THREE.Vector3(1378, -1.5, -4772),
    new THREE.Vector3(1413, -1.7, -4816),
    new THREE.Vector3(1447, -1.9, -4860)
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
