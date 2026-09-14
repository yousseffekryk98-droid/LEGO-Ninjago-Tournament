export type CombatStyle = 'balanced' | 'speed' | 'heavy' | 'ranged';

export interface CharacterDef {
  id: string;
  name: string;
  element: string;
  style: CombatStyle;
  color: number;
  accent: number;
  speed: number;
  damage: number;
  maxHealth: number;
  cost: number;
  unlockedByDefault?: boolean;
}

// Clean-room gameplay data only. Visuals are generated procedurally at runtime.
export const ROSTER: CharacterDef[] = [
  { id: 'lloyd-tournament', name: 'Lloyd (Tournament)', element: 'Energy', style: 'balanced', color: 0x28a745, accent: 0xd8c66a, speed: 5.7, damage: 20, maxHealth: 4, cost: 0, unlockedByDefault: true },
  { id: 'kai-tournament', name: 'Kai (Tournament)', element: 'Fire', style: 'balanced', color: 0xc62828, accent: 0xf5a623, speed: 5.8, damage: 21, maxHealth: 4, cost: 0, unlockedByDefault: true },
  { id: 'jay-tournament', name: 'Jay (Tournament)', element: 'Lightning', style: 'speed', color: 0x1d5fbf, accent: 0xf4d03f, speed: 6.5, damage: 17, maxHealth: 4, cost: 0, unlockedByDefault: true },
  { id: 'cole-tournament', name: 'Cole (Tournament)', element: 'Earth', style: 'heavy', color: 0x202124, accent: 0xd9822b, speed: 5.0, damage: 26, maxHealth: 5, cost: 0, unlockedByDefault: true },
  { id: 'zane-techno', name: 'Zane (Techno)', element: 'Ice', style: 'ranged', color: 0xe7ecef, accent: 0x7fd8ff, speed: 5.5, damage: 19, maxHealth: 4, cost: 4500 },
  { id: 'nya', name: 'Nya', element: 'Water', style: 'speed', color: 0x7c1f2a, accent: 0x71d7ff, speed: 6.2, damage: 18, maxHealth: 4, cost: 6000 },
  { id: 'samurai-x', name: 'Samurai X', element: 'Samurai', style: 'heavy', color: 0xa71930, accent: 0xd7b557, speed: 5.1, damage: 25, maxHealth: 5, cost: 9000 },
  { id: 'master-garmadon', name: 'Master Garmadon', element: 'Creation', style: 'balanced', color: 0x2b2d31, accent: 0xe5dfc7, speed: 5.6, damage: 22, maxHealth: 5, cost: 12000 },
  { id: 'ash', name: 'Ash', element: 'Smoke', style: 'speed', color: 0x55575d, accent: 0xbcc1c7, speed: 6.8, damage: 16, maxHealth: 4, cost: 8000 },
  { id: 'karlof', name: 'Karlof', element: 'Metal', style: 'heavy', color: 0x6c7177, accent: 0xb5b8ba, speed: 4.6, damage: 30, maxHealth: 6, cost: 10000 },
  { id: 'paleman', name: 'Paleman', element: 'Light', style: 'ranged', color: 0xe9e1c4, accent: 0xfff4a5, speed: 5.7, damage: 18, maxHealth: 4, cost: 8500 },
  { id: 'skylor', name: 'Skylor', element: 'Amber', style: 'balanced', color: 0xd56b1f, accent: 0xffc04d, speed: 6.0, damage: 20, maxHealth: 4, cost: 9500 },
  { id: 'shade', name: 'Shade', element: 'Shadow', style: 'speed', color: 0x171820, accent: 0x744d91, speed: 6.7, damage: 18, maxHealth: 4, cost: 9000 },
  { id: 'chamille', name: 'Chamille', element: 'Form', style: 'balanced', color: 0x6b8d45, accent: 0xcf7aa4, speed: 5.9, damage: 19, maxHealth: 4, cost: 7000 },
  { id: 'griffin-turner', name: 'Griffin Turner', element: 'Speed', style: 'speed', color: 0x355c8a, accent: 0xff6e40, speed: 7.4, damage: 15, maxHealth: 4, cost: 11000 },
  { id: 'neuro', name: 'Neuro', element: 'Mind', style: 'ranged', color: 0x5b2c83, accent: 0x73e0d1, speed: 5.4, damage: 20, maxHealth: 4, cost: 10000 },
  { id: 'min-droid', name: 'Min-Droid', element: 'Nindroid', style: 'ranged', color: 0x20242a, accent: 0xc9292d, speed: 5.8, damage: 22, maxHealth: 5, cost: 13000 },
  { id: 'pythor', name: 'Pythor', element: 'Serpentine', style: 'speed', color: 0x6b4b8a, accent: 0xf2e6c4, speed: 6.6, damage: 19, maxHealth: 5, cost: 14000 },
  { id: 'dareth', name: 'Dareth', element: 'Brown Power', style: 'balanced', color: 0x7a4d24, accent: 0xd8b36d, speed: 5.2, damage: 14, maxHealth: 4, cost: 2500 },
  { id: 'samukai', name: 'Samukai', element: 'Skulkin', style: 'speed', color: 0xe7e2d9, accent: 0x7d6a58, speed: 6.9, damage: 23, maxHealth: 3, cost: 15000 }
];

export const findCharacter = (id: string) => ROSTER.find((c) => c.id === id) ?? ROSTER[0];
