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
    new THREE.Vector3(0, 4.3, 0), // Road start
    new THREE.Vector3(0, 4.7, -52), // Run-up, grid and start line
    new THREE.Vector3(0, 5.1, -105),
    new THREE.Vector3(0, 5.5, -158),
    new THREE.Vector3(0, 5.8, -210),
    new THREE.Vector3(0, 6.2, -262),
    new THREE.Vector3(0, 6.5, -315),
    new THREE.Vector3(0, 6.8, -368),
    new THREE.Vector3(0, 7.0, -420),
    new THREE.Vector3(13, 7.2, -554), // Fast right onto the expressway
    new THREE.Vector3(51, 7.4, -682),
    new THREE.Vector3(71, 7.6, -732), // Expressway straight
    new THREE.Vector3(91, 7.7, -782),
    new THREE.Vector3(111, 7.7, -832),
    new THREE.Vector3(132, 7.8, -882),
    new THREE.Vector3(152, 7.8, -932),
    new THREE.Vector3(172, 7.7, -982),
    new THREE.Vector3(192, 7.6, -1032),
    new THREE.Vector3(212, 7.5, -1082),
    new THREE.Vector3(233, 7.3, -1132),
    new THREE.Vector3(253, 7.1, -1181),
    new THREE.Vector3(273, 6.9, -1231),
    new THREE.Vector3(293, 6.6, -1281),
    new THREE.Vector3(313, 6.4, -1331),
    new THREE.Vector3(340, 6.1, -1418), // Long left sweep
    new THREE.Vector3(352, 5.8, -1509),
    new THREE.Vector3(350, 5.5, -1600),
    new THREE.Vector3(332, 5.2, -1689),
    new THREE.Vector3(317, 4.9, -1739), // Bridge
    new THREE.Vector3(303, 4.6, -1790),
    new THREE.Vector3(289, 4.4, -1840),
    new THREE.Vector3(274, 4.1, -1891),
    new THREE.Vector3(260, 3.9, -1941),
    new THREE.Vector3(245, 3.7, -1992),
    new THREE.Vector3(231, 3.5, -2042),
    new THREE.Vector3(216, 3.4, -2093),
    new THREE.Vector3(214, 3.3, -2107), // Interchange ramp right
    new THREE.Vector3(214, 3.2, -2122),
    new THREE.Vector3(218, 3.2, -2136),
    new THREE.Vector3(224, 3.2, -2149),
    new THREE.Vector3(233, 3.2, -2161),
    new THREE.Vector3(289, 3.3, -2218), // Ramp
    new THREE.Vector3(293, 3.4, -2224), // Interchange hairpin left
    new THREE.Vector3(297, 3.5, -2231),
    new THREE.Vector3(299, 3.6, -2239),
    new THREE.Vector3(299, 3.8, -2247),
    new THREE.Vector3(298, 4.0, -2254),
    new THREE.Vector3(295, 4.2, -2262),
    new THREE.Vector3(291, 4.5, -2268),
    new THREE.Vector3(286, 4.7, -2274),
    new THREE.Vector3(279, 4.9, -2278),
    new THREE.Vector3(272, 5.2, -2281),
    new THREE.Vector3(264, 5.4, -2282),
    new THREE.Vector3(256, 5.7, -2282),
    new THREE.Vector3(249, 5.9, -2280),
    new THREE.Vector3(242, 6.1, -2277),
    new THREE.Vector3(194, 6.2, -2248), // Lower expressway
    new THREE.Vector3(146, 6.4, -2219),
    new THREE.Vector3(98, 6.5, -2191),
    new THREE.Vector3(50, 6.6, -2162),
    new THREE.Vector3(2, 6.6, -2133),
    new THREE.Vector3(-46, 6.6, -2104),
    new THREE.Vector3(-94, 6.6, -2075),
    new THREE.Vector3(-142, 6.5, -2046),
    new THREE.Vector3(-190, 6.4, -2017),
    new THREE.Vector3(-238, 6.3, -1989),
    new THREE.Vector3(-301, 6.1, -1942), // Left sweep under the gantries
    new THREE.Vector3(-354, 5.9, -1885),
    new THREE.Vector3(-396, 5.7, -1819),
    new THREE.Vector3(-420, 5.4, -1773), // Toll plaza approach
    new THREE.Vector3(-444, 5.1, -1726),
    new THREE.Vector3(-468, 4.8, -1679),
    new THREE.Vector3(-491, 4.4, -1632),
    new THREE.Vector3(-515, 4.1, -1585),
    new THREE.Vector3(-539, 3.7, -1539),
    new THREE.Vector3(-563, 3.3, -1492),
    new THREE.Vector3(-587, 3.0, -1445),
    new THREE.Vector3(-590, 2.6, -1440), // Toll plaza chicane right
    new THREE.Vector3(-594, 2.3, -1436),
    new THREE.Vector3(-599, 1.9, -1432),
    new THREE.Vector3(-605, 1.6, -1430),
    new THREE.Vector3(-611, 1.3, -1429),
    new THREE.Vector3(-617, 1.1, -1429),
    new THREE.Vector3(-642, 0.9, -1432), // Toll booths
    new THREE.Vector3(-648, 0.7, -1432), // Chicane left
    new THREE.Vector3(-654, 0.5, -1431),
    new THREE.Vector3(-660, 0.4, -1429),
    new THREE.Vector3(-665, 0.3, -1425),
    new THREE.Vector3(-669, 0.3, -1421),
    new THREE.Vector3(-672, 0.3, -1416),
    new THREE.Vector3(-675, 0.4, -1410),
    new THREE.Vector3(-676, 0.5, -1404),
    new THREE.Vector3(-675, 0.6, -1398),
    new THREE.Vector3(-674, 0.8, -1392),
    new THREE.Vector3(-671, 1.0, -1387),
    new THREE.Vector3(-668, 1.3, -1382),
    new THREE.Vector3(-651, 1.5, -1363), // Toll booths
    new THREE.Vector3(-647, 1.8, -1359), // Chicane right
    new THREE.Vector3(-644, 2.2, -1353),
    new THREE.Vector3(-643, 2.5, -1347),
    new THREE.Vector3(-643, 2.9, -1341),
    new THREE.Vector3(-644, 3.2, -1335),
    new THREE.Vector3(-646, 3.6, -1329),
    new THREE.Vector3(-671, 3.9, -1281), // Coast road straight
    new THREE.Vector3(-695, 4.3, -1232),
    new THREE.Vector3(-720, 4.6, -1183),
    new THREE.Vector3(-745, 4.9, -1135),
    new THREE.Vector3(-770, 5.2, -1086),
    new THREE.Vector3(-795, 5.5, -1037),
    new THREE.Vector3(-820, 5.7, -988),
    new THREE.Vector3(-844, 5.9, -940),
    new THREE.Vector3(-869, 6.1, -891),
    new THREE.Vector3(-894, 6.2, -842),
    new THREE.Vector3(-919, 6.3, -794),
    new THREE.Vector3(-944, 6.4, -745),
    new THREE.Vector3(-968, 6.4, -696),
    new THREE.Vector3(-993, 6.4, -647),
    new THREE.Vector3(-1018, 6.3, -599),
    new THREE.Vector3(-1047, 6.2, -553), // Harbour bend right
    new THREE.Vector3(-1083, 6.1, -513),
    new THREE.Vector3(-1126, 6.0, -481),
    new THREE.Vector3(-1175, 5.8, -456),
    new THREE.Vector3(-1226, 5.6, -441),
    new THREE.Vector3(-1280, 5.4, -435),
    new THREE.Vector3(-1333, 5.2, -434), // Cliff straight
    new THREE.Vector3(-1385, 4.9, -433),
    new THREE.Vector3(-1438, 4.7, -432),
    new THREE.Vector3(-1490, 4.5, -431),
    new THREE.Vector3(-1543, 4.2, -430),
    new THREE.Vector3(-1595, 4.0, -429),
    new THREE.Vector3(-1648, 3.8, -429),
    new THREE.Vector3(-1700, 3.6, -428),
    new THREE.Vector3(-1711, 3.4, -426), // Last left, brake
    new THREE.Vector3(-1722, 3.3, -423),
    new THREE.Vector3(-1733, 3.2, -417),
    new THREE.Vector3(-1741, 3.1, -410),
    new THREE.Vector3(-1749, 3.0, -401),
    new THREE.Vector3(-1754, 3.0, -391),
    new THREE.Vector3(-1758, 3.0, -380),
    new THREE.Vector3(-1759, 3.1, -369),
    new THREE.Vector3(-1760, 3.2, -312), // Run to the finish
    new THREE.Vector3(-1761, 3.3, -256),
    new THREE.Vector3(-1762, 3.5, -200),
    new THREE.Vector3(-1763, 3.7, -143),
    new THREE.Vector3(-1764, 3.9, -87),
    new THREE.Vector3(-1765, 4.1, -31),
    new THREE.Vector3(-1766, 4.4, 26),
    new THREE.Vector3(-1767, 4.6, 82),
    new THREE.Vector3(-1768, 4.9, 138),
    new THREE.Vector3(-1769, 5.2, 195),
    new THREE.Vector3(-1770, 5.6, 251),
  ]
};

