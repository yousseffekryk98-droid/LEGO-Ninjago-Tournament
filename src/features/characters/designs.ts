export type CharacterDesignKind = 'historical-procedural' | 'authored';

export interface CharacterDesign {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  kind: CharacterDesignKind;
  sourceCommit: string;
  timelineIndex: number;
  rendererCommit?: string;
  profileCommit?: string;
  assetUrl?: string;
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

function historical(
  timelineIndex: number,
  commit: string,
  label: string,
  rendererCommit: string,
  profileCommit: string,
  description: string
): CharacterDesign {
  return {
    id: `commit-${commit.slice(0, 8)}`,
    label,
    shortLabel: `C${String(timelineIndex).padStart(2, '0')} · ${commit.slice(0, 8)}`,
    description,
    kind: 'historical-procedural',
    sourceCommit: commit,
    rendererCommit,
    profileCommit,
    timelineIndex
  };
}

const PROCEDURAL_TIMELINE: CharacterDesign[] = [
  historical(1, '998d2fce5ef9', 'Initial 3D Model', '998d2fce5ef9', '998d2fce5ef9',
    'First preserved 3D fighter state: initial renderer and initial fighter profile mapping.'),
  historical(2, '819add385e76', 'Video Fidelity', '819add385e76', '819add385e76',
    'Video-fidelity fighter state with its matching profile rules.'),
  historical(3, 'b9eb6bfc87d5', 'LEGO Proportions', 'b9eb6bfc87d5', '819add385e76',
    'LEGO-style proportions and armor revision; profile mapping was unchanged from C02.'),
  historical(4, 'd1e20ac26365', 'Glossy Articulated', 'd1e20ac26365', '819add385e76',
    'Glossy LEGO-style materials and articulated rig revision.'),
  historical(5, 'd11705e6aeab', 'Armor Variants', 'd11705e6aeab', 'd11705e6aeab',
    'ZX, DX, Techno and Samurai armor silhouettes with their matching profile revision.'),
  historical(6, 'cae32dc0e722', 'Ninja Detail Pass', 'cae32dc0e722', 'd11705e6aeab',
    'Hood, cuff, knee, boot and mask detail revision.'),
  historical(7, '3dfe70cb5b31', 'Procedural Realism', '3dfe70cb5b31', 'd11705e6aeab',
    'Procedural NINJAGO realism and upgraded plastic-material revision.'),
  historical(8, '26b198d6064b', 'Wave-1 Profiles', '3dfe70cb5b31', '26b198d6064b',
    'Character-specific Wave-1 Tournament profile/silhouette revision using the C07 renderer.'),
  historical(9, '8c67c3277784', 'Tournament Geometry', '8c67c3277784', '26b198d6064b',
    'Distinctive Tournament character geometry with the Wave-1 profile rules.'),
  historical(10, 'ae6277d2228c', 'Tournament Identity Priority', '8c67c3277784', 'ae6277d2228c',
    'Tournament identities were prioritized ahead of faction fallbacks.'),
  historical(11, 'cf2f6329a58c', 'Remaining Wave-1 Identities', '8c67c3277784', 'cf2f6329a58c',
    'Remaining Wave-1 Tournament fighters received dedicated model identities.'),
  historical(12, '67a0ba97a0de', 'Remaining Wave-1 Geometry', '67a0ba97a0de', 'cf2f6329a58c',
    'Geometry was added for the remaining Wave-1 fighters.'),
  historical(13, '9983722666e3', 'Catalog Identity Preservation', '67a0ba97a0de', '9983722666e3',
    'Catalog fighters began preserving known identities and source-group silhouette data.'),
  historical(14, 'b5994b44dfcb', 'Skeleton Profile Fix', '67a0ba97a0de', 'b5994b44dfcb',
    'Latest procedural profile revision, correcting generic skeleton profiles and Samukai-style arm behavior.')
];

function authoredFirst(characterId: string): CharacterDesign {
  return {
    id: 'commit-0170de08',
    label: 'First Authored GLB',
    shortLabel: 'C15 · 0170de08',
    description: 'First authored-body design introduced at 113a74c1, using the buffer-fixed working revision 0170de08.',
    kind: 'authored',
    assetUrl: `/assets/models/fighters/variants/${characterId}/authored-v1.glb`,
    sourceCommit: '0170de08cb5c',
    timelineIndex: 15
  };
}

function authoredHighFidelity(characterId: string): CharacterDesign {
  return {
    id: 'commit-0bfc3094',
    label: 'High-Fidelity Authored',
    shortLabel: 'C16 · 0bfc3094',
    description: 'High-fidelity authored body introduced at 36008526, using the working hair-expression-fixed revision 0bfc3094.',
    kind: 'authored',
    assetUrl: `/assets/models/fighters/variants/${characterId}/authored-v2.glb`,
    sourceCommit: '0bfc30944669',
    timelineIndex: 16
  };
}

const LLOYD_TIMELINE: CharacterDesign[] = [
  {
    id: 'commit-425c89d4',
    label: 'Detailed Lloyd',
    shortLabel: 'C17 · 425c89d4',
    description: 'Hand-built detailed Lloyd; this is the repaired hair-data revision of the design introduced at ca1faa7d.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/lloyd-detailed.glb',
    sourceCommit: '425c89d402a2',
    timelineIndex: 17
  },
  {
    id: 'commit-6860d027',
    label: 'Exact Mould Initial',
    shortLabel: 'C18 · 6860d027',
    description: 'First dedicated LDraw-derived exact-mould Lloyd production generator.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/exact-6860d027.glb',
    sourceCommit: '6860d0274f71',
    timelineIndex: 18
  },
  {
    id: 'commit-70f95ff9',
    label: 'Exact Mould Intermediate',
    shortLabel: 'C19 · 70f95ff9',
    description: 'Intermediate exact-mould production pass from the former Lloyd generator path.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/exact-70f95ff9.glb',
    sourceCommit: '70f95ff967a3',
    timelineIndex: 19
  },
  {
    id: 'commit-05b7ce43',
    label: 'Exact Mould Refined',
    shortLabel: 'C20 · 05b7ce43',
    description: 'Exact-mould silhouette, bandana, orientation and Tournament-print refinement.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/exact-05b7ce43.glb',
    sourceCommit: '05b7ce43000e',
    timelineIndex: 20
  },
  {
    id: 'commit-961edd9b',
    label: 'Exact Mould + Back Emblem',
    shortLabel: 'C21 · 961edd9b',
    description: 'Latest Lloyd visual revision: refined exact-mould model plus rear Tournament power emblem.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/lloyd-exact.glb',
    sourceCommit: '961edd9b4692',
    timelineIndex: 21
  }
];

export function getCharacterDesigns(characterId: string): CharacterDesign[] {
  const designs = [...PROCEDURAL_TIMELINE];
  if (CORE_AUTHORED_IDS.has(characterId)) {
    designs.push(authoredFirst(characterId), authoredHighFidelity(characterId));
  }
  if (characterId === 'lloyd-tournament') designs.push(...LLOYD_TIMELINE);
  return designs;
}

export function getDefaultCharacterDesignId(characterId: string) {
  if (characterId === 'lloyd-tournament') return 'commit-425c89d4';
  if (CORE_AUTHORED_IDS.has(characterId)) return 'commit-0bfc3094';
  return 'commit-b5994b44';
}

const LEGACY_SELECTION_MAP: Readonly<Record<string, string>> = {
  procedural: 'commit-b5994b44',
  'authored-v1': 'commit-0170de08',
  'authored-v2': 'commit-0bfc3094',
  'lloyd-detailed': 'commit-425c89d4',
  'lloyd-exact': 'commit-961edd9b',
  'commit-67a0ba97': 'commit-b5994b44'
};

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
  const rawSelected = readSelections()[characterId];
  const selected = rawSelected ? (LEGACY_SELECTION_MAP[rawSelected] ?? rawSelected) : null;
  if (selected && designs.some((design) => design.id === selected)) return selected;
  return getDefaultCharacterDesignId(characterId);
}

export function getSelectedCharacterDesign(characterId: string) {
  const designs = getCharacterDesigns(characterId);
  return designs.find((design) => design.id === getSelectedCharacterDesignId(characterId))
    ?? designs[designs.length - 1];
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
