export type FighterArchetype =
  | 'ninja'
  | 'nindroid'
  | 'master'
  | 'samurai'
  | 'elemental'
  | 'serpentine'
  | 'skeleton'
  | 'villain';

export type FighterWeapon =
  | 'katana'
  | 'dual-katana'
  | 'shuriken'
  | 'scythe'
  | 'nunchucks'
  | 'staff'
  | 'spear'
  | 'claws'
  | 'none';

export type FighterIdentityStyle =
  | 'chen'
  | 'clouse'
  | 'eyezor'
  | 'zugu'
  | 'karlof'
  | 'griffin'
  | 'shade'
  | 'neuro'
  | 'paleman'
  | 'tox'
  | 'skylor'
  | 'chamille'
  | 'ash';

export interface FighterModelProfile {
  archetype: FighterArchetype;
  weapon: FighterWeapon;
  hood: boolean;
  shoulderArmor: boolean;
  armorStyle?: 'zx' | 'dx' | 'techno' | 'samurai' | 'heavy';
  extraArms: boolean;
  metallic: boolean;
  faceColor?: number;
  eyeColor?: number;
  weaponColor?: number;
  truePotentialGlow?: number;
  serpentineTail?: boolean;
  battleDamaged?: boolean;
  identityStyle?: FighterIdentityStyle;
}
