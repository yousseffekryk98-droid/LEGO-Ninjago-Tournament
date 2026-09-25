import type { CharacterDef, CharacterModelProfile, CharacterWeapon } from './types';

function ninjaWeapon(id: string): CharacterWeapon {
  if (id.startsWith('zane')) return 'shuriken';
  if (id.startsWith('cole')) return 'scythe';
  if (id.startsWith('jay')) return 'nunchucks';
  if (id.startsWith('nya') || id === 'samurai-x') return 'spear';
  return 'katana';
}

export function getCharacterModelProfile(character: CharacterDef): CharacterModelProfile {
  const id = character.id.replace(/^catalog-/, '');
  const power = (character.power ?? character.element).toLowerCase();
  const sourceGroup = (character.sourceGroup ?? '').toLowerCase();
  const element = `${character.element} ${power} ${sourceGroup}`.toLowerCase();

  if (id.startsWith('zane') || id === 'pixal' || id === 'min-droid') {
    return {
      archetype: 'nindroid',
      weapon: id === 'zane-teacher' ? 'staff' : id.startsWith('zane') ? 'shuriken' : 'katana',
      hood: !id.includes('teacher'),
      shoulderArmor: id.includes('zx') || id.includes('techno'),
      armorStyle: id.includes('zx') ? 'zx' : id.includes('techno') ? 'techno' : undefined,
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

  if (sourceGroup.includes('skeleton army')) {
    return {
      archetype: 'skeleton',
      weapon: character.style === 'heavy' ? 'scythe' : 'katana',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0xeee9dd,
      eyeColor: 0x111111
    };
  }

  const tournamentIdentity: Record<string, CharacterModelProfile> = {
    'master-chen': {
      archetype: 'villain',
      weapon: 'staff',
      hood: false,
      shoulderArmor: true,
      armorStyle: 'heavy',
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x17191c,
      identityStyle: 'chen'
    },
    clouse: {
      archetype: 'villain',
      weapon: 'staff',
      hood: true,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0xe0c58f,
      eyeColor: 0x2a2024,
      identityStyle: 'clouse'
    },
    'clouse-robe': {
      archetype: 'villain',
      weapon: 'staff',
      hood: true,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0xd8c49c,
      eyeColor: 0x2a2024,
      identityStyle: 'clouse'
    },
    eyezor: {
      archetype: 'villain',
      weapon: 'katana',
      hood: false,
      shoulderArmor: true,
      armorStyle: 'heavy',
      extraArms: false,
      metallic: false,
      faceColor: 0xf0c248,
      eyeColor: 0x24181b,
      identityStyle: 'eyezor'
    },
    zugu: {
      archetype: 'villain',
      weapon: 'scythe',
      hood: false,
      shoulderArmor: true,
      armorStyle: 'heavy',
      extraArms: false,
      metallic: false,
      faceColor: 0xe2b84a,
      eyeColor: 0x22191d,
      identityStyle: 'zugu'
    },
    karlof: {
      archetype: 'elemental',
      weapon: 'scythe',
      hood: false,
      shoulderArmor: true,
      armorStyle: 'heavy',
      extraArms: false,
      metallic: true,
      faceColor: 0x8a9299,
      eyeColor: 0xcceeff,
      identityStyle: 'karlof'
    },
    'griffin-turner': {
      archetype: 'elemental',
      weapon: 'katana',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x17191c,
      identityStyle: 'griffin'
    },
    shade: {
      archetype: 'elemental',
      weapon: 'katana',
      hood: true,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xc0b5aa,
      eyeColor: 0x9b7cc5,
      identityStyle: 'shade'
    },
    neuro: {
      archetype: 'elemental',
      weapon: 'staff',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x5b2c83,
      identityStyle: 'neuro'
    },
    paleman: {
      archetype: 'elemental',
      weapon: 'staff',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf8f1d8,
      eyeColor: 0xf7e58a,
      identityStyle: 'paleman'
    },
    tox: {
      archetype: 'elemental',
      weapon: 'staff',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0xdac34d,
      eyeColor: 0x2e2a2f,
      identityStyle: 'tox'
    },
    skylor: {
      archetype: 'elemental',
      weapon: 'katana',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x3b2118,
      identityStyle: 'skylor'
    },
    chamille: {
      archetype: 'elemental',
      weapon: 'katana',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x36202f,
      identityStyle: 'chamille'
    },
    ash: {
      archetype: 'elemental',
      weapon: 'katana',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xd7c8b5,
      eyeColor: 0x28292d,
      identityStyle: 'ash'
    },
    'jacob-pevsner': {
      archetype: 'elemental',
      weapon: 'staff',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x2e1c18,
      identityStyle: 'jacob'
    },
    bolobo: {
      archetype: 'elemental',
      weapon: 'staff',
      hood: false,
      shoulderArmor: false,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x24341c,
      identityStyle: 'bolobo'
    },
    gravis: {
      archetype: 'elemental',
      weapon: 'staff',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0xf2c64f,
      eyeColor: 0x2b1d4a,
      identityStyle: 'gravis'
    },
    kapau: {
      archetype: 'villain',
      weapon: 'katana',
      hood: false,
      shoulderArmor: true,
      armorStyle: 'heavy',
      extraArms: false,
      metallic: false,
      faceColor: 0xe6b84b,
      eyeColor: 0x24191b,
      identityStyle: 'kapau'
    },
    chope: {
      archetype: 'villain',
      weapon: 'katana',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0xe5b64a,
      eyeColor: 0x24191b,
      identityStyle: 'chope'
    },
    krait: {
      archetype: 'serpentine',
      weapon: 'claws',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0x4f3650,
      eyeColor: 0xf4df55,
      serpentineTail: true,
      identityStyle: 'krait'
    },
    sleven: {
      archetype: 'serpentine',
      weapon: 'claws',
      hood: false,
      shoulderArmor: true,
      extraArms: false,
      metallic: false,
      faceColor: 0x5c3a55,
      eyeColor: 0xffcf62,
      serpentineTail: true,
      identityStyle: 'sleven'
    }
  };

  if (tournamentIdentity[id]) return tournamentIdentity[id];

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
      armorStyle: 'samurai',
      extraArms: false,
      metallic: true
    };
  }

  if (id === 'techno-wu' || id === 'master-wu' || character.name === 'Master Wu') {
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

  const coreNinja = /^(lloyd|kai|jay|cole)(-|$)/.test(id);
  if (coreNinja || id.startsWith('lloyd') || id === 'nya') {
    return {
      archetype: 'ninja',
      weapon: ninjaWeapon(id),
      hood: !id.includes('teacher'),
      shoulderArmor: id.includes('zx') || id.includes('dx') || id.includes('techno'),
      armorStyle: id.includes('zx') ? 'zx' : id.includes('dx') ? 'dx' : id.includes('techno') ? 'techno' : undefined,
      extraArms: false,
      metallic: false
    };
  }

  return {
    archetype: 'elemental',
    weapon: character.style === 'ranged' ? 'staff' : character.style === 'heavy' ? 'scythe' : 'katana',
    hood: false,
    shoulderArmor: character.style === 'heavy',
    armorStyle: character.style === 'heavy' ? 'heavy' : undefined,
    extraArms: false,
    metallic: element.includes('metal')
  };
}
