import { EXPANDED_CHARACTER_CATALOG, type ExpandedCharacterCatalogEntry } from './expanded-catalog';
import { getElementCombatTheme } from './elemental';
import type { CharacterDef, CombatStyle, SpecialType } from './types';

type PowerProfile = {
  element: string;
  style: CombatStyle;
  special: SpecialType;
};

const POWER_SPECIALS: Record<string, string> = {
  Fire: 'Fire Dragon Blast',
  Lightning: 'Thunder Strike',
  Earth: 'Earthquake Smash',
  Ice: 'Ice Freeze',
  Water: 'Tidal Wave',
  Energy: 'Energy Dragon',
  Creation: 'Creation Tornado',
  Destruction: 'Destruction Blast',
  Amber: 'Copy Opponent Power',
  Wind: 'Wind Cyclone',
  Metal: 'Metal Armor',
  Speed: 'Speed Rush',
  Mind: 'Psychic Stun',
  Poison: 'Poison Cloud',
  Light: 'Invisibility',
  Form: 'Transform',
  Gravity: 'Gravity Crush',
  Smoke: 'Smoke Teleport',
  Technology: 'Tech Override',
  Heat: 'Heat Burst',
  Quake: 'Seismic Slam',
  Fusion: 'Fusion Bind',
  'Brute Force': 'Brutal Smash',
  Fear: 'Fear Wave',
  Swarm: 'Swarm Attack',
  Decay: 'Decay Drain',
  Misfortune: 'Bad Luck Curse',
  'Wish Magic': 'Wish Trap',
  Magic: 'Arcane Burst',
  Darkness: 'Dark Energy',
  Digital: 'Glitch Attack',
  'Skull Magic': 'Undead Summon',
  Storm: 'Ocean Storm',
  Chaos: 'Chaos Blast',
  Balance: 'Balance Break',
  Reflex: 'Reflex Rush',
  Plants: 'Root Surge',
  Shockwave: 'Shockwave Blast',
  Size: 'Titan Shift',
  'Surface Tension': 'Surface Shield',
  Figment: 'Illusion Mirage',
  Propulsion: 'Rocket Burst',
  Time: 'Time Break',
  Hypnosis: 'Hypnotic Gaze',
  Sound: 'Sonic Burst',
  Nature: 'Vine Snare',
  Shadow: 'Shadow Step',
  'Dragon Energy': 'Dragon Energy Burst',
  Spinjitzu: 'Spinjitzu Rush',
  Combat: 'Combat Breaker'
};

const POWER_PASSIVES: Record<string, string> = {
  Fire: 'Burning Momentum',
  Lightning: 'Static Charge',
  Earth: 'Stone Guard',
  Ice: 'Frost Armor',
  Water: 'Flow State',
  Energy: 'Green Energy Surge',
  Creation: 'Creative Balance',
  Destruction: 'Oni Fury',
  Amber: 'Adaptive Power',
  Wind: 'Airborne Agility',
  Metal: 'Iron Skin',
  Speed: 'Velocity',
  Mind: 'Mental Focus',
  Poison: 'Toxic Touch',
  Light: 'Radiant Veil',
  Form: 'Adaptive Form',
  Gravity: 'Heavy Field',
  Smoke: 'Vanish',
  Technology: 'System Override',
  Heat: 'Overheat',
  Quake: 'Aftershock',
  Fusion: 'Bonded Force',
  'Brute Force': 'Unstoppable',
  Fear: 'Dread Aura',
  Swarm: 'Hive Mind',
  Decay: 'Withering Touch',
  Misfortune: 'Bad Omen',
  'Wish Magic': 'Djinn Trickery',
  Magic: 'Arcane Focus',
  Darkness: 'Dark Aura',
  Digital: 'Respawn Protocol',
  'Skull Magic': 'Necromancy',
  Storm: 'Tempest Charge',
  Chaos: 'Chaotic Surge',
  Balance: 'Equilibrium',
  Reflex: 'Quick Response',
  Plants: 'Regrowth',
  Shockwave: 'Kinetic Charge',
  Size: 'Mass Shift',
  'Surface Tension': 'Water Skin',
  Figment: 'Mirage',
  Propulsion: 'Momentum',
  Time: 'Temporal Sense',
  Hypnosis: 'Mesmerize',
  Sound: 'Resonance',
  Nature: 'Regeneration',
  Shadow: 'Shadow Cloak',
  'Dragon Energy': 'Dragon Heart',
  Spinjitzu: 'Spin Mastery',
  Combat: 'Battle Focus'
};

function powerLabel(power: string) {
  const cleaned = power.replace(/^[^A-Za-z0-9]+/, '').trim();
  const first = cleaned
    .split(' / ')[0]
    .split(' + ')[0]
    .split(':')[0]
    .replace(/;.*$/, '')
    .trim();
  return first || 'Combat';
}

