export interface AIDriverProfile {
  id: string;
  name: string;
  team: string;
  colorHex: number;
  secondaryColorHex: number;
  skill: number; // 0.92 to 1.02 speed multiplier
  aggression: number; // 0.0 to 1.0 (overtaking and draft seeking)
  preferredLateralOffset: number; // -4.0 to +4.0 meters from centerline
  terrainAffinity: 'asphalt' | 'gravel' | 'wet';
}

export const AI_DRIVER_ROSTER: AIDriverProfile[] = [
  {
    id: 'ai_01_vance',
    name: 'Marcus Vance',
    team: 'Apex Velocity Racing',
    colorHex: 0xef4444, // Crimson Red
    secondaryColorHex: 0x111827,
    skill: 1.02,
    aggression: 0.9,
    preferredLateralOffset: -1.8,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_02_rostova',
    name: 'Elena Rostova',
    team: 'Nordic Sprint Tech',
    colorHex: 0x3b82f6, // Cobalt Blue
    secondaryColorHex: 0xffffff,
    skill: 1.01,
    aggression: 0.75,
    preferredLateralOffset: 1.5,
    terrainAffinity: 'wet'
  },
  {
    id: 'ai_03_chen',
    name: 'Silvia Chen',
    team: 'Quantum Drift Works',
    colorHex: 0xa855f7, // Cyber Purple
    secondaryColorHex: 0x00f0ff,
    skill: 1.00,
    aggression: 0.8,
    preferredLateralOffset: -2.5,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_04_cole',
    name: 'Devon Cole',
    team: 'Solaria Solar GP',
    colorHex: 0xeab308, // Sunlit Amber
    secondaryColorHex: 0x1e293b,
    skill: 0.99,
    aggression: 0.85,
    preferredLateralOffset: 2.2,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_05_okafor',
    name: 'Tariq Okafor',
    team: 'Sahara Dune Motorsport',
    colorHex: 0xf97316, // Desert Orange
    secondaryColorHex: 0x7c2d12,
    skill: 0.98,
    aggression: 0.7,
    preferredLateralOffset: 0.0,
    terrainAffinity: 'gravel'
  },
  {
    id: 'ai_06_sato',
    name: 'Kenji Sato',
    team: 'Neo-Tokyo Overdrive',
    colorHex: 0xec4899, // Neon Pink
    secondaryColorHex: 0x0f172a,
    skill: 0.98,
    aggression: 0.92,
    preferredLateralOffset: -3.2,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_07_dupont',
    name: 'Camille Dupont',
    team: 'Aero Dynamic Alpine',
    colorHex: 0x06b6d4, // Cyan Sky
    secondaryColorHex: 0x164e63,
    skill: 0.97,
    aggression: 0.65,
    preferredLateralOffset: 3.0,
    terrainAffinity: 'wet'
  },
  {
    id: 'ai_08_alvarez',
    name: 'Mateo Alvarez',
    team: 'Monza Corsair Racing',
    colorHex: 0x22c55e, // Emerald Green
    secondaryColorHex: 0x14532d,
    skill: 0.97,
    aggression: 0.88,
    preferredLateralOffset: -1.2,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_09_novak',
    name: 'Lukas Novak',
    team: 'Ironclad Rallye',
    colorHex: 0x64748b, // Slate Carbon
    secondaryColorHex: 0x38bdf8,
    skill: 0.96,
    aggression: 0.78,
    preferredLateralOffset: 2.8,
    terrainAffinity: 'gravel'
  },
  {
    id: 'ai_10_keller',
    name: 'Soren Keller',
    team: 'Vanguard Dynamics',
    colorHex: 0x14b8a6, // Seafoam Teal
    secondaryColorHex: 0x042f2e,
    skill: 0.96,
    aggression: 0.6,
    preferredLateralOffset: -0.8,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_11_lindqvist',
    name: 'Freja Lindqvist',
    team: 'Aurora Borealis GP',
    colorHex: 0x8b5cf6, // Violet Frost
    secondaryColorHex: 0xede9fe,
    skill: 0.95,
    aggression: 0.72,
    preferredLateralOffset: 1.8,
    terrainAffinity: 'wet'
  },
  {
    id: 'ai_12_morales',
    name: 'Sofia Morales',
    team: 'Tierra Fuego Motors',
    colorHex: 0xd97706, // Ochre Flame
    secondaryColorHex: 0x451a03,
    skill: 0.95,
    aggression: 0.82,
    preferredLateralOffset: -2.0,
    terrainAffinity: 'gravel'
  },
  {
    id: 'ai_13_tanaka',
    name: 'Hiroshi Tanaka',
    team: 'Rising Sun Precision',
    colorHex: 0xdc2626, // Crimson Sun
    secondaryColorHex: 0xffffff,
    skill: 0.94,
    aggression: 0.55,
    preferredLateralOffset: 3.5,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_14_jensen',
    name: 'Astrid Jensen',
    team: 'Nordic Horizon',
    colorHex: 0x0284c7, // Deep Azure
    secondaryColorHex: 0xbae6fd,
    skill: 0.94,
    aggression: 0.68,
    preferredLateralOffset: -3.5,
    terrainAffinity: 'wet'
  },
  {
    id: 'ai_15_diallo',
    name: 'Amara Diallo',
    team: 'Equator GP',
    colorHex: 0x10b981, // Mint Jade
    secondaryColorHex: 0x064e3b,
    skill: 0.93,
    aggression: 0.75,
    preferredLateralOffset: 0.8,
    terrainAffinity: 'gravel'
  },
  {
    id: 'ai_16_richter',
    name: 'Maximilian Richter',
    team: 'Bavaria Motor Werks',
    colorHex: 0x475569, // Steel Gunmetal
    secondaryColorHex: 0x94a3b8,
    skill: 0.93,
    aggression: 0.62,
    preferredLateralOffset: -1.5,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_17_patel',
    name: 'Aarav Patel',
    team: 'Deccan Apex Team',
    colorHex: 0xf59e0b, // Marigold Gold
    secondaryColorHex: 0x78350f,
    skill: 0.92,
    aggression: 0.8,
    preferredLateralOffset: 2.0,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_18_rossi',
    name: 'Gianna Rossi',
    team: 'Scuderia Veloce',
    colorHex: 0xb91c1c, // Scuderia Red
    secondaryColorHex: 0xfef08a,
    skill: 0.92,
    aggression: 0.9,
    preferredLateralOffset: -2.8,
    terrainAffinity: 'asphalt'
  },
  {
    id: 'ai_19_bekele',
    name: 'Dawit Bekele',
    team: 'Highland Endurance',
    colorHex: 0x84cc16, // Lime Surge
    secondaryColorHex: 0x1a2e05,
    skill: 0.92,
    aggression: 0.7,
    preferredLateralOffset: 1.2,
    terrainAffinity: 'gravel'
  }
];
