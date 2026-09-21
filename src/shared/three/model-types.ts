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

export interface FighterModelProfile {
  archetype: FighterArchetype;
  weapon: FighterWeapon;
  hood: boolean;
  shoulderArmor: boolean;
  extraArms: boolean;
  metallic: boolean;
  faceColor?: number;
  eyeColor?: number;
  weaponColor?: number;
  truePotentialGlow?: number;
}
