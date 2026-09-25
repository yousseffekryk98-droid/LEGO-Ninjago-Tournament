import type { CharacterDef } from './types';
import { getCharacterModelProfile } from './model-profile';
import { getHistoricalCharacterModelProfile } from './history';
import { createMinifigureModel } from '../../shared/three/minifigure-model';
import { createHistoricalMinifigureModel } from '../../shared/three/history';
import { attachAuthoredCharacterBody } from './authored-model';
import { getSelectedCharacterDesign } from './designs';

export function createCharacterModel(character: CharacterDef, scale = 1) {
  const design = typeof window !== 'undefined' ? getSelectedCharacterDesign(character.id) : null;
  const baseProfile = design?.kind === 'historical-procedural' && design.profileCommit
    ? getHistoricalCharacterModelProfile(design.profileCommit, character)
    : getCharacterModelProfile(character);
  const isTruePotential = (character.potentialLevel ?? 1) >= 5;
  const obsidianWeapon = isTruePotential && ['kai-dx', 'jay-zx', 'zane-zx', 'cole-zukin'].includes(character.id);

  const options = {
    primary: character.color,
    accent: character.accent,
    scale,
    profile: {
      ...baseProfile,
      truePotentialGlow: isTruePotential ? character.color : undefined,
      weaponColor: obsidianWeapon ? 0x252434 : undefined
    }
  };

  const model = design?.kind === 'historical-procedural'
    ? createHistoricalMinifigureModel(design.rendererCommit ?? design.sourceCommit, options)
    : createMinifigureModel(options);

  if (typeof window !== 'undefined' && design) {
    model.userData.characterDesignId = design.id;
    model.userData.characterDesignLabel = design.label;
    if (design.kind === 'authored' && design.assetUrl) {
      void attachAuthoredCharacterBody(model, character.id, design.assetUrl, design.id);
    }
  }
  return model;
}
