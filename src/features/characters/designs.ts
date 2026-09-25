export type CharacterDesignKind = 'procedural' | 'authored';

export interface CharacterDesign {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  kind: CharacterDesignKind;
  assetUrl?: string;
  sourceCommit?: string;
}

const STORAGE_KEY = 'ninja-tournament-character-designs-v1';

const CORE_AUTHORED_IDS = new Set([
  'lloyd-tournament',
  'kai-tournament',
  'jay-tournament',
  'cole-tournament',
  'zane-techno',
  'zane-zx',
  'nya',
  'master-garmadon',
  'master-chen',
  'skylor'
]);

const proceduralDesign: CharacterDesign = {
  id: 'procedural',
  label: 'Classic Procedural',
  shortLabel: 'CLASSIC',
  description: 'Original gameplay model built from the shared minifigure system.',
  kind: 'procedural'
};

function authoredV1(characterId: string): CharacterDesign {
  return {
    id: 'authored-v1',
    label: 'Authored V1',
    shortLabel: 'V1',
    description: 'First authored GLB generation recovered from the September 25 history.',
    kind: 'authored',
    assetUrl: `/assets/models/fighters/variants/${characterId}/authored-v1.glb`,
    sourceCommit: 'f06ea597d25fb4872527ce2a8542a56990a43857'
  };
}

function authoredV2(characterId: string): CharacterDesign {
  return {
    id: 'authored-v2',
    label: 'Authored V2',
    shortLabel: 'V2',
    description: 'Later high-fidelity authored generation with face, hair and layered outfit details.',
    kind: 'authored',
    assetUrl: `/assets/models/fighters/variants/${characterId}/authored-v2.glb`,
    sourceCommit: '36008526f5a655ee9f4b88b558ca03c5dc163e83'
  };
}

const lloydDetailed: CharacterDesign = {
  id: 'lloyd-detailed',
  label: 'Lloyd Detailed',
  shortLabel: 'DETAILED',
  description: 'Recovered hand-built Lloyd model from before the exact-mould replacement.',
  kind: 'authored',
  assetUrl: '/assets/models/fighters/variants/lloyd-tournament/lloyd-detailed.glb',
  sourceCommit: '4074853454a059414332e93237027fdd9da230a7'
};

const lloydExact: CharacterDesign = {
  id: 'lloyd-exact',
  label: 'Lloyd Exact Mould',
  shortLabel: 'EXACT',
  description: 'LDraw-derived exact-mould experiment retained as an optional design.',
  kind: 'authored',
  assetUrl: '/assets/models/fighters/variants/lloyd-tournament/lloyd-exact.glb',
  sourceCommit: 'ac3983ea99daf1849cdaf375e6d000588e34e74c'
};

export function getCharacterDesigns(characterId: string): CharacterDesign[] {
  const designs: CharacterDesign[] = [proceduralDesign];
  if (CORE_AUTHORED_IDS.has(characterId)) {
    designs.push(authoredV1(characterId), authoredV2(characterId));
  }
  if (characterId === 'lloyd-tournament') designs.push(lloydDetailed, lloydExact);
  return designs;
}

export function getDefaultCharacterDesignId(characterId: string) {
  if (characterId === 'lloyd-tournament') return 'lloyd-detailed';
  if (CORE_AUTHORED_IDS.has(characterId)) return 'authored-v2';
  return 'procedural';
}

function readSelections(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function getSelectedCharacterDesignId(characterId: string) {
  const designs = getCharacterDesigns(characterId);
  const selected = readSelections()[characterId];
  if (selected && designs.some((design) => design.id === selected)) return selected;
  return getDefaultCharacterDesignId(characterId);
}

export function getSelectedCharacterDesign(characterId: string) {
  const designs = getCharacterDesigns(characterId);
  return designs.find((design) => design.id === getSelectedCharacterDesignId(characterId))
    ?? designs[0];
}

export function setSelectedCharacterDesign(characterId: string, designId: string) {
  if (typeof window === 'undefined') return;
  const designs = getCharacterDesigns(characterId);
  if (!designs.some((design) => design.id === designId)) return;
  const selections = readSelections();
  selections[characterId] = designId;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
  window.dispatchEvent(new CustomEvent('ninja-character-design-changed', {
    detail: { characterId, designId }
  }));
}

export function characterDesignStorageKey() {
  return STORAGE_KEY;
}
