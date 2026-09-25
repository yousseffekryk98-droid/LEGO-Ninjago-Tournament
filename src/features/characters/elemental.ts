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
  | 'sound'
  | 'nature'
  | 'gravity'
  | 'force';

export type ElementParticleShape =
  | 'ember'
  | 'ice-shard'
  | 'spark'
  | 'rock'
  | 'orb'
  | 'droplet'
  | 'toxic-cloud'
  | 'wind-streak'
  | 'metal-shard'
  | 'shadow-wisp'
  | 'sound-wave'
  | 'leaf'
  | 'gravity-orb';

export type ElementTrailStyle =
  | 'flame'
  | 'frost'
  | 'arc'
  | 'debris'
  | 'energy'
  | 'flow'
  | 'toxic'
  | 'gust'
  | 'radiant'
  | 'psychic'
  | 'metal'
  | 'smoke'
  | 'resonance'
  | 'vine'
  | 'orbit'
  | 'force';

export interface ElementCombatTheme {
  icon: string;
  color: number;
  accent: number;
  effect: ElementKickEffect;
  particleShape: ElementParticleShape;
  trailStyle: ElementTrailStyle;
  impactStyle: 'burst' | 'shatter' | 'shock' | 'slam' | 'splash' | 'cloud' | 'pulse' | 'blink';
  groundStyle: 'scorch' | 'frost' | 'crack' | 'ripple' | 'mist' | 'glow' | 'shadow' | 'none';
  lightIntensity: number;
}

type BaseTheme = Pick<ElementCombatTheme, 'icon' | 'color' | 'accent' | 'effect'>;
type VisualTheme = Omit<ElementCombatTheme, keyof BaseTheme>;

const VISUALS: Record<ElementKickEffect, VisualTheme> = {
  fire: { particleShape: 'ember', trailStyle: 'flame', impactStyle: 'burst', groundStyle: 'scorch', lightIntensity: 2.8 },
  ice: { particleShape: 'ice-shard', trailStyle: 'frost', impactStyle: 'shatter', groundStyle: 'frost', lightIntensity: 2.2 },
  lightning: { particleShape: 'spark', trailStyle: 'arc', impactStyle: 'shock', groundStyle: 'glow', lightIntensity: 3.2 },
  earth: { particleShape: 'rock', trailStyle: 'debris', impactStyle: 'slam', groundStyle: 'crack', lightIntensity: 0.8 },
  energy: { particleShape: 'orb', trailStyle: 'energy', impactStyle: 'pulse', groundStyle: 'glow', lightIntensity: 2.7 },
  water: { particleShape: 'droplet', trailStyle: 'flow', impactStyle: 'splash', groundStyle: 'ripple', lightIntensity: 1.8 },
  poison: { particleShape: 'toxic-cloud', trailStyle: 'toxic', impactStyle: 'cloud', groundStyle: 'mist', lightIntensity: 1.5 },
  wind: { particleShape: 'wind-streak', trailStyle: 'gust', impactStyle: 'pulse', groundStyle: 'none', lightIntensity: 1.2 },
  light: { particleShape: 'orb', trailStyle: 'radiant', impactStyle: 'pulse', groundStyle: 'glow', lightIntensity: 3.0 },
  mind: { particleShape: 'orb', trailStyle: 'psychic', impactStyle: 'pulse', groundStyle: 'glow', lightIntensity: 2.1 },
  metal: { particleShape: 'metal-shard', trailStyle: 'metal', impactStyle: 'slam', groundStyle: 'crack', lightIntensity: 1.1 },
  shadow: { particleShape: 'shadow-wisp', trailStyle: 'smoke', impactStyle: 'blink', groundStyle: 'shadow', lightIntensity: 0.7 },
  sound: { particleShape: 'sound-wave', trailStyle: 'resonance', impactStyle: 'pulse', groundStyle: 'ripple', lightIntensity: 1.9 },
  nature: { particleShape: 'leaf', trailStyle: 'vine', impactStyle: 'burst', groundStyle: 'glow', lightIntensity: 1.4 },
  gravity: { particleShape: 'gravity-orb', trailStyle: 'orbit', impactStyle: 'pulse', groundStyle: 'shadow', lightIntensity: 2.3 },
  force: { particleShape: 'orb', trailStyle: 'force', impactStyle: 'burst', groundStyle: 'glow', lightIntensity: 1.8 }
};

const theme = (base: BaseTheme): ElementCombatTheme => ({ ...base, ...VISUALS[base.effect] });

