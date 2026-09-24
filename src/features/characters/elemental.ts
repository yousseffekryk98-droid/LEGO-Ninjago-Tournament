export type ElementKickEffect =
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'earth'
  | 'energy'
  | 'water'
  | 'poison'
  | 'wind'
  | 'light'
  | 'mind'
  | 'metal'
  | 'shadow'
  | 'force';

export interface ElementCombatTheme {
  icon: string;
  color: number;
  accent: number;
  effect: ElementKickEffect;
}

const THEMES: Record<string, ElementCombatTheme> = {
  Fire: { icon: '🔥', color: 0xe34527, accent: 0xffb12f, effect: 'fire' },
  Ice: { icon: '❄', color: 0x9ee8ff, accent: 0xeafaff, effect: 'ice' },
  Lightning: { icon: '⚡', color: 0x3f7dff, accent: 0xffe76a, effect: 'lightning' },
  Earth: { icon: '◆', color: 0x6b4b2a, accent: 0xd58b37, effect: 'earth' },
  Energy: { icon: '✦', color: 0x35c85a, accent: 0xd7ef65, effect: 'energy' },
  Water: { icon: '◉', color: 0x35a9e8, accent: 0x8cecff, effect: 'water' },
  Poison: { icon: '☠', color: 0x75a83f, accent: 0xc1e85a, effect: 'poison' },
  Venomari: { icon: '☠', color: 0x75a83f, accent: 0xc1e85a, effect: 'poison' },
  Smoke: { icon: '≈', color: 0x8d8b91, accent: 0xd3d0d8, effect: 'wind' },
  Speed: { icon: '»', color: 0xe78b31, accent: 0xffdf75, effect: 'wind' },
  Light: { icon: '☀', color: 0xf0d467, accent: 0xffffff, effect: 'light' },
  Mind: { icon: '◎', color: 0x825dd7, accent: 0xcbb4ff, effect: 'mind' },
  Metal: { icon: '⬢', color: 0x7d858d, accent: 0xd1d6db, effect: 'metal' },
  'Stone Army': { icon: '⬢', color: 0x686d72, accent: 0xb5b9bd, effect: 'metal' },
  Shadow: { icon: '◐', color: 0x3c2f53, accent: 0x9b7cc5, effect: 'shadow' },
  Creation: { icon: '✹', color: 0xd0a441, accent: 0xffe28a, effect: 'energy' },
  Amber: { icon: '◇', color: 0xd38a2f, accent: 0xffc66d, effect: 'energy' },
  Nindroid: { icon: '⚙', color: 0x5ec6e8, accent: 0xd7f7ff, effect: 'lightning' },
  Anacondrai: { icon: '◈', color: 0x8d4778, accent: 0xcd8ab7, effect: 'poison' },
  Constrictai: { icon: '◈', color: 0x8b5b35, accent: 0xd1a066, effect: 'earth' },
  Hypnobrai: { icon: '◎', color: 0x5578af, accent: 0xaecbf1, effect: 'mind' },
  Serpentine: { icon: '◈', color: 0x6f9542, accent: 0xb8d873, effect: 'poison' },
  Skulkin: { icon: '☠', color: 0xbab2a5, accent: 0xf1eadb, effect: 'force' },
  'Dark Magic': { icon: '✦', color: 0x6b3b83, accent: 0xba79db, effect: 'shadow' },
  'Staff of Elements': { icon: '✹', color: 0xc79736, accent: 0xffda72, effect: 'force' },
  Form: { icon: '◇', color: 0x8d649f, accent: 0xd4a9e3, effect: 'force' },
  Samurai: { icon: '⚔', color: 0x8f2931, accent: 0xd6ae4c, effect: 'metal' },
  Cultist: { icon: '◈', color: 0x743047, accent: 0xc77a94, effect: 'shadow' },
  'Brown Power': { icon: '◆', color: 0x7a5737, accent: 0xd0a16f, effect: 'earth' }
};

export function getElementCombatTheme(element: string): ElementCombatTheme {
  return THEMES[element] ?? { icon: '✦', color: 0x9a6ac0, accent: 0xe0c3f2, effect: 'force' };
}