export const TRACK_3_METROPOLIS: TrackData = {
  id: 'track_03_metropolis',
  name: 'Neon City Circuit',
  type: 'circuit',
  laps: 3,
  roadWidth: 13.0,
  isClosed: true,
  // Drawn in metres (R8)
  scale: 1,
  biome: 'city',
  description: 'A 6 km street circuit: a plaza, an opera hairpin, a fast monorail sweep, a market chicane and a long riverside.',
  rainChance: 0.3,
  points: [
    new THREE.Vector3(0, 4.3, -589), // Start/finish line
    new THREE.Vector3(0, 4.7, -643),
    new THREE.Vector3(0, 5.1, -697),
    new THREE.Vector3(0, 5.5, -750),
    new THREE.Vector3(0, 5.8, -804),
    new THREE.Vector3(0, 6.2, -857),
    new THREE.Vector3(0, 6.5, -911),
    new THREE.Vector3(0, 6.8, -964),
    new THREE.Vector3(0, 7.0, -1018),
    new THREE.Vector3(1, 7.2, -1024), // T1 Plaza right
    new THREE.Vector3(2, 7.4, -1030),
    new THREE.Vector3(5, 7.6, -1036),
    new THREE.Vector3(9, 7.7, -1041),
    new THREE.Vector3(14, 7.7, -1045),
    new THREE.Vector3(20, 7.8, -1048),
    new THREE.Vector3(26, 7.8, -1049),
    new THREE.Vector3(32, 7.7, -1050),
    new THREE.Vector3(84, 7.6, -1050), // Plaza
    new THREE.Vector3(137, 7.5, -1050),
    new THREE.Vector3(190, 7.3, -1050),
    new THREE.Vector3(242, 7.1, -1050),
    new THREE.Vector3(294, 6.9, -1050),
    new THREE.Vector3(347, 6.6, -1050),
    new THREE.Vector3(400, 6.4, -1050),
    new THREE.Vector3(452, 6.1, -1050),
    new THREE.Vector3(458, 5.8, -1051), // T2 left by the towers
    new THREE.Vector3(463, 5.5, -1052),
    new THREE.Vector3(469, 5.2, -1055),
    new THREE.Vector3(473, 4.9, -1059),
    new THREE.Vector3(477, 4.6, -1063),
    new THREE.Vector3(480, 4.4, -1069),
    new THREE.Vector3(481, 4.1, -1074),
    new THREE.Vector3(482, 3.9, -1080),
    new THREE.Vector3(482, 3.7, -1132), // Gallery street
    new THREE.Vector3(482, 3.5, -1184),
    new THREE.Vector3(482, 3.4, -1236),
    new THREE.Vector3(482, 3.3, -1288),
    new THREE.Vector3(482, 3.2, -1340),
    new THREE.Vector3(483, 3.2, -1346), // T3 opera hairpin
    new THREE.Vector3(484, 3.2, -1352),
    new THREE.Vector3(487, 3.2, -1357),
    new THREE.Vector3(491, 3.3, -1362),
    new THREE.Vector3(496, 3.4, -1365),
    new THREE.Vector3(501, 3.5, -1368),
    new THREE.Vector3(507, 3.6, -1370),
    new THREE.Vector3(513, 3.8, -1370),
    new THREE.Vector3(519, 4.0, -1369),
    new THREE.Vector3(525, 4.2, -1367),
    new THREE.Vector3(530, 4.5, -1364),
    new THREE.Vector3(534, 4.7, -1360),
    new THREE.Vector3(538, 4.9, -1355),
    new THREE.Vector3(565, 5.2, -1308), // Neon Avenue
    new THREE.Vector3(592, 5.4, -1261),
    new THREE.Vector3(619, 5.7, -1214),
    new THREE.Vector3(647, 5.9, -1167),
    new THREE.Vector3(674, 6.1, -1120),
    new THREE.Vector3(701, 6.2, -1073),
    new THREE.Vector3(728, 6.4, -1026),
    new THREE.Vector3(755, 6.5, -979),
    new THREE.Vector3(782, 6.6, -932),
    new THREE.Vector3(810, 6.6, -885),
    new THREE.Vector3(837, 6.6, -838),
    new THREE.Vector3(864, 6.6, -791),
    new THREE.Vector3(891, 6.5, -744),
    new THREE.Vector3(918, 6.4, -697),
    new THREE.Vector3(945, 6.3, -650),
    new THREE.Vector3(972, 6.1, -603),
    new THREE.Vector3(991, 5.9, -577), // T4 fast left under the monorail
    new THREE.Vector3(1014, 5.7, -556),
    new THREE.Vector3(1041, 5.4, -541),
    new THREE.Vector3(1071, 5.1, -531),
    new THREE.Vector3(1102, 4.8, -528),
    new THREE.Vector3(1162, 4.4, -528), // Monorail straight
    new THREE.Vector3(1222, 4.1, -528),
    new THREE.Vector3(1282, 3.7, -528),
    new THREE.Vector3(1342, 3.3, -528),
    new THREE.Vector3(1402, 3.0, -528),
    new THREE.Vector3(1410, 2.6, -527), // T5 right
    new THREE.Vector3(1417, 2.3, -525),
    new THREE.Vector3(1423, 1.9, -521),
    new THREE.Vector3(1429, 1.6, -516),
    new THREE.Vector3(1465, 1.3, -481), // Short block
    new THREE.Vector3(1500, 1.1, -446),
    new THREE.Vector3(1535, 0.9, -410),
    new THREE.Vector3(1571, 0.7, -375),
    new THREE.Vector3(1574, 0.5, -370), // T6 cathedral corner
    new THREE.Vector3(1577, 0.4, -365),
    new THREE.Vector3(1579, 0.3, -360),
    new THREE.Vector3(1579, 0.3, -354),
    new THREE.Vector3(1579, 0.3, -348),
    new THREE.Vector3(1577, 0.4, -342),
    new THREE.Vector3(1574, 0.5, -337),
    new THREE.Vector3(1571, 0.6, -333),
    new THREE.Vector3(1533, 0.8, -294), // Harbour boulevard
    new THREE.Vector3(1494, 1.0, -256),
    new THREE.Vector3(1456, 1.3, -218),
    new THREE.Vector3(1418, 1.5, -180),
    new THREE.Vector3(1380, 1.8, -142),
    new THREE.Vector3(1342, 2.2, -104),
    new THREE.Vector3(1304, 2.5, -66),
    new THREE.Vector3(1266, 2.9, -28),
    new THREE.Vector3(1228, 3.2, 10),
    new THREE.Vector3(1190, 3.6, 48),
    new THREE.Vector3(1152, 3.9, 86),
    new THREE.Vector3(1114, 4.3, 124),
    new THREE.Vector3(1076, 4.6, 162),
    new THREE.Vector3(1072, 4.9, 167), // T7 market chicane left
    new THREE.Vector3(1069, 5.2, 173),
    new THREE.Vector3(1067, 5.5, 178),
    new THREE.Vector3(1067, 5.7, 184),
    new THREE.Vector3(1068, 5.9, 191),
    new THREE.Vector3(1070, 6.1, 196),
    new THREE.Vector3(1078, 6.2, 214), // Market
    new THREE.Vector3(1080, 6.3, 220), // T8 chicane right
    new THREE.Vector3(1081, 6.4, 226),
    new THREE.Vector3(1080, 6.4, 232),
    new THREE.Vector3(1079, 6.4, 238),
    new THREE.Vector3(1076, 6.3, 244),
    new THREE.Vector3(1072, 6.2, 248),
    new THREE.Vector3(1067, 6.1, 252),
    new THREE.Vector3(1062, 6.0, 255),
    new THREE.Vector3(1056, 5.8, 257),
    new THREE.Vector3(1050, 5.6, 257),
    new THREE.Vector3(1044, 5.4, 256),
    new THREE.Vector3(1038, 5.2, 254),
    new THREE.Vector3(1020, 4.9, 246), // Market
    new THREE.Vector3(1014, 4.7, 244), // T9 chicane left
    new THREE.Vector3(1008, 4.5, 243),
    new THREE.Vector3(1002, 4.2, 243),
    new THREE.Vector3(996, 4.0, 245),
    new THREE.Vector3(991, 3.8, 248),
    new THREE.Vector3(986, 3.6, 252),
    new THREE.Vector3(948, 3.4, 290), // Riverside
    new THREE.Vector3(910, 3.3, 328),
    new THREE.Vector3(872, 3.2, 366),
    new THREE.Vector3(834, 3.1, 404),
    new THREE.Vector3(796, 3.0, 442),
    new THREE.Vector3(758, 3.0, 480),
    new THREE.Vector3(720, 3.0, 518),
    new THREE.Vector3(682, 3.1, 556),
    new THREE.Vector3(644, 3.2, 594),
    new THREE.Vector3(606, 3.3, 633),
    new THREE.Vector3(567, 3.5, 671),
    new THREE.Vector3(529, 3.7, 709),
    new THREE.Vector3(491, 3.9, 747),
    new THREE.Vector3(486, 4.1, 751), // T10 bridge right
    new THREE.Vector3(481, 4.4, 754),
    new THREE.Vector3(475, 4.6, 756),
    new THREE.Vector3(469, 4.9, 756),
    new THREE.Vector3(462, 5.2, 756),
    new THREE.Vector3(456, 5.6, 754),
    new THREE.Vector3(451, 5.9, 751),
    new THREE.Vector3(446, 6.2, 747),
    new THREE.Vector3(406, 6.5, 706), // Bridge
    new THREE.Vector3(365, 6.7, 666),
    new THREE.Vector3(325, 7.0, 626),
    new THREE.Vector3(284, 7.2, 585),
    new THREE.Vector3(244, 7.4, 545),
    new THREE.Vector3(204, 7.6, 504),
    new THREE.Vector3(163, 7.7, 464),
    new THREE.Vector3(152, 7.8, 450), // T11 fast right
    new THREE.Vector3(144, 7.9, 435),
    new THREE.Vector3(139, 7.9, 418),
    new THREE.Vector3(137, 7.9, 400),
    new THREE.Vector3(137, 7.9, 345), // Underpass
    new THREE.Vector3(137, 7.8, 290),
    new THREE.Vector3(137, 7.6, 235),
    new THREE.Vector3(137, 7.4, 180),
    new THREE.Vector3(136, 7.2, 169), // T12 left
    new THREE.Vector3(132, 7.0, 157),
    new THREE.Vector3(127, 6.7, 147),
    new THREE.Vector3(119, 6.4, 138),
    new THREE.Vector3(84, 6.0, 103), // Old town
    new THREE.Vector3(49, 5.7, 67),
    new THREE.Vector3(13, 5.3, 32),
    new THREE.Vector3(8, 4.9, 25), // T13 right onto the boulevard
    new THREE.Vector3(3, 4.5, 17),
    new THREE.Vector3(1, 4.1, 9),
    new THREE.Vector3(0, 3.7, 0), // Main boulevard: start/finish
    new THREE.Vector3(0, 3.4, -54),
    new THREE.Vector3(0, 3.0, -107),
    new THREE.Vector3(0, 2.7, -161),
    new THREE.Vector3(0, 2.3, -214),
    new THREE.Vector3(0, 2.1, -268),
    new THREE.Vector3(0, 1.8, -321),
    new THREE.Vector3(0, 1.6, -375),
    new THREE.Vector3(0, 1.4, -429),
    new THREE.Vector3(0, 1.2, -482),
    new THREE.Vector3(0, 1.1, -536)
  ]
};

