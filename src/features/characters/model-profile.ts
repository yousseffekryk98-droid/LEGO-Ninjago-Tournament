import type { CharacterDef, CharacterModelProfile, CharacterWeapon } from './types';

function ninjaWeapon(id: string): CharacterWeapon {
  if (id.startsWith('zane')) return 'shuriken';
  if (id.startsWith('cole')) return 'scythe';
  if (id.startsWith('jay')) return 'nunchucks';
  if (id.startsWith('nya') || id === 'samurai-x') return 'spear';
  return 'katana';
}

export function getCharacterModelProfile(character: CharacterDef): CharacterModelProfile {
  const id = character.id;
  const element = character.element.toLowerCase();

  if (id.startsWith('zane') || id === 'pixal' || id === 'min-droid') {
    return {
      archetype: 'nindroid',
      weapon: id === 'zane-teacher' ? 'staff' : id.startsWith('zane') ? 'shuriken' : 'katana',
      hood: !id.includes('teacher'),
      shoulderArmor: id.includes('zx') || id.includes('techno'),
      extraArms: false,
      metallic: true,
      faceColor: 0xd7e0e4,
      eyeColor: 0x79dcff,
      battleDamaged: id.includes('battle-damaged')
    };
  }

  if (id.includes('garmadon')) {
    return {
      archetype: 'master',
      weapon: 'dual-katana',
      hood: false,
      shoulderArmor: id === 'garmadon-robes',
      extraArms: true,
      metallic: false,
      faceColor: 0xd8d0b8,
      eyeColor: 0xb54444
    };
  }

  if (id === 'samukai') {
    return {
      archetype: 'skeleton',
      weapon: 'dual-katana',
      hood: false,
      shoulderArmor: true,
      extraArms: true,
      metallic: false,
      faceColor: 0xeee9dd,
      eyeColor: 0x111111
    };
  }

  if (id === 'kruncha') {
    return {
      archetype: 'skeleton',
      weapon: 'katana',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0xeee9dd,
      eyeColor: 0x111111
    };
  }

  if (
    element.includes('serpentine') ||
    element.includes('venomari') ||
    element.includes('anacondrai') ||
    element.includes('constrictai') ||
    element.includes('hypnobrai') ||
    id === 'pythor' ||
    id === 'acidicus'
  ) {
    return {
      archetype: 'serpentine',
      weapon: character.style === 'ranged' ? 'staff' : 'claws',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: character.color,
      eyeColor: id === 'skales' ? 0xd94b4b : 0xf4df55,
      serpentineTail: !['snike', 'bytar'].includes(id)
    };
  }

  if (id === 'samurai-x') {
    return {
      archetype: 'samurai',
      weapon: 'dual-katana',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: true
    };
  }

  if (id === 'master-chen' || id === 'clouse' || id === 'clouse-robe' || id === 'eyezor' || id === 'zugu') {
    return {
      archetype: 'villain',
      weapon: id === 'master-chen' || id.startsWith('clouse') ? 'staff' : 'katana',
      hood: id.startsWith('clouse'),
      shoulderArmor: true,
      extraArms: false,
      metallic: false
    };
  }

  if (id === 'techno-wu') {
    return {
      archetype: 'master',
      weapon: 'staff',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x17191c
    };
  }

  const coreNinja = /^(lloyd|kai|jay|cole)-/.test(id);
  if (coreNinja || id.startsWith('lloyd')) {
    return {
      archetype: 'ninja',
      weapon: ninjaWeapon(id),
      hood: !id.includes('teacher'),
      shoulderArmor: id.includes('zx') || id.includes('dx') || id.includes('techno'),
      extraArms: false,
      metallic: false
    };
  }

  return {
    archetype: 'elemental',
    weapon: character.style === 'ranged' ? 'staff' : character.style === 'heavy' ? 'scythe' : 'katana',
    hood: false,
    shoulderArmor: character.style === 'heavy',
    extraArms: false,
    metallic: element.includes('metal')
  };
}