function classifyPower(power: string): PowerProfile {
  const p = power.toLowerCase();

  if (p.includes('lightning')) return { element: 'Lightning', style: 'speed', special: 'overload' };
  if (p.includes('heat')) return { element: 'Heat', style: 'balanced', special: 'charge' };
  if (p.includes('fire')) return { element: 'Fire', style: 'balanced', special: 'spinjitzu' };
  if (p.includes('ice')) return { element: 'Ice', style: 'ranged', special: 'overload' };
  if (p.includes('surface tension')) return { element: 'Surface Tension', style: 'ranged', special: 'overload' };
  if (p.includes('water') || p.includes('wave') || p.includes('aquatic') || p.includes('sea')) return { element: 'Water', style: 'speed', special: 'charge' };
  if (p.includes('quake')) return { element: 'Quake', style: 'heavy', special: 'charge' };
  if (p.includes('earth') || p.includes('stone')) return { element: 'Earth', style: 'heavy', special: 'charge' };
  if (p.includes('golden') || p.includes('energy') || p.includes('life')) return { element: p.includes('dragon') ? 'Dragon Energy' : 'Energy', style: 'balanced', special: 'spinjitzu' };
  if (p.includes('creation')) return { element: 'Creation', style: 'balanced', special: 'spinjitzu' };
  if (p.includes('destruction')) return { element: 'Destruction', style: 'heavy', special: 'overload' };
  if (p.includes('oni') || p.includes('darkness') || p.includes('corruption')) return { element: 'Darkness', style: 'heavy', special: 'overload' };
  if (p.includes('technology') || p.includes('nindroid') || p.includes('digital') || p.includes('robot') || p.includes('mechanic') || p.includes('programmer')) {
    return { element: p.includes('digital') ? 'Digital' : 'Technology', style: 'ranged', special: 'overload' };
  }
  if (p.includes('decay')) return { element: 'Decay', style: 'ranged', special: 'toxic-cloud' };
  if (p.includes('poison') || p.includes('venom') || p.includes('toxic')) return { element: 'Poison', style: 'ranged', special: 'toxic-cloud' };
  if (p.includes('wind')) return { element: 'Wind', style: 'speed', special: 'airstrike' };
  if (p.includes('light') || p.includes('invisibility')) return { element: 'Light', style: 'ranged', special: 'boost' };
  if (p.includes('hypnosis')) return { element: 'Hypnosis', style: 'ranged', special: 'shout' };
  if (p.includes('fear')) return { element: 'Fear', style: 'ranged', special: 'shout' };
  if (p.includes('mind') || p.includes('manipulation')) return { element: 'Mind', style: 'ranged', special: 'shout' };
  if (p.includes('metal')) return { element: 'Metal', style: 'heavy', special: 'charge' };
  if (p.includes('shadow')) return { element: 'Shadow', style: 'speed', special: 'boost' };
  if (p.includes('sound') || p.includes('scream')) return { element: 'Sound', style: 'ranged', special: 'shout' };
  if (p.includes('plants')) return { element: 'Plants', style: 'balanced', special: 'charge' };
  if (p.includes('nature')) return { element: 'Nature', style: 'balanced', special: 'charge' };
  if (p.includes('gravity')) return { element: 'Gravity', style: 'ranged', special: 'overload' };
  if (p.includes('smoke')) return { element: 'Smoke', style: 'speed', special: 'boost' };
  if (p.includes('amber') || p.includes('copy') || p.includes('absorb')) return { element: 'Amber', style: 'balanced', special: 'spinjitzu' };
  if (p.includes('form') || p.includes('shapeshift') || p.includes('transformation')) return { element: 'Form', style: 'balanced', special: 'boost' };
  if (p.includes('fusion')) return { element: 'Fusion', style: 'balanced', special: 'overload' };
  if (p.includes('reflex')) return { element: 'Reflex', style: 'speed', special: 'boost' };
  if (p.includes('speed') || p.includes('racing')) return { element: 'Speed', style: 'speed', special: 'boost' };
  if (p.includes('balance')) return { element: 'Balance', style: 'balanced', special: 'spinjitzu' };
  if (p.includes('shockwave')) return { element: 'Shockwave', style: 'heavy', special: 'overload' };
  if (p.includes('size')) return { element: 'Size', style: 'heavy', special: 'charge' };
  if (p.includes('figment') || p.includes('illusion')) return { element: 'Figment', style: 'ranged', special: 'shout' };
  if (p.includes('propulsion') || p.includes('jetpack')) return { element: 'Propulsion', style: 'speed', special: 'airstrike' };
  if (p.includes('swarm')) return { element: 'Swarm', style: 'ranged', special: 'toxic-cloud' };
  if (p.includes('misfortune') || p.includes('luck')) return { element: 'Misfortune', style: 'ranged', special: 'shout' };
  if (p.includes('time')) return { element: 'Time', style: 'ranged', special: 'overload' };
  if (p.includes('wish') || p.includes('djinn')) return { element: 'Wish Magic', style: 'ranged', special: 'shout' };
  if (p.includes('skull') || p.includes('necrom')) return { element: 'Skull Magic', style: 'ranged', special: 'toxic-cloud' };
  if (p.includes('magic') || p.includes('sorcery') || p.includes('spell')) return { element: 'Magic', style: 'ranged', special: 'shout' };
  if (p.includes('chaos') || p.includes('shatter')) return { element: 'Chaos', style: 'heavy', special: 'overload' };
  if (p.includes('storm')) return { element: 'Storm', style: 'ranged', special: 'airstrike' };
  if (p.includes('brute force') || p.includes('extreme strength') || p.includes('super strength') || p.includes('strength')) return { element: 'Brute Force', style: 'heavy', special: 'charge' };
  if (p.includes('spinjitzu')) return { element: 'Spinjitzu', style: 'balanced', special: 'spinjitzu' };
  if (p.includes('dragon')) return { element: 'Dragon Energy', style: 'heavy', special: 'airstrike' };
  if (p.includes('anacondrai')) return { element: 'Anacondrai', style: 'speed', special: 'toxic-cloud' };
  if (p.includes('hypnobrai')) return { element: 'Hypnobrai', style: 'ranged', special: 'shout' };
  if (p.includes('constrictai')) return { element: 'Constrictai', style: 'heavy', special: 'charge' };
  if (p.includes('serpentine') || p.includes('snake')) return { element: 'Serpentine', style: 'speed', special: 'toxic-cloud' };
  if (p.includes('skulkin') || p.includes('skeleton')) return { element: 'Skulkin', style: 'heavy', special: 'charge' };

  return { element: powerLabel(power), style: 'balanced', special: 'spinjitzu' };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalAttackFor(style: CombatStyle) {
  if (style === 'heavy') return 'Heavy Smash';
  if (style === 'speed') return 'Rapid Combo';
  if (style === 'ranged') return 'Power Shot';
  return 'Ninja Combo';
}

function specialAttackFor(element: string) {
  return POWER_SPECIALS[element] ?? `${element} Burst`;
}

function passiveFor(element: string) {
  return POWER_PASSIVES[element] ?? `${element} Mastery`;
}

export function withFighterAbilityKit(character: CharacterDef): CharacterDef {
  const power = character.power ?? character.element;
  const classified = classifyPower(power);
  const element = character.element || classified.element;

  return {
    ...character,
    power,
    normalAttack: character.normalAttack ?? normalAttackFor(character.style),
    specialAttack: character.specialAttack ?? specialAttackFor(element),
    spinjitzu: character.spinjitzu ?? (element === 'Spinjitzu' ? 'Advanced Spinjitzu' : `${element} Spinjitzu`),
    ultimateSpinjitzu: character.ultimateSpinjitzu ?? `${element} Ultimate`,
    passive: character.passive ?? passiveFor(element)
  };
}

export function createCatalogFighter(entry: ExpandedCharacterCatalogEntry): CharacterDef {
  const classified = classifyPower(entry.power);
  const element = classified.element;
  const theme = getElementCombatTheme(element);
  const seed = hashString(`${entry.id}|${entry.power}|${entry.era}`);

  const base = classified.style === 'speed'
    ? { speed: 6.5, damage: 18, maxHealth: 4 }
    : classified.style === 'heavy'
      ? { speed: 5.0, damage: 27, maxHealth: 5 }
      : classified.style === 'ranged'
        ? { speed: 5.5, damage: 20, maxHealth: 4 }
        : { speed: 5.8, damage: 21, maxHealth: 4 };

  return withFighterAbilityKit({
    id: `catalog-${entry.id}`,
    name: entry.name,
    element,
    power: entry.power,
    sourceEra: entry.era,
    sourceGroup: entry.group,
    style: classified.style,
    special: classified.special,
    color: theme.color,
    accent: theme.accent,
    speed: Number((base.speed + ((seed % 5) - 2) * 0.08).toFixed(2)),
    damage: base.damage + (seed % 3),
    maxHealth: base.maxHealth + (seed % 11 === 0 ? 1 : 0),
    cost: 3500 + entry.wave * 1200 + (seed % 5000),
    potentialLevel: 1
  });
}

export const CATALOG_ROSTER: CharacterDef[] = EXPANDED_CHARACTER_CATALOG.map(createCatalogFighter);