export const TRACK_4_ALPINE: TrackData = {
  id: 'track_04_alpine',
  name: 'Alpine Ridge Pass',
  type: 'circuit',
  laps: 2,
  roadWidth: 12.0,
  isClosed: true,
  // Drawn in metres (R8)
  scale: 1,
  biome: 'mountain',
  description: 'A 6 km mountain circuit: forest hairpins on dirt, a ridge road, a pine descent and a quarry hairpin.',
  rainChance: 0.45, // mountain weather
  // Forest tracks: the hairpin climb and the pine descent, 33% of the lap
  dirtSections: [[0.128, 0.29], [0.587, 0.758]],
  points: [
    new THREE.Vector3(0, 4.3, -441), // Start/finish line
    new THREE.Vector3(0, 4.7, -496),
    new THREE.Vector3(0, 5.1, -551),
    new THREE.Vector3(0, 5.5, -606),
    new THREE.Vector3(0, 5.8, -662),
    new THREE.Vector3(0, 6.2, -717),
    new THREE.Vector3(1, 6.5, -728), // T1 right at the bridge
    new THREE.Vector3(5, 6.8, -740),
    new THREE.Vector3(10, 7.0, -750),
    new THREE.Vector3(18, 7.2, -759),
    new THREE.Vector3(27, 7.4, -767),
    new THREE.Vector3(37, 7.6, -772),
    new THREE.Vector3(48, 7.7, -775),
    new THREE.Vector3(60, 7.7, -777),
    new THREE.Vector3(117, 7.8, -777), // Lower valley
    new THREE.Vector3(174, 7.8, -777),
    new THREE.Vector3(231, 7.7, -777),
    new THREE.Vector3(289, 7.6, -777),
    new THREE.Vector3(346, 7.5, -777),
    new THREE.Vector3(403, 7.3, -777),
    new THREE.Vector3(460, 7.1, -777),
    new THREE.Vector3(467, 6.9, -777), // T2 forest hairpin left
    new THREE.Vector3(473, 6.6, -779),
    new THREE.Vector3(479, 6.4, -783),
    new THREE.Vector3(485, 6.1, -787),
    new THREE.Vector3(489, 5.8, -792),
    new THREE.Vector3(492, 5.5, -799),
    new THREE.Vector3(494, 5.2, -805),
    new THREE.Vector3(494, 4.9, -812),
    new THREE.Vector3(493, 4.6, -819),
    new THREE.Vector3(491, 4.4, -825),
    new THREE.Vector3(487, 4.1, -831),
    new THREE.Vector3(483, 3.9, -836),
    new THREE.Vector3(477, 3.7, -840),
    new THREE.Vector3(431, 3.5, -867), // Forest climb
    new THREE.Vector3(385, 3.4, -893),
    new THREE.Vector3(338, 3.3, -920),
    new THREE.Vector3(292, 3.2, -947),
    new THREE.Vector3(246, 3.2, -973),
    new THREE.Vector3(200, 3.2, -1000),
    new THREE.Vector3(154, 3.2, -1027),
    new THREE.Vector3(107, 3.3, -1053),
    new THREE.Vector3(61, 3.4, -1080),
    new THREE.Vector3(15, 3.5, -1107),
    new THREE.Vector3(-31, 3.6, -1133),
    new THREE.Vector3(-77, 3.8, -1160),
    new THREE.Vector3(-123, 4.0, -1187),
    new THREE.Vector3(-170, 4.2, -1213),
    new THREE.Vector3(-216, 4.5, -1240),
    new THREE.Vector3(-221, 4.7, -1244), // T3 forest hairpin right
    new THREE.Vector3(-226, 4.9, -1249),
    new THREE.Vector3(-230, 5.2, -1255),
    new THREE.Vector3(-232, 5.4, -1261),
    new THREE.Vector3(-233, 5.7, -1268),
    new THREE.Vector3(-232, 5.9, -1275),
    new THREE.Vector3(-231, 6.1, -1282),
    new THREE.Vector3(-228, 6.2, -1288),
    new THREE.Vector3(-223, 6.4, -1293),
    new THREE.Vector3(-218, 6.5, -1298),
    new THREE.Vector3(-212, 6.6, -1301),
    new THREE.Vector3(-206, 6.6, -1303),
    new THREE.Vector3(-199, 6.6, -1304),
    new THREE.Vector3(-145, 6.6, -1304), // Ridge road
    new THREE.Vector3(-90, 6.5, -1304),
    new THREE.Vector3(-36, 6.4, -1304),
    new THREE.Vector3(18, 6.3, -1304),
    new THREE.Vector3(72, 6.1, -1304),
    new THREE.Vector3(126, 5.9, -1304),
    new THREE.Vector3(181, 5.7, -1304),
    new THREE.Vector3(235, 5.4, -1304),
    new THREE.Vector3(289, 5.1, -1304),
    new THREE.Vector3(343, 4.8, -1304),
    new THREE.Vector3(397, 4.4, -1304),
    new THREE.Vector3(452, 4.1, -1304),
    new THREE.Vector3(506, 3.7, -1304),
    new THREE.Vector3(560, 3.3, -1304),
    new THREE.Vector3(614, 3.0, -1304),
    new THREE.Vector3(669, 2.6, -1304),
    new THREE.Vector3(693, 2.3, -1301), // T4 fast ridge right
    new THREE.Vector3(717, 1.9, -1293),
    new THREE.Vector3(739, 1.6, -1281),
    new THREE.Vector3(758, 1.3, -1264),
    new THREE.Vector3(772, 1.1, -1244),
    new THREE.Vector3(799, 0.9, -1197), // Summit road
    new THREE.Vector3(826, 0.7, -1151),
    new THREE.Vector3(852, 0.5, -1105),
    new THREE.Vector3(879, 0.4, -1059),
    new THREE.Vector3(906, 0.3, -1013),
    new THREE.Vector3(932, 0.3, -966),
    new THREE.Vector3(959, 0.3, -920),
    new THREE.Vector3(986, 0.4, -874),
    new THREE.Vector3(1012, 0.5, -828),
    new THREE.Vector3(1039, 0.6, -782),
    new THREE.Vector3(1066, 0.8, -735),
    new THREE.Vector3(1092, 1.0, -689),
    new THREE.Vector3(1119, 1.3, -643),
    new THREE.Vector3(1146, 1.5, -597),
    new THREE.Vector3(1172, 1.8, -551),
    new THREE.Vector3(1176, 2.2, -544), // T5 into the pines
    new THREE.Vector3(1177, 2.5, -536),
    new THREE.Vector3(1178, 2.9, -528),
    new THREE.Vector3(1176, 3.2, -520),
    new THREE.Vector3(1174, 3.6, -513),
    new THREE.Vector3(1170, 3.9, -506),
    new THREE.Vector3(1164, 4.3, -501),
    new THREE.Vector3(1158, 4.6, -496),
    new THREE.Vector3(1111, 4.9, -469), // Pine descent
    new THREE.Vector3(1063, 5.2, -442),
    new THREE.Vector3(1016, 5.5, -414),
    new THREE.Vector3(969, 5.7, -387),
    new THREE.Vector3(922, 5.9, -360),
    new THREE.Vector3(874, 6.1, -332),
    new THREE.Vector3(827, 6.2, -305),
    new THREE.Vector3(780, 6.3, -278),
    new THREE.Vector3(733, 6.4, -251),
    new THREE.Vector3(685, 6.4, -223),
    new THREE.Vector3(638, 6.4, -196),
    new THREE.Vector3(632, 6.3, -192), // T6 pine hairpin left
    new THREE.Vector3(628, 6.2, -187),
    new THREE.Vector3(624, 6.1, -180),
    new THREE.Vector3(622, 6.0, -174),
    new THREE.Vector3(621, 5.8, -167),
    new THREE.Vector3(622, 5.6, -160),
    new THREE.Vector3(624, 5.4, -153),
    new THREE.Vector3(628, 5.2, -147),
    new THREE.Vector3(632, 4.9, -141),
    new THREE.Vector3(638, 4.7, -137),
    new THREE.Vector3(690, 4.5, -107), // Logging road
    new THREE.Vector3(742, 4.2, -77),
    new THREE.Vector3(794, 4.0, -47),
    new THREE.Vector3(846, 3.8, -17),
    new THREE.Vector3(898, 3.6, 13),
    new THREE.Vector3(904, 3.4, 17), // T7 quarry hairpin
    new THREE.Vector3(909, 3.3, 22),
    new THREE.Vector3(913, 3.2, 29),
    new THREE.Vector3(915, 3.1, 35),
    new THREE.Vector3(916, 3.0, 43),
    new THREE.Vector3(916, 3.0, 50),
    new THREE.Vector3(914, 3.0, 57),
    new THREE.Vector3(910, 3.1, 63),
    new THREE.Vector3(906, 3.2, 69),
    new THREE.Vector3(900, 3.3, 74),
    new THREE.Vector3(894, 3.5, 77),
    new THREE.Vector3(887, 3.7, 79),
    new THREE.Vector3(880, 3.9, 80),
    new THREE.Vector3(827, 4.1, 80), // Quarry straight
    new THREE.Vector3(773, 4.4, 80),
    new THREE.Vector3(720, 4.6, 80),
    new THREE.Vector3(667, 4.9, 80),
    new THREE.Vector3(613, 5.2, 80),
    new THREE.Vector3(560, 5.6, 80),
    new THREE.Vector3(507, 5.9, 80),
    new THREE.Vector3(453, 6.2, 80),
    new THREE.Vector3(400, 6.5, 80),
    new THREE.Vector3(347, 6.7, 80),
    new THREE.Vector3(293, 7.0, 80),
    new THREE.Vector3(240, 7.2, 80),
    new THREE.Vector3(187, 7.4, 80),
    new THREE.Vector3(133, 7.6, 80),
    new THREE.Vector3(80, 7.7, 80),
    new THREE.Vector3(64, 7.8, 78), // T8 right into the valley
    new THREE.Vector3(49, 7.9, 74),
    new THREE.Vector3(36, 7.9, 67),
    new THREE.Vector3(23, 7.9, 57),
    new THREE.Vector3(13, 7.9, 44),
    new THREE.Vector3(6, 7.8, 31),
    new THREE.Vector3(2, 7.6, 16),
    new THREE.Vector3(0, 7.4, 0), // Valley straight: start/finish
    new THREE.Vector3(0, 7.2, -55),
    new THREE.Vector3(0, 7.0, -110),
    new THREE.Vector3(0, 6.7, -165),
    new THREE.Vector3(0, 6.4, -221),
    new THREE.Vector3(0, 6.0, -276),
    new THREE.Vector3(0, 5.7, -331),
    new THREE.Vector3(0, 5.3, -386)
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
    new THREE.Vector3(0, 4.3, 0), // Road start
    new THREE.Vector3(0, 4.7, -54), // Run-up, grid and start line
    new THREE.Vector3(0, 5.1, -109),
    new THREE.Vector3(0, 5.5, -163),
    new THREE.Vector3(0, 5.8, -217),
    new THREE.Vector3(0, 6.2, -271),
    new THREE.Vector3(0, 6.5, -326),
    new THREE.Vector3(0, 6.8, -380),
    new THREE.Vector3(11, 7.0, -521), // Oasis right
    new THREE.Vector3(44, 7.2, -658),
    new THREE.Vector3(61, 7.4, -709), // Oasis straight
    new THREE.Vector3(77, 7.6, -760),
    new THREE.Vector3(93, 7.7, -810),
    new THREE.Vector3(110, 7.7, -861),
    new THREE.Vector3(126, 7.8, -912),
    new THREE.Vector3(143, 7.8, -962),
    new THREE.Vector3(159, 7.7, -1013),
    new THREE.Vector3(176, 7.6, -1064),
    new THREE.Vector3(192, 7.5, -1115),
    new THREE.Vector3(209, 7.3, -1165),
    new THREE.Vector3(225, 7.1, -1216),
    new THREE.Vector3(242, 6.9, -1267),
    new THREE.Vector3(245, 6.6, -1279), // Dune switchback 1 left (sand)
    new THREE.Vector3(245, 6.4, -1292),
    new THREE.Vector3(242, 6.1, -1305),
    new THREE.Vector3(237, 5.8, -1317),
    new THREE.Vector3(229, 5.5, -1327),
    new THREE.Vector3(219, 5.2, -1336),
    new THREE.Vector3(171, 4.9, -1371), // Sand
    new THREE.Vector3(122, 4.6, -1407),
    new THREE.Vector3(114, 4.4, -1414), // Dune switchback 2 right (sand)
    new THREE.Vector3(108, 4.1, -1422),
    new THREE.Vector3(103, 3.9, -1432),
    new THREE.Vector3(100, 3.7, -1442),
    new THREE.Vector3(100, 3.5, -1453),
    new THREE.Vector3(101, 3.4, -1464),
    new THREE.Vector3(104, 3.3, -1474),
    new THREE.Vector3(110, 3.2, -1483),
    new THREE.Vector3(117, 3.2, -1491),
    new THREE.Vector3(125, 3.2, -1498),
    new THREE.Vector3(172, 3.2, -1527), // Sand
    new THREE.Vector3(219, 3.3, -1556),
    new THREE.Vector3(229, 3.4, -1564), // Dune switchback 3 left (sand)
    new THREE.Vector3(237, 3.5, -1573),
    new THREE.Vector3(244, 3.6, -1584),
    new THREE.Vector3(249, 3.8, -1595),
    new THREE.Vector3(251, 4.0, -1608),
    new THREE.Vector3(251, 4.2, -1620),
    new THREE.Vector3(247, 4.5, -1678), // Sand flat
    new THREE.Vector3(243, 4.7, -1736),
    new THREE.Vector3(239, 4.9, -1793),
    new THREE.Vector3(235, 5.2, -1851),
    new THREE.Vector3(231, 5.4, -1909),
    new THREE.Vector3(227, 5.7, -1966),
    new THREE.Vector3(223, 5.9, -2024),
    new THREE.Vector3(219, 6.1, -2081),
    new THREE.Vector3(215, 6.2, -2139),
    new THREE.Vector3(216, 6.4, -2189), // Back onto tarmac, right
    new THREE.Vector3(227, 6.5, -2238),
    new THREE.Vector3(247, 6.6, -2283),
    new THREE.Vector3(275, 6.6, -2324),
    new THREE.Vector3(310, 6.6, -2366), // Mirage straight
    new THREE.Vector3(346, 6.6, -2408),
    new THREE.Vector3(381, 6.5, -2450),
    new THREE.Vector3(416, 6.4, -2492),
    new THREE.Vector3(451, 6.3, -2534),
    new THREE.Vector3(486, 6.1, -2576),
    new THREE.Vector3(521, 5.9, -2617),
    new THREE.Vector3(556, 5.7, -2659),
    new THREE.Vector3(592, 5.4, -2701),
    new THREE.Vector3(627, 5.1, -2743),
    new THREE.Vector3(662, 4.8, -2785),
    new THREE.Vector3(697, 4.4, -2827),
    new THREE.Vector3(732, 4.1, -2869),
    new THREE.Vector3(767, 3.7, -2911),
    new THREE.Vector3(802, 3.3, -2952),
    new THREE.Vector3(807, 3.0, -2959), // Canyon hairpin left
    new THREE.Vector3(810, 2.6, -2967),
    new THREE.Vector3(812, 2.3, -2975),
    new THREE.Vector3(811, 1.9, -2983),
    new THREE.Vector3(810, 1.6, -2991),
    new THREE.Vector3(806, 1.3, -2999),
    new THREE.Vector3(801, 1.1, -3005),
    new THREE.Vector3(795, 0.9, -3011),
    new THREE.Vector3(788, 0.7, -3015),
    new THREE.Vector3(780, 0.5, -3017),
    new THREE.Vector3(729, 0.4, -3028), // Canyon floor
    new THREE.Vector3(678, 0.3, -3039),
    new THREE.Vector3(628, 0.3, -3050),
    new THREE.Vector3(577, 0.3, -3061),
    new THREE.Vector3(526, 0.4, -3071),
    new THREE.Vector3(500, 0.5, -3080), // Canyon exit right
    new THREE.Vector3(476, 0.6, -3093),
    new THREE.Vector3(456, 0.8, -3112),
    new THREE.Vector3(440, 1.0, -3134),
    new THREE.Vector3(429, 1.3, -3158),
    new THREE.Vector3(424, 1.5, -3185),
    new THREE.Vector3(424, 1.8, -3212),
    new THREE.Vector3(429, 2.2, -3239),
    new THREE.Vector3(445, 2.5, -3289), // Rocky pass
    new THREE.Vector3(462, 2.9, -3339),
    new THREE.Vector3(478, 3.2, -3388),
    new THREE.Vector3(494, 3.6, -3438),
    new THREE.Vector3(510, 3.9, -3488),
    new THREE.Vector3(527, 4.3, -3538),
    new THREE.Vector3(543, 4.6, -3588),
    new THREE.Vector3(559, 4.9, -3638),
    new THREE.Vector3(566, 5.2, -3653), // Dune field right (sand)
    new THREE.Vector3(576, 5.5, -3667),
    new THREE.Vector3(588, 5.7, -3678),
    new THREE.Vector3(603, 5.9, -3687),
    new THREE.Vector3(618, 6.1, -3692),
    new THREE.Vector3(667, 6.2, -3702), // Sand
    new THREE.Vector3(716, 6.3, -3712),
    new THREE.Vector3(765, 6.4, -3723),
    new THREE.Vector3(778, 6.4, -3727), // Dune field left (sand)
    new THREE.Vector3(789, 6.4, -3733),
    new THREE.Vector3(799, 6.3, -3742),
    new THREE.Vector3(807, 6.2, -3752),
    new THREE.Vector3(813, 6.1, -3764),
    new THREE.Vector3(816, 6.0, -3776),
    new THREE.Vector3(817, 5.8, -3789),
    new THREE.Vector3(815, 5.6, -3802),
    new THREE.Vector3(803, 5.4, -3851), // Sand
    new THREE.Vector3(790, 5.2, -3899),
    new THREE.Vector3(778, 4.9, -3948),
    new THREE.Vector3(776, 4.7, -3964), // Dune field right (sand)
    new THREE.Vector3(776, 4.5, -3980),
    new THREE.Vector3(780, 4.2, -3996),
    new THREE.Vector3(786, 4.0, -4011),
    new THREE.Vector3(795, 3.8, -4025),
    new THREE.Vector3(828, 3.6, -4067), // Sand
    new THREE.Vector3(860, 3.4, -4109),
    new THREE.Vector3(893, 3.3, -4151),
    new THREE.Vector3(928, 3.2, -4195), // Sandstone arch straight to the finish
    new THREE.Vector3(963, 3.1, -4240),
    new THREE.Vector3(997, 3.0, -4284),
    new THREE.Vector3(1032, 3.0, -4328),
    new THREE.Vector3(1066, 3.0, -4373),
    new THREE.Vector3(1101, 3.1, -4417),
    new THREE.Vector3(1136, 3.2, -4461),
    new THREE.Vector3(1170, 3.3, -4506),
    new THREE.Vector3(1205, 3.5, -4550),
    new THREE.Vector3(1240, 3.7, -4594),
    new THREE.Vector3(1274, 3.9, -4639),
    new THREE.Vector3(1309, 4.1, -4683),
    new THREE.Vector3(1344, 4.4, -4727),
    new THREE.Vector3(1378, 4.6, -4772),
    new THREE.Vector3(1413, 4.9, -4816),
    new THREE.Vector3(1447, 5.2, -4860),
  ]
};