const THEMES: Record<string, ElementCombatTheme> = {
  Fire: theme({ icon: '🔥', color: 0xe34527, accent: 0xffb12f, effect: 'fire' }),
  Ice: theme({ icon: '❄', color: 0x9ee8ff, accent: 0xeafaff, effect: 'ice' }),
  Lightning: theme({ icon: '⚡', color: 0x3f7dff, accent: 0xffe76a, effect: 'lightning' }),
  Earth: theme({ icon: '◆', color: 0x6b4b2a, accent: 0xd58b37, effect: 'earth' }),
  Energy: theme({ icon: '✦', color: 0x35c85a, accent: 0xd7ef65, effect: 'energy' }),
  Water: theme({ icon: '◉', color: 0x35a9e8, accent: 0x8cecff, effect: 'water' }),
  Poison: theme({ icon: '☠', color: 0x75a83f, accent: 0xc1e85a, effect: 'poison' }),
  Venomari: theme({ icon: '☠', color: 0x75a83f, accent: 0xc1e85a, effect: 'poison' }),
  Smoke: theme({ icon: '≈', color: 0x8d8b91, accent: 0xd3d0d8, effect: 'wind' }),
  Speed: theme({ icon: '»', color: 0xe78b31, accent: 0xffdf75, effect: 'wind' }),
  Light: theme({ icon: '☀', color: 0xf0d467, accent: 0xffffff, effect: 'light' }),
  Mind: theme({ icon: '◎', color: 0x825dd7, accent: 0xcbb4ff, effect: 'mind' }),
  Sound: theme({ icon: '◌', color: 0xb84f52, accent: 0xffd37a, effect: 'sound' }),
  Nature: theme({ icon: '❧', color: 0x4f8f43, accent: 0xbfd96a, effect: 'nature' }),
  Gravity: theme({ icon: '◉', color: 0x5e46a9, accent: 0xa8d5ff, effect: 'gravity' }),
  Combat: theme({ icon: '⚔', color: 0x8b3343, accent: 0xe0b35d, effect: 'force' }),
  Metal: theme({ icon: '⬢', color: 0x7d858d, accent: 0xd1d6db, effect: 'metal' }),
  'Stone Army': theme({ icon: '⬢', color: 0x686d72, accent: 0xb5b9bd, effect: 'metal' }),
  Shadow: theme({ icon: '◐', color: 0x3c2f53, accent: 0x9b7cc5, effect: 'shadow' }),
  Creation: theme({ icon: '✹', color: 0xd0a441, accent: 0xffe28a, effect: 'energy' }),
  Amber: theme({ icon: '◇', color: 0xd38a2f, accent: 0xffc66d, effect: 'energy' }),
  Nindroid: theme({ icon: '⚙', color: 0x5ec6e8, accent: 0xd7f7ff, effect: 'lightning' }),
  Anacondrai: theme({ icon: '◈', color: 0x8d4778, accent: 0xcd8ab7, effect: 'poison' }),
  Constrictai: theme({ icon: '◈', color: 0x8b5b35, accent: 0xd1a066, effect: 'earth' }),
  Hypnobrai: theme({ icon: '◎', color: 0x5578af, accent: 0xaecbf1, effect: 'mind' }),
  Serpentine: theme({ icon: '◈', color: 0x6f9542, accent: 0xb8d873, effect: 'poison' }),
  Skulkin: theme({ icon: '☠', color: 0xbab2a5, accent: 0xf1eadb, effect: 'force' }),
  'Dark Magic': theme({ icon: '✦', color: 0x6b3b83, accent: 0xba79db, effect: 'shadow' }),
  'Staff of Elements': theme({ icon: '✹', color: 0xc79736, accent: 0xffda72, effect: 'force' }),
  Form: theme({ icon: '◇', color: 0x8d649f, accent: 0xd4a9e3, effect: 'force' }),
  Samurai: theme({ icon: '⚔', color: 0x8f2931, accent: 0xd6ae4c, effect: 'metal' }),
  Cultist: theme({ icon: '◈', color: 0x743047, accent: 0xc77a94, effect: 'shadow' }),
  'Brown Power': theme({ icon: '◆', color: 0x7a5737, accent: 0xd0a16f, effect: 'earth' })
};

const FALLBACK = theme({ icon: '✦', color: 0x9a6ac0, accent: 0xe0c3f2, effect: 'force' });

export function getElementCombatTheme(element: string): ElementCombatTheme {
  return THEMES[element] ?? FALLBACK;
}
