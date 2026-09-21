import type { CharacterDef } from './types';
import { getCharacterModelProfile } from './model-profile';
import { createMinifigureModel } from '../../shared/three/minifigure-model';

export function createCharacterModel(character: CharacterDef, scale = 1) {
  const baseProfile = getCharacterModelProfile(character);
  const isTruePotential = (character.potentialLevel ?? 1) >= 5;
  const obsidianWeapon = isTruePotential && ['kai-dx', 'jay-zx', 'zane-zx', 'cole-zukin'].includes(character.id);

  return createMinifigureModel({
    primary: character.color,
    accent: character.accent,
    scale,
    profile: {
      ...baseProfile,
      truePotentialGlow: isTruePotential ? character.color : undefined,
      weaponColor: obsidianWeapon ? 0x252434 : undefined
    }
  });
}