export const TRACK_6_CYBER_DOCKS: TrackData = {
  id: 'track_06_cyber_docks',
  name: 'Cyber Docks Circuit',
  type: 'circuit',
  laps: 3,
  roadWidth: 14.0,
  isClosed: true,
  // Drawn in metres (R8)
  scale: 1,
  biome: 'city',
  description: 'A 6 km port circuit: a quay straight, a crane hairpin, a container chicane, a warehouse hairpin and a swing bridge.',
  rainChance: 0.35,
  points: [
    new THREE.Vector3(0, 4.3, -823), // Start/finish line
    new THREE.Vector3(0, 4.7, -878),
    new THREE.Vector3(0, 5.1, -933),
    new THREE.Vector3(0, 5.5, -988),
    new THREE.Vector3(0, 5.8, -1043),
    new THREE.Vector3(0, 6.2, -1098),
    new THREE.Vector3(0, 6.5, -1152),
    new THREE.Vector3(0, 6.8, -1207),
    new THREE.Vector3(0, 7.0, -1262),
    new THREE.Vector3(0, 7.2, -1317),
    new THREE.Vector3(0, 7.4, -1372),
    new THREE.Vector3(1, 7.6, -1384), // T1 right at the lighthouse
    new THREE.Vector3(5, 7.7, -1395),
    new THREE.Vector3(10, 7.7, -1405),
    new THREE.Vector3(18, 7.8, -1414),
    new THREE.Vector3(27, 7.8, -1422),
    new THREE.Vector3(37, 7.7, -1427),
    new THREE.Vector3(48, 7.6, -1431),
    new THREE.Vector3(60, 7.5, -1432),
    new THREE.Vector3(116, 7.3, -1432), // Sea wall
    new THREE.Vector3(172, 7.1, -1432),
    new THREE.Vector3(228, 6.9, -1432),
    new THREE.Vector3(284, 6.6, -1432),
    new THREE.Vector3(340, 6.4, -1432),
    new THREE.Vector3(396, 6.1, -1432),
    new THREE.Vector3(452, 5.8, -1432),
    new THREE.Vector3(508, 5.5, -1432),
    new THREE.Vector3(564, 5.2, -1432),
    new THREE.Vector3(620, 4.9, -1432),
    new THREE.Vector3(676, 4.6, -1432),
    new THREE.Vector3(732, 4.4, -1432),
    new THREE.Vector3(788, 4.1, -1432),
    new THREE.Vector3(844, 3.9, -1432),
    new THREE.Vector3(900, 3.7, -1432),
    new THREE.Vector3(956, 3.5, -1432),
    new THREE.Vector3(1012, 3.4, -1432),
    new THREE.Vector3(1068, 3.3, -1432),
    new THREE.Vector3(1124, 3.2, -1432),
    new THREE.Vector3(1180, 3.2, -1432),
    new THREE.Vector3(1236, 3.2, -1432),
    new THREE.Vector3(1292, 3.2, -1432),
    new THREE.Vector3(1299, 3.3, -1431), // T2 crane hairpin
    new THREE.Vector3(1305, 3.4, -1429),
    new THREE.Vector3(1311, 3.5, -1426),
    new THREE.Vector3(1317, 3.6, -1422),
    new THREE.Vector3(1321, 3.8, -1416),
    new THREE.Vector3(1324, 4.0, -1410),
    new THREE.Vector3(1326, 4.2, -1403),
    new THREE.Vector3(1326, 4.5, -1397),
    new THREE.Vector3(1325, 4.7, -1390),
    new THREE.Vector3(1323, 4.9, -1383),
    new THREE.Vector3(1319, 5.2, -1378),
    new THREE.Vector3(1315, 5.4, -1373),
    new THREE.Vector3(1309, 5.7, -1369),
    new THREE.Vector3(1264, 5.9, -1342), // Container row
    new THREE.Vector3(1218, 6.1, -1316),
    new THREE.Vector3(1173, 6.2, -1290),
    new THREE.Vector3(1127, 6.4, -1264),
    new THREE.Vector3(1082, 6.5, -1237),
    new THREE.Vector3(1036, 6.6, -1211),
    new THREE.Vector3(991, 6.6, -1185),
    new THREE.Vector3(945, 6.6, -1159),
    new THREE.Vector3(941, 6.6, -1155), // T3 left between the stacks
    new THREE.Vector3(937, 6.5, -1151),
    new THREE.Vector3(934, 6.4, -1146),
    new THREE.Vector3(931, 6.3, -1140),
    new THREE.Vector3(930, 6.1, -1135),
    new THREE.Vector3(931, 5.9, -1129),
    new THREE.Vector3(932, 5.7, -1123),
    new THREE.Vector3(934, 5.4, -1118),
    new THREE.Vector3(963, 5.1, -1069), // Customs road
    new THREE.Vector3(991, 4.8, -1020),
    new THREE.Vector3(1019, 4.4, -971),
    new THREE.Vector3(1047, 4.1, -922),
    new THREE.Vector3(1075, 3.7, -873),
    new THREE.Vector3(1104, 3.3, -825),
    new THREE.Vector3(1132, 3.0, -776),
    new THREE.Vector3(1160, 2.6, -727),
    new THREE.Vector3(1188, 2.3, -678),
    new THREE.Vector3(1216, 1.9, -629),
    new THREE.Vector3(1244, 1.6, -581),
    new THREE.Vector3(1247, 1.3, -575), // T4 container chicane right
    new THREE.Vector3(1248, 1.1, -569),
    new THREE.Vector3(1248, 0.9, -563),
    new THREE.Vector3(1247, 0.7, -543), // Stacks
    new THREE.Vector3(1247, 0.5, -537), // T5 chicane left
    new THREE.Vector3(1248, 0.4, -531),
    new THREE.Vector3(1251, 0.3, -525),
    new THREE.Vector3(1254, 0.3, -521),
    new THREE.Vector3(1259, 0.3, -516),
    new THREE.Vector3(1264, 0.4, -513),
    new THREE.Vector3(1282, 0.5, -505), // Stacks
    new THREE.Vector3(1287, 0.6, -502), // T6 chicane right
    new THREE.Vector3(1292, 0.8, -498),
    new THREE.Vector3(1295, 1.0, -493),
    new THREE.Vector3(1321, 1.3, -448), // Warehouse street
    new THREE.Vector3(1347, 1.5, -404),
    new THREE.Vector3(1372, 1.8, -359),
    new THREE.Vector3(1398, 2.2, -314),
    new THREE.Vector3(1424, 2.5, -270),
    new THREE.Vector3(1450, 2.9, -225),
    new THREE.Vector3(1475, 3.2, -181),
    new THREE.Vector3(1478, 3.6, -175), // T7 warehouse hairpin
    new THREE.Vector3(1479, 3.9, -169),
    new THREE.Vector3(1479, 4.3, -163),
    new THREE.Vector3(1478, 4.6, -157),
    new THREE.Vector3(1475, 4.9, -151),
    new THREE.Vector3(1472, 5.2, -146),
    new THREE.Vector3(1467, 5.5, -142),
    new THREE.Vector3(1461, 5.7, -138),
    new THREE.Vector3(1456, 5.9, -137),
    new THREE.Vector3(1449, 6.1, -136),
    new THREE.Vector3(1393, 6.2, -136), // Rail yard straight
    new THREE.Vector3(1337, 6.3, -136),
    new THREE.Vector3(1281, 6.4, -136),
    new THREE.Vector3(1224, 6.4, -136),
    new THREE.Vector3(1168, 6.4, -136),
    new THREE.Vector3(1112, 6.3, -136),
    new THREE.Vector3(1056, 6.2, -136),
    new THREE.Vector3(999, 6.1, -136),
    new THREE.Vector3(943, 6.0, -136),
    new THREE.Vector3(887, 5.8, -136),
    new THREE.Vector3(831, 5.6, -136),
    new THREE.Vector3(774, 5.4, -136),
    new THREE.Vector3(718, 5.2, -136),
    new THREE.Vector3(662, 4.9, -136),
    new THREE.Vector3(606, 4.7, -136),
    new THREE.Vector3(549, 4.5, -136),
    new THREE.Vector3(511, 4.2, -133), // T8 swing bridge kink
    new THREE.Vector3(474, 4.0, -123),
    new THREE.Vector3(439, 3.8, -106),
    new THREE.Vector3(395, 3.6, -81), // Swing bridge
    new THREE.Vector3(350, 3.4, -55),
    new THREE.Vector3(306, 3.3, -29),
    new THREE.Vector3(261, 3.2, -4),
    new THREE.Vector3(217, 3.1, 22),
    new THREE.Vector3(172, 3.0, 48),
    new THREE.Vector3(128, 3.0, 74),
    new THREE.Vector3(111, 3.0, 81), // T9 long right onto the quay
    new THREE.Vector3(94, 3.1, 85),
    new THREE.Vector3(76, 3.2, 85),
    new THREE.Vector3(59, 3.3, 81),
    new THREE.Vector3(43, 3.5, 74),
    new THREE.Vector3(28, 3.7, 63),
    new THREE.Vector3(16, 3.9, 50),
    new THREE.Vector3(7, 4.1, 35),
    new THREE.Vector3(2, 4.4, 18),
    new THREE.Vector3(0, 4.6, 0), // Quay straight: start/finish
    new THREE.Vector3(0, 4.9, -55),
    new THREE.Vector3(0, 5.2, -110),
    new THREE.Vector3(0, 5.6, -165),
    new THREE.Vector3(0, 5.9, -220),
    new THREE.Vector3(0, 6.2, -274),
    new THREE.Vector3(0, 6.5, -329),
    new THREE.Vector3(0, 6.7, -384),
    new THREE.Vector3(0, 7.0, -439),
    new THREE.Vector3(0, 7.2, -494),
    new THREE.Vector3(0, 7.4, -549),
    new THREE.Vector3(0, 7.6, -604),
    new THREE.Vector3(0, 7.7, -659),
    new THREE.Vector3(0, 7.8, -713),
    new THREE.Vector3(0, 7.9, -768)
  ]
};

