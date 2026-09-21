import type { CharacterDef, CharacterIdentity } from './types';

const SUFFIX_VARIANTS = ['ZX', 'DX'] as const;

export function getCharacterIdentity(character: CharacterDef): CharacterIdentity {
  const parenthesized = character.name.match(/^(.+?) \((.+)\)$/);
  if (parenthesized) {
    return { name: parenthesized[1], variant: parenthesized[2] };
  }

  for (const suffix of SUFFIX_VARIANTS) {
    if (character.name.endsWith(` ${suffix}`)) {
      return { name: character.name.slice(0, -(` ${suffix}`).length), variant: suffix };
    }
  }

  if (character.id === 'lloyd-garmadon') return { name: 'Lloyd', variant: 'Garmadon' };
  if (character.id === 'samurai-x') return { name: 'Nya', variant: 'Samurai X' };
  if (character.id === 'techno-wu') return { name: 'Master Wu', variant: 'Techno' };

  return { name: character.name, variant: null };
}

export function characterSearchText(character: CharacterDef) {
  const identity = getCharacterIdentity(character);
  return [
    identity.name,
    identity.variant ?? '',
    character.name,
    character.element,
    character.style,
    character.special
  ].join(' ').toLowerCase();
}
