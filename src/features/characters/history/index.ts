import type { CharacterDef, CharacterModelProfile } from '../types';
import { getCharacterModelProfile as p998d2fce } from './profile-998d2fce5ef9';
import { getCharacterModelProfile as p819add38 } from './profile-819add385e76';
import { getCharacterModelProfile as pd11705e6 } from './profile-d11705e6aeab';
import { getCharacterModelProfile as p26b198d6 } from './profile-26b198d6064b';
import { getCharacterModelProfile as pae6277d2 } from './profile-ae6277d2228c';
import { getCharacterModelProfile as pcf2f6329 } from './profile-cf2f6329a58c';
import { getCharacterModelProfile as p99837226 } from './profile-9983722666e3';
import { getCharacterModelProfile as pb5994b44 } from './profile-b5994b44dfcb';

const PROFILE_FACTORIES: Readonly<Record<string, (character: CharacterDef) => CharacterModelProfile>> = {
  '998d2fce5ef9': p998d2fce,
  '819add385e76': p819add38,
  'd11705e6aeab': pd11705e6,
  '26b198d6064b': p26b198d6,
  'ae6277d2228c': pae6277d2,
  'cf2f6329a58c': pcf2f6329,
  '9983722666e3': p99837226,
  'b5994b44dfcb': pb5994b44
};

export function getHistoricalCharacterModelProfile(commit: string, character: CharacterDef) {
  const factory = PROFILE_FACTORIES[commit];
  if (!factory) throw new Error(`Unknown historical fighter profile commit: ${commit}`);
  return factory(character);
}

export const HISTORICAL_PROFILE_COMMITS = Object.freeze(Object.keys(PROFILE_FACTORIES));