export const TRACK_7_STORMY_PASS: TrackData = {
  id: 'track_07_stormy_pass',
  name: 'Stormy Summit Pass',
  type: 'circuit',
  laps: 2,
  roadWidth: 12.0,
  isClosed: true,
  // Drawn in metres (R8)
  scale: 1,
  biome: 'mountain',
  description: 'A 6 km circuit in the storm: a long summit straight, a storm hairpin, cliff esses and an observatory hairpin.',
  rainChance: 1, // always raining
  points: [
    new THREE.Vector3(0, 4.3, -602), // Start/finish line
    new THREE.Vector3(0, 4.7, -657),
    new THREE.Vector3(0, 5.1, -711),
    new THREE.Vector3(0, 5.5, -766),
    new THREE.Vector3(0, 5.8, -821),
    new THREE.Vector3(0, 6.2, -876),
    new THREE.Vector3(0, 6.5, -930),
    new THREE.Vector3(0, 6.8, -985),
    new THREE.Vector3(0, 7.0, -1040),
    new THREE.Vector3(3, 7.2, -1071), // T1 fast right over the crest
    new THREE.Vector3(13, 7.4, -1101),
    new THREE.Vector3(29, 7.6, -1128),
    new THREE.Vector3(50, 7.7, -1151),
    new THREE.Vector3(75, 7.7, -1170),
    new THREE.Vector3(123, 7.8, -1198), // Cloud road
    new THREE.Vector3(171, 7.8, -1225),
    new THREE.Vector3(219, 7.7, -1253),
    new THREE.Vector3(267, 7.6, -1281),
    new THREE.Vector3(316, 7.5, -1309),
    new THREE.Vector3(364, 7.3, -1336),
    new THREE.Vector3(412, 7.1, -1364),
    new THREE.Vector3(460, 6.9, -1392),
    new THREE.Vector3(508, 6.6, -1420),
    new THREE.Vector3(556, 6.4, -1448),
    new THREE.Vector3(604, 6.1, -1475),
    new THREE.Vector3(652, 5.8, -1503),
    new THREE.Vector3(700, 5.5, -1531),
    new THREE.Vector3(749, 5.2, -1559),
    new THREE.Vector3(797, 4.9, -1586),
    new THREE.Vector3(845, 4.6, -1614),
    new THREE.Vector3(893, 4.4, -1642),
    new THREE.Vector3(941, 4.1, -1670),
    new THREE.Vector3(989, 3.9, -1698),
    new THREE.Vector3(1037, 3.7, -1725),
    new THREE.Vector3(1085, 3.5, -1753),
    new THREE.Vector3(1133, 3.4, -1781),
    new THREE.Vector3(1182, 3.3, -1809),
    new THREE.Vector3(1230, 3.2, -1836),
    new THREE.Vector3(1278, 3.2, -1864),
    new THREE.Vector3(1326, 3.2, -1892),
    new THREE.Vector3(1374, 3.2, -1920),
    new THREE.Vector3(1380, 3.3, -1923), // T2 storm hairpin
    new THREE.Vector3(1387, 3.4, -1924),
    new THREE.Vector3(1394, 3.5, -1924),
    new THREE.Vector3(1400, 3.6, -1923),
    new THREE.Vector3(1407, 3.8, -1920),
    new THREE.Vector3(1413, 4.0, -1917),
    new THREE.Vector3(1417, 4.2, -1912),
    new THREE.Vector3(1421, 4.5, -1906),
    new THREE.Vector3(1424, 4.7, -1900),
    new THREE.Vector3(1425, 4.9, -1893),
    new THREE.Vector3(1425, 5.2, -1886),
    new THREE.Vector3(1423, 5.4, -1880),
    new THREE.Vector3(1420, 5.7, -1873),
    new THREE.Vector3(1395, 5.9, -1830), // Cliff road
    new THREE.Vector3(1370, 6.1, -1787),
    new THREE.Vector3(1345, 6.2, -1743),
    new THREE.Vector3(1320, 6.4, -1700),
    new THREE.Vector3(1316, 6.5, -1689), // T3 esses left
    new THREE.Vector3(1313, 6.6, -1678),
    new THREE.Vector3(1313, 6.6, -1666),
    new THREE.Vector3(1314, 6.6, -1655),
    new THREE.Vector3(1325, 6.6, -1616), // Esses
    new THREE.Vector3(1327, 6.5, -1604), // T4 esses right
    new THREE.Vector3(1326, 6.4, -1593),
    new THREE.Vector3(1324, 6.3, -1581),
    new THREE.Vector3(1319, 6.1, -1570),
    new THREE.Vector3(1290, 5.9, -1521), // Rock wall
    new THREE.Vector3(1262, 5.7, -1471),
    new THREE.Vector3(1233, 5.4, -1422),
    new THREE.Vector3(1205, 5.1, -1372),
    new THREE.Vector3(1176, 4.8, -1323),
    new THREE.Vector3(1147, 4.4, -1273),
    new THREE.Vector3(1119, 4.1, -1224),
    new THREE.Vector3(1111, 3.7, -1208), // T5 left round the gully
    new THREE.Vector3(1107, 3.3, -1191),
    new THREE.Vector3(1105, 3.0, -1174),
    new THREE.Vector3(1105, 2.6, -1119), // Gully road
    new THREE.Vector3(1105, 2.3, -1065),
    new THREE.Vector3(1105, 1.9, -1010),
    new THREE.Vector3(1105, 1.6, -956),
    new THREE.Vector3(1105, 1.3, -901),
    new THREE.Vector3(1105, 1.1, -847),
    new THREE.Vector3(1105, 0.9, -792),
    new THREE.Vector3(1105, 0.7, -738),
    new THREE.Vector3(1105, 0.5, -683),
    new THREE.Vector3(1105, 0.4, -629),
    new THREE.Vector3(1105, 0.3, -574),
    new THREE.Vector3(1105, 0.3, -519),
    new THREE.Vector3(1105, 0.3, -465),
    new THREE.Vector3(1105, 0.4, -410),
    new THREE.Vector3(1105, 0.5, -356),
    new THREE.Vector3(1105, 0.6, -301),
    new THREE.Vector3(1105, 0.8, -247),
    new THREE.Vector3(1105, 1.0, -192),
    new THREE.Vector3(1105, 1.3, -138),
    new THREE.Vector3(1105, 1.5, -83),
    new THREE.Vector3(1105, 1.8, -29),
    new THREE.Vector3(1105, 2.2, 26),
    new THREE.Vector3(1105, 2.5, 33), // T6 observatory corner
    new THREE.Vector3(1103, 2.9, 39),
    new THREE.Vector3(1100, 3.2, 45),
    new THREE.Vector3(1095, 3.6, 50),
    new THREE.Vector3(1090, 3.9, 54),
    new THREE.Vector3(1084, 4.3, 57),
    new THREE.Vector3(1078, 4.6, 59),
    new THREE.Vector3(1071, 4.9, 60),
    new THREE.Vector3(1015, 5.2, 60), // Ridge return
    new THREE.Vector3(959, 5.5, 60),
    new THREE.Vector3(903, 5.7, 60),
    new THREE.Vector3(847, 5.9, 60),
    new THREE.Vector3(790, 6.1, 60),
    new THREE.Vector3(734, 6.2, 60),
    new THREE.Vector3(678, 6.3, 60),
    new THREE.Vector3(622, 6.4, 60),
    new THREE.Vector3(566, 6.4, 60),
    new THREE.Vector3(510, 6.4, 60),
    new THREE.Vector3(453, 6.3, 60),
    new THREE.Vector3(397, 6.2, 60),
    new THREE.Vector3(341, 6.1, 60),
    new THREE.Vector3(285, 6.0, 60),
    new THREE.Vector3(229, 5.8, 60),
    new THREE.Vector3(172, 5.6, 60),
    new THREE.Vector3(116, 5.4, 60),
    new THREE.Vector3(60, 5.2, 60),
    new THREE.Vector3(48, 4.9, 59), // T7 right onto the summit
    new THREE.Vector3(37, 4.7, 55),
    new THREE.Vector3(27, 4.5, 50),
    new THREE.Vector3(18, 4.2, 42),
    new THREE.Vector3(10, 4.0, 33),
    new THREE.Vector3(5, 3.8, 23),
    new THREE.Vector3(1, 3.6, 12),
    new THREE.Vector3(0, 3.4, 0), // Summit straight: start/finish
    new THREE.Vector3(0, 3.3, -55),
    new THREE.Vector3(0, 3.2, -109),
    new THREE.Vector3(0, 3.1, -164),
    new THREE.Vector3(0, 3.0, -219),
    new THREE.Vector3(0, 3.0, -274),
    new THREE.Vector3(0, 3.0, -328),
    new THREE.Vector3(0, 3.1, -383),
    new THREE.Vector3(0, 3.2, -438),
    new THREE.Vector3(0, 3.3, -493),
    new THREE.Vector3(0, 3.5, -547)
  ]
};

