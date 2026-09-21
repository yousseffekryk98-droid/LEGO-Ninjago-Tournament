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
}

export interface CharacterIdentity {
  name: string;
  variant: string | null;
}

export type CharacterArchetype =
  | 'ninja'
  | 'nindroid'
  | 'master'
  | 'samurai'
  | 'elemental'
  | 'serpentine'
  | 'skeleton'
  | 'villain';

export type CharacterWeapon =
  | 'katana'
  | 'dual-katana'
  | 'shuriken'
  | 'scythe'
  | 'nunchucks'
  | 'staff'
  | 'spear'
  | 'claws'
  | 'none';

export interface CharacterModelProfile {
  archetype: CharacterArchetype;
  weapon: CharacterWeapon;
  hood: boolean;
  shoulderArmor: boolean;
  extraArms: boolean;
  metallic: boolean;
  faceColor?: number;
  eyeColor?: number;
}
