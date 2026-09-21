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
  potentialLevel?: number;
}

export interface CharacterIdentity {
  name: string;
  variant: string | null;
}

export type {
  FighterArchetype as CharacterArchetype,
  FighterWeapon as CharacterWeapon,
  FighterModelProfile as CharacterModelProfile
} from '../../shared/three/model-types';

