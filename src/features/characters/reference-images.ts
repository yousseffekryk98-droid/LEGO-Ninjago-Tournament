import type { CharacterDef } from './types';

export interface CharacterReferenceImage {
  imageUrl: string;
  sourceUrl: string;
  sourceLabel: string;
  note: string;
}

const LEGO_CHARACTER_IMAGES: Record<'kai' | 'jay' | 'zane' | 'nya', CharacterReferenceImage> = {
  kai: {
    imageUrl: 'https://www.lego.com/cdn/cs/set/assets/blt00bdc6b4671b5ce3/ninjago_CP_KAI_Sidekick-XL.jpg?dpr=1&fit=crop&format=jpg&height=800&quality=80&width=800',
    sourceUrl: 'https://www.lego.com/en-us/themes/ninjago/characters/kai',
    sourceLabel: 'Official LEGO® Kai reference',
    note: 'Official LEGO-hosted reference art; suit shown may differ from this playable variant.'
  },
  jay: {
    imageUrl: 'https://www.lego.com/cdn/cs/set/assets/blt8823f4bfd2809a36/ninjago_JAY_Sidekick-XL.jpg?dpr=1&fit=crop&format=jpg&height=800&quality=80&width=800',
    sourceUrl: 'https://www.lego.com/en-us/themes/ninjago/characters/jay',
    sourceLabel: 'Official LEGO® Jay reference',
    note: 'Official LEGO-hosted reference art; suit shown may differ from this playable variant.'
  },
  zane: {
    imageUrl: 'https://www.lego.com/cdn/cs/set/assets/bltc0c9206669580aa8/ninjago_ZANE_Sidekick-XL.jpg?dpr=1&fit=crop&format=jpg&height=800&quality=80&width=800',
    sourceUrl: 'https://www.lego.com/en-us/themes/ninjago/characters/zane',
    sourceLabel: 'Official LEGO® Zane reference',
    note: 'Official LEGO-hosted reference art; suit shown may differ from this playable variant.'
  },
  nya: {
    imageUrl: 'https://www.lego.com/cdn/cs/set/assets/blt2f74e1155e7a6712/ninjago_NYA_Sidekick-XL.jpg?dpr=1&fit=crop&format=jpg&height=800&quality=80&width=800',
    sourceUrl: 'https://www.lego.com/en-us/themes/ninjago/characters/nya',
    sourceLabel: 'Official LEGO® Nya reference',
    note: 'Official LEGO-hosted reference art; suit shown may differ from this playable variant.'
  }
};

function referenceKey(character: CharacterDef): keyof typeof LEGO_CHARACTER_IMAGES | null {
  const name = character.name.trim();

  // Start-anchored checks deliberately avoid mapping Bizarro/Avatar/other distinct
  // characters to the core ninja's artwork.
  if (/^Kai(?:\s|\(|$)/i.test(name)) return 'kai';
  if (/^Jay(?:\s+Walker)?(?:\s|\(|$)/i.test(name)) return 'jay';
  if (/^Zane(?:\s|\(|$)/i.test(name)) return 'zane';
  if (/^Nya(?:\s|\(|$)/i.test(name)) return 'nya';
  return null;
}

export function getCharacterReferenceImage(character: CharacterDef): CharacterReferenceImage | null {
  const key = referenceKey(character);
  return key ? LEGO_CHARACTER_IMAGES[key] : null;
}

export const OFFICIAL_REFERENCE_IMAGE_COUNT = Object.keys(LEGO_CHARACTER_IMAGES).length;
