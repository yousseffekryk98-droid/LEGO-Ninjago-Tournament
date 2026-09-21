import type { CharacterDef } from './types';
import { getCharacterModelProfile } from './model-profile';
import { createMinifigureModel } from '../../shared/three/minifigure-model';

export function createCharacterModel(character: CharacterDef, scale = 1) {
  return createMinifigureModel({
    primary: character.color,
    accent: character.accent,
    scale,
    profile: getCharacterModelProfile(character)
  });
}
