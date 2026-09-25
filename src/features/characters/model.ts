import type { CharacterDef } from './types';
import { getCharacterModelProfile } from './model-profile';
import { createMinifigureModel } from '../../shared/three/minifigure-model';
import { attachAuthoredCharacterBody } from './authored-model';
import { getSelectedCharacterDesign } from './designs';

export function createCharacterModel(character: CharacterDef, scale = 1) {
  const baseProfile = getCharacterModelProfile(character);
  const isTruePotential = (character.potentialLevel ?? 1) >= 5;
  const obsidianWeapon = isTruePotential && ['kai-dx', 'jay-zx', 'zane-zx', 'cole-zukin'].includes(character.id);

  const model = createMinifigureModel({
    primary: character.color,
    accent: character.accent,
    scale,
    profile: {
      ...baseProfile,
      truePotentialGlow: isTruePotential ? character.color : undefined,
      weaponColor: obsidianWeapon ? 0x252434 : undefined
    }
  });

  if (typeof window !== 'undefined') {
    const design = getSelectedCharacterDesign(character.id);
    model.userData.characterDesignId = design.id;
    model.userData.characterDesignLabel = design.label;
    if (design.kind === 'authored' && design.assetUrl) {
      void attachAuthoredCharacterBody(model, character.id, design.assetUrl, design.id);
    }
  }
  return model;
}