export const TRACK_8_APEX_FINALE: TrackData = {
  id: 'track_08_apex_finale',
  name: 'Apex Grand Prix Finale',
  type: 'circuit',
  laps: 3,
  roadWidth: 15.0,
  isClosed: true,
  // Drawn in metres (R8)
  scale: 1,
  biome: 'coastal',
  description: 'The 6 km season finale: a 1.5 km Grand Prix straight, a heavy-braking T1, fast esses, a carousel, a stadium section and a last chicane.',
  rainChance: 0.25,
  points: [
    new THREE.Vector3(0, 4.3, -921), // Start/finish line
    new THREE.Vector3(0, 4.7, -975),
    new THREE.Vector3(0, 5.1, -1029),
    new THREE.Vector3(0, 5.5, -1083),
    new THREE.Vector3(0, 5.8, -1137),
    new THREE.Vector3(0, 6.2, -1191),
    new THREE.Vector3(0, 6.5, -1246),
    new THREE.Vector3(0, 6.8, -1300),
    new THREE.Vector3(0, 7.0, -1354),
    new THREE.Vector3(0, 7.2, -1408),
    new THREE.Vector3(0, 7.4, -1462),
    new THREE.Vector3(0, 7.6, -1516),
    new THREE.Vector3(0, 7.7, -1571),
    new THREE.Vector3(1, 7.7, -1578), // T1 heavy-braking right
    new THREE.Vector3(3, 7.8, -1584),
    new THREE.Vector3(6, 7.8, -1591),
    new THREE.Vector3(11, 7.7, -1596),
    new THREE.Vector3(17, 7.6, -1600),
    new THREE.Vector3(23, 7.5, -1603),
    new THREE.Vector3(30, 7.3, -1604),
    new THREE.Vector3(38, 7.1, -1604),
    new THREE.Vector3(45, 6.9, -1603),
    new THREE.Vector3(51, 6.6, -1600),
    new THREE.Vector3(99, 6.4, -1572), // Grandstand run
    new THREE.Vector3(147, 6.1, -1544),
    new THREE.Vector3(195, 5.8, -1517),
    new THREE.Vector3(243, 5.5, -1489),
    new THREE.Vector3(292, 5.2, -1461),
    new THREE.Vector3(340, 4.9, -1433),
    new THREE.Vector3(388, 4.6, -1406),
    new THREE.Vector3(436, 4.4, -1378),
    new THREE.Vector3(484, 4.1, -1350),
    new THREE.Vector3(495, 3.9, -1345), // T2 left
    new THREE.Vector3(508, 3.7, -1342),
    new THREE.Vector3(520, 3.5, -1342),
    new THREE.Vector3(533, 3.4, -1345),
    new THREE.Vector3(544, 3.3, -1350),
    new THREE.Vector3(587, 3.2, -1375), // Short straight
    new THREE.Vector3(631, 3.2, -1400),
    new THREE.Vector3(674, 3.2, -1425),
    new THREE.Vector3(717, 3.2, -1450),
    new THREE.Vector3(736, 3.3, -1459), // T3 fast esses right
    new THREE.Vector3(756, 3.4, -1464),
    new THREE.Vector3(777, 3.5, -1466),
    new THREE.Vector3(798, 3.6, -1464),
    new THREE.Vector3(819, 3.8, -1462), // T4 esses left
    new THREE.Vector3(840, 4.0, -1464),
    new THREE.Vector3(860, 4.2, -1470),
    new THREE.Vector3(879, 4.5, -1479),
    new THREE.Vector3(929, 4.7, -1508), // Back straight
    new THREE.Vector3(980, 4.9, -1537),
    new THREE.Vector3(1030, 5.2, -1566),
    new THREE.Vector3(1081, 5.4, -1595),
    new THREE.Vector3(1131, 5.7, -1624),
    new THREE.Vector3(1182, 5.9, -1654),
    new THREE.Vector3(1218, 6.1, -1670), // T5 the carousel
    new THREE.Vector3(1256, 6.2, -1679),
    new THREE.Vector3(1295, 6.4, -1680),
    new THREE.Vector3(1334, 6.5, -1674),
    new THREE.Vector3(1370, 6.6, -1660),
    new THREE.Vector3(1404, 6.6, -1639),
    new THREE.Vector3(1432, 6.6, -1612),
    new THREE.Vector3(1455, 6.6, -1580),
    new THREE.Vector3(1483, 6.5, -1532), // Marina road
    new THREE.Vector3(1511, 6.4, -1484),
    new THREE.Vector3(1539, 6.3, -1436),
    new THREE.Vector3(1566, 6.1, -1388),
    new THREE.Vector3(1594, 5.9, -1340),
    new THREE.Vector3(1622, 5.7, -1292),
    new THREE.Vector3(1650, 5.4, -1244),
    new THREE.Vector3(1677, 5.1, -1195),
    new THREE.Vector3(1705, 4.8, -1147),
    new THREE.Vector3(1708, 4.4, -1142), // T6 stadium right
    new THREE.Vector3(1709, 4.1, -1135),
    new THREE.Vector3(1709, 3.7, -1129),
    new THREE.Vector3(1708, 3.3, -1123),
    new THREE.Vector3(1706, 3.0, -1117),
    new THREE.Vector3(1703, 2.6, -1112),
    new THREE.Vector3(1699, 2.3, -1107),
    new THREE.Vector3(1693, 1.9, -1104),
    new THREE.Vector3(1650, 1.6, -1079), // Stadium
    new THREE.Vector3(1607, 1.3, -1054),
    new THREE.Vector3(1564, 1.1, -1029),
    new THREE.Vector3(1558, 0.9, -1025), // T7 stadium left
    new THREE.Vector3(1554, 0.7, -1020),
    new THREE.Vector3(1551, 0.5, -1015),
    new THREE.Vector3(1549, 0.4, -1009),
    new THREE.Vector3(1548, 0.3, -1003),
    new THREE.Vector3(1548, 0.3, -997),
    new THREE.Vector3(1549, 0.3, -991),
    new THREE.Vector3(1552, 0.4, -985),
    new THREE.Vector3(1582, 0.5, -933), // Stadium
    new THREE.Vector3(1612, 0.6, -881),
    new THREE.Vector3(1614, 0.8, -875), // T8 stadium right
    new THREE.Vector3(1616, 1.0, -869),
    new THREE.Vector3(1616, 1.3, -863),
    new THREE.Vector3(1615, 1.5, -857),
    new THREE.Vector3(1613, 1.8, -851),
    new THREE.Vector3(1610, 2.2, -845),
    new THREE.Vector3(1605, 2.5, -841),
    new THREE.Vector3(1600, 2.9, -837),
    new THREE.Vector3(1552, 3.2, -809), // Pit straight approach
    new THREE.Vector3(1504, 3.6, -782),
    new THREE.Vector3(1456, 3.9, -754),
    new THREE.Vector3(1408, 4.3, -726),
    new THREE.Vector3(1360, 4.6, -698),
    new THREE.Vector3(1311, 4.9, -671),
    new THREE.Vector3(1263, 5.2, -643),
    new THREE.Vector3(1215, 5.5, -615),
    new THREE.Vector3(1167, 5.7, -587),
    new THREE.Vector3(1162, 5.9, -584), // T9 last chicane left
    new THREE.Vector3(1158, 6.1, -579),
    new THREE.Vector3(1155, 6.2, -574),
    new THREE.Vector3(1147, 6.3, -556), // Chicane
    new THREE.Vector3(1143, 6.4, -551), // T10 chicane right
    new THREE.Vector3(1139, 6.4, -546),
    new THREE.Vector3(1134, 6.4, -543),
    new THREE.Vector3(1129, 6.3, -540),
    new THREE.Vector3(1123, 6.2, -539),
    new THREE.Vector3(1117, 6.1, -539),
    new THREE.Vector3(1097, 6.0, -540), // Chicane
    new THREE.Vector3(1091, 5.8, -540), // T11 chicane left
    new THREE.Vector3(1085, 5.6, -539),
    new THREE.Vector3(1079, 5.4, -536),
    new THREE.Vector3(1031, 5.2, -509), // Harbour front
    new THREE.Vector3(984, 4.9, -481),
    new THREE.Vector3(936, 4.7, -454),
    new THREE.Vector3(888, 4.5, -426),
    new THREE.Vector3(840, 4.2, -398),
    new THREE.Vector3(792, 4.0, -371),
    new THREE.Vector3(744, 3.8, -343),
    new THREE.Vector3(697, 3.6, -316),
    new THREE.Vector3(649, 3.4, -288),
    new THREE.Vector3(601, 3.3, -260),
    new THREE.Vector3(553, 3.2, -233),
    new THREE.Vector3(505, 3.1, -205),
    new THREE.Vector3(458, 3.0, -178),
    new THREE.Vector3(410, 3.0, -150),
    new THREE.Vector3(362, 3.0, -122),
    new THREE.Vector3(314, 3.1, -95),
    new THREE.Vector3(266, 3.2, -67),
    new THREE.Vector3(218, 3.3, -40),
    new THREE.Vector3(171, 3.5, -12),
    new THREE.Vector3(123, 3.7, 16),
    new THREE.Vector3(75, 3.9, 43),
    new THREE.Vector3(65, 4.1, 48), // T12 final right onto the straight
    new THREE.Vector3(55, 4.4, 50),
    new THREE.Vector3(45, 4.6, 50),
    new THREE.Vector3(35, 4.9, 48),
    new THREE.Vector3(25, 5.2, 43),
    new THREE.Vector3(17, 5.6, 37),
    new THREE.Vector3(10, 5.9, 29),
    new THREE.Vector3(4, 6.2, 20),
    new THREE.Vector3(1, 6.5, 10),
    new THREE.Vector3(0, 6.7, 0), // Grand Prix straight: start/finish
    new THREE.Vector3(0, 7.0, -54),
    new THREE.Vector3(0, 7.2, -108),
    new THREE.Vector3(0, 7.4, -162),
    new THREE.Vector3(0, 7.6, -217),
    new THREE.Vector3(0, 7.7, -271),
    new THREE.Vector3(0, 7.8, -325),
    new THREE.Vector3(0, 7.9, -379),
    new THREE.Vector3(0, 7.9, -433),
    new THREE.Vector3(0, 7.9, -487),
    new THREE.Vector3(0, 7.9, -542),
    new THREE.Vector3(0, 7.8, -596),
    new THREE.Vector3(0, 7.6, -650),
    new THREE.Vector3(0, 7.4, -704),
    new THREE.Vector3(0, 7.2, -758),
    new THREE.Vector3(0, 7.0, -812),
    new THREE.Vector3(0, 6.7, -867)
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
