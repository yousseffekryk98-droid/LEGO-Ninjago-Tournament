export type CombatStyle = 'balanced' | 'speed' | 'heavy' | 'ranged';
export type SpecialType = 'spinjitzu' | 'boost' | 'charge' | 'overload' | 'airstrike' | 'toxic-cloud' | 'shout';

export interface CharacterDef {
  id: string;
  name: string;
  element: string;
  style: CombatStyle;
  special: SpecialType;
  color: number;
  accent: number;
  speed: number;
  damage: number;
  maxHealth: number;
  cost: number;
  unlockedByDefault?: boolean;
}

// Clean-room gameplay data only. Names/variants are drawn from public reference lists;
// combat values are new balancing values for this fan remake and are not extracted from the original game.
export const ROSTER: CharacterDef[] = [
  { id: 'lloyd-tournament', name: 'Lloyd (Tournament)', element: 'Energy', style: 'balanced', special: 'spinjitzu', color: 0x28a745, accent: 0xd8c66a, speed: 5.7, damage: 20, maxHealth: 4, cost: 0, unlockedByDefault: true },
  { id: 'kai-tournament', name: 'Kai (Tournament)', element: 'Fire', style: 'balanced', special: 'spinjitzu', color: 0xc62828, accent: 0xf5a623, speed: 5.8, damage: 21, maxHealth: 4, cost: 0, unlockedByDefault: true },
  { id: 'jay-tournament', name: 'Jay (Tournament)', element: 'Lightning', style: 'speed', special: 'spinjitzu', color: 0x1d5fbf, accent: 0xf4d03f, speed: 6.5, damage: 17, maxHealth: 4, cost: 0, unlockedByDefault: true },
  { id: 'cole-tournament', name: 'Cole (Tournament)', element: 'Earth', style: 'heavy', special: 'spinjitzu', color: 0x202124, accent: 0xd9822b, speed: 5.0, damage: 26, maxHealth: 5, cost: 0, unlockedByDefault: true },

  { id: 'lloyd-techno', name: 'Lloyd (Techno)', element: 'Energy', style: 'balanced', special: 'overload', color: 0x339b55, accent: 0xb7c9d3, speed: 5.9, damage: 21, maxHealth: 4, cost: 5000 },
  { id: 'lloyd-jungle', name: 'Lloyd (Jungle)', element: 'Energy', style: 'speed', special: 'boost', color: 0x2f8d49, accent: 0x634126, speed: 6.2, damage: 19, maxHealth: 4, cost: 7000 },
  { id: 'lloyd-garmadon', name: 'Lloyd Garmadon', element: 'Energy', style: 'balanced', special: 'spinjitzu', color: 0x2da456, accent: 0x171a1d, speed: 6.0, damage: 22, maxHealth: 5, cost: 14000 },

  { id: 'kai-teacher', name: 'Kai (Teacher)', element: 'Fire', style: 'balanced', special: 'shout', color: 0xb9322f, accent: 0xd8c69a, speed: 5.5, damage: 20, maxHealth: 4, cost: 3500 },
  { id: 'kai-jungle', name: 'Kai (Jungle)', element: 'Fire', style: 'speed', special: 'charge', color: 0xbe2f29, accent: 0x5f4028, speed: 6.2, damage: 20, maxHealth: 4, cost: 6500 },
  { id: 'kai-techno', name: 'Kai (Techno)', element: 'Fire', style: 'balanced', special: 'overload', color: 0xc5322f, accent: 0x9da5a8, speed: 5.8, damage: 22, maxHealth: 4, cost: 7500 },
  { id: 'kai-dx', name: 'Kai DX', element: 'Fire', style: 'speed', special: 'spinjitzu', color: 0xb52226, accent: 0xd8b640, speed: 6.3, damage: 22, maxHealth: 4, cost: 10500 },

  { id: 'cole-zukin', name: 'Cole (Jungle)', element: 'Earth', style: 'heavy', special: 'charge', color: 0x242629, accent: 0x6d4a2e, speed: 5.2, damage: 28, maxHealth: 5, cost: 7000 },
  { id: 'jay-zx', name: 'Jay ZX', element: 'Lightning', style: 'speed', special: 'overload', color: 0x2761b8, accent: 0xd6c8ae, speed: 6.8, damage: 18, maxHealth: 4, cost: 9500 },

  { id: 'zane-techno', name: 'Zane (Techno)', element: 'Ice', style: 'ranged', special: 'overload', color: 0xe7ecef, accent: 0x7fd8ff, speed: 5.5, damage: 19, maxHealth: 4, cost: 4500 },
  { id: 'zane-pink', name: 'Pink Zane', element: 'Ice', style: 'balanced', special: 'spinjitzu', color: 0xd995bd, accent: 0xf3f5f6, speed: 5.7, damage: 19, maxHealth: 4, cost: 5500 },
  { id: 'zane-zx', name: 'Zane ZX', element: 'Ice', style: 'ranged', special: 'airstrike', color: 0xe4e8ea, accent: 0xbecbd2, speed: 5.6, damage: 21, maxHealth: 4, cost: 10000 },
  { id: 'zane-teacher', name: 'Zane (Teacher)', element: 'Ice', style: 'balanced', special: 'shout', color: 0xe5e7e5, accent: 0xc9a871, speed: 5.3, damage: 18, maxHealth: 4, cost: 3000 },

  { id: 'nya', name: 'Nya', element: 'Water', style: 'speed', special: 'charge', color: 0x7c1f2a, accent: 0x71d7ff, speed: 6.2, damage: 18, maxHealth: 4, cost: 6000 },
  { id: 'samurai-x', name: 'Samurai X', element: 'Samurai', style: 'heavy', special: 'overload', color: 0xa71930, accent: 0xd7b557, speed: 5.1, damage: 25, maxHealth: 5, cost: 9000 },
  { id: 'pixal', name: 'P.I.X.A.L.', element: 'Nindroid', style: 'ranged', special: 'overload', color: 0x9a2a45, accent: 0xd9dce0, speed: 5.8, damage: 21, maxHealth: 4, cost: 11500 },

  { id: 'master-garmadon', name: 'Master Garmadon', element: 'Creation', style: 'balanced', special: 'spinjitzu', color: 0x2b2d31, accent: 0xe5dfc7, speed: 5.6, damage: 22, maxHealth: 5, cost: 12000 },
  { id: 'garmadon-robes', name: 'Garmadon (Robes)', element: 'Creation', style: 'heavy', special: 'shout', color: 0x1e2023, accent: 0xd9c79a, speed: 5.0, damage: 27, maxHealth: 6, cost: 15000 },

  { id: 'ash', name: 'Ash', element: 'Smoke', style: 'speed', special: 'boost', color: 0x55575d, accent: 0xbcc1c7, speed: 6.8, damage: 16, maxHealth: 4, cost: 8000 },
  { id: 'karlof', name: 'Karlof', element: 'Metal', style: 'heavy', special: 'charge', color: 0x6c7177, accent: 0xb5b8ba, speed: 4.6, damage: 30, maxHealth: 6, cost: 10000 },
  { id: 'paleman', name: 'Mr. Pale', element: 'Light', style: 'ranged', special: 'boost', color: 0xe9e1c4, accent: 0xfff4a5, speed: 5.7, damage: 18, maxHealth: 4, cost: 8500 },
  { id: 'skylor', name: 'Skylor', element: 'Amber', style: 'balanced', special: 'spinjitzu', color: 0xd56b1f, accent: 0xffc04d, speed: 6.0, damage: 20, maxHealth: 4, cost: 9500 },
  { id: 'shade', name: 'Shade', element: 'Shadow', style: 'speed', special: 'boost', color: 0x171820, accent: 0x744d91, speed: 6.7, damage: 18, maxHealth: 4, cost: 9000 },
  { id: 'chamille', name: 'Chamille', element: 'Form', style: 'balanced', special: 'boost', color: 0x6b8d45, accent: 0xcf7aa4, speed: 5.9, damage: 19, maxHealth: 4, cost: 7000 },
  { id: 'griffin-turner', name: 'Griffin Turner', element: 'Speed', style: 'speed', special: 'boost', color: 0x355c8a, accent: 0xff6e40, speed: 7.4, damage: 15, maxHealth: 4, cost: 11000 },
  { id: 'neuro', name: 'Neuro', element: 'Mind', style: 'ranged', special: 'shout', color: 0x5b2c83, accent: 0x73e0d1, speed: 5.4, damage: 20, maxHealth: 4, cost: 10000 },

  { id: 'clouse', name: 'Clouse', element: 'Dark Magic', style: 'ranged', special: 'toxic-cloud', color: 0x3a2d46, accent: 0xb4252d, speed: 5.2, damage: 23, maxHealth: 5, cost: 13000 },
  { id: 'clouse-robe', name: 'Clouse (Robe)', element: 'Dark Magic', style: 'ranged', special: 'airstrike', color: 0x2f2638, accent: 0xd7c49c, speed: 5.0, damage: 24, maxHealth: 5, cost: 15000 },
  { id: 'chope-anacondrai', name: "Chope'rai", element: 'Anacondrai', style: 'speed', special: 'charge', color: 0x63334f, accent: 0xe0b35d, speed: 6.3, damage: 20, maxHealth: 5, cost: 10500 },
  { id: 'eyezor', name: 'Eyezor', element: 'Anacondrai', style: 'heavy', special: 'shout', color: 0x563246, accent: 0xc89a45, speed: 5.0, damage: 27, maxHealth: 5, cost: 11500 },
  { id: 'silvereye', name: 'Silvereye Anacondrai', element: 'Anacondrai', style: 'balanced', special: 'charge', color: 0x6d4b65, accent: 0xd8d8d8, speed: 5.9, damage: 22, maxHealth: 5, cost: 12000 },
  { id: 'zugu', name: 'Zugu', element: 'Cultist', style: 'heavy', special: 'charge', color: 0x5a2630, accent: 0xbb8b44, speed: 4.8, damage: 28, maxHealth: 6, cost: 9000 },

  { id: 'min-droid', name: 'Min-Droid', element: 'Nindroid', style: 'ranged', special: 'overload', color: 0x20242a, accent: 0xc9292d, speed: 5.8, damage: 22, maxHealth: 5, cost: 13000 },
  { id: 'pythor', name: 'Pythor', element: 'Serpentine', style: 'speed', special: 'toxic-cloud', color: 0x6b4b8a, accent: 0xf2e6c4, speed: 6.6, damage: 19, maxHealth: 5, cost: 14000 },
  { id: 'acidicus', name: 'Acidicus', element: 'Venomari', style: 'ranged', special: 'toxic-cloud', color: 0x4f7d42, accent: 0xe6cc4b, speed: 5.6, damage: 20, maxHealth: 5, cost: 12500 },
  { id: 'stone-army-scout', name: 'Stone Army Scout', element: 'Stone Army', style: 'heavy', special: 'charge', color: 0x3b3d40, accent: 0xc64031, speed: 4.7, damage: 29, maxHealth: 6, cost: 12000 },
  { id: 'samukai', name: 'Samukai', element: 'Skulkin', style: 'speed', special: 'shout', color: 0xe7e2d9, accent: 0x7d6a58, speed: 6.9, damage: 23, maxHealth: 3, cost: 15000 },
  { id: 'kruncha', name: 'Kruncha', element: 'Skulkin', style: 'heavy', special: 'charge', color: 0xe5dfd2, accent: 0x626a70, speed: 4.9, damage: 27, maxHealth: 5, cost: 9000 },
  { id: 'dareth', name: 'Dareth', element: 'Brown Power', style: 'balanced', special: 'shout', color: 0x7a4d24, accent: 0xd8b36d, speed: 5.2, damage: 14, maxHealth: 4, cost: 2500 }
];

export const findCharacter = (id: string) => ROSTER.find((c) => c.id === id) ?? ROSTER[0];
