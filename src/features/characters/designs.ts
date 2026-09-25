export type CharacterDesignKind = 'historical-procedural' | 'authored';

export interface CharacterDesign {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  kind: CharacterDesignKind;
  sourceCommit: string;
  timelineIndex: number;
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

const PROCEDURAL_TIMELINE: CharacterDesign[] = [
  {
    id: 'commit-998d2fce',
    label: 'Initial 3D Model',
    shortLabel: 'C01 · 998d2fce',
    description: 'First preserved shared 3D fighter renderer from Sep 21: character refactor, Zane visibility and initial 3D source structure.',
    kind: 'historical-procedural',
    sourceCommit: '998d2fce5ef9',
    timelineIndex: 1
  },
  {
    id: 'commit-819add38',
    label: 'Video Fidelity',
    shortLabel: 'C02 · 819add38',
    description: 'Sep 21 video-fidelity fighter revision with the first legacy-game visual pass.',
    kind: 'historical-procedural',
    sourceCommit: '819add385e76',
    timelineIndex: 2
  },
  {
    id: 'commit-b9eb6bfc',
    label: 'LEGO Proportions',
    shortLabel: 'C03 · b9eb6bfc',
    description: 'Sep 24 procedural minifigure revision with stronger LEGO-style proportions and armor.',
    kind: 'historical-procedural',
    sourceCommit: 'b9eb6bfc87d5',
    timelineIndex: 3
  },
  {
    id: 'commit-d1e20ac2',
    label: 'Glossy Articulated',
    shortLabel: 'C04 · d1e20ac2',
    description: 'Sep 24 glossy LEGO-style material and articulated-rig revision.',
    kind: 'historical-procedural',
    sourceCommit: 'd1e20ac26365',
    timelineIndex: 4
  },
  {
    id: 'commit-d11705e6',
    label: 'Armor Variants',
    shortLabel: 'C05 · d11705e6',
    description: 'Sep 24 revision differentiating ZX, DX, Techno and Samurai armor silhouettes.',
    kind: 'historical-procedural',
    sourceCommit: 'd11705e6aeab',
    timelineIndex: 5
  },
  {
    id: 'commit-cae32dc0',
    label: 'Ninja Detail Pass',
    shortLabel: 'C06 · cae32dc0',
    description: 'Sep 24 hood, cuff, knee, boot and mask-detail refinement.',
    kind: 'historical-procedural',
    sourceCommit: 'cae32dc0e722',
    timelineIndex: 6
  },
  {
    id: 'commit-3dfe70cb',
    label: 'Procedural Realism',
    shortLabel: 'C07 · 3dfe70cb',
    description: 'Sep 25 procedural NINJAGO realism revision with upgraded plastic materials and geometry.',
    kind: 'historical-procedural',
    sourceCommit: '3dfe70cb5b31',
    timelineIndex: 7
  },
  {
    id: 'commit-8c67c327',
    label: 'Tournament Geometry',
    shortLabel: 'C08 · 8c67c327',
    description: 'Sep 25 distinctive Tournament-character geometry revision.',
    kind: 'historical-procedural',
    sourceCommit: '8c67c3277784',
    timelineIndex: 8
  },
  {
    id: 'commit-67a0ba97',
    label: 'Wave-1 Geometry',
    shortLabel: 'C09 · 67a0ba97',
    description: 'Latest shared procedural renderer revision, adding geometry for the remaining Wave-1 fighters.',
    kind: 'historical-procedural',
    sourceCommit: '67a0ba97a0de',
    timelineIndex: 9
  }
];

function authoredFirst(characterId: string): CharacterDesign {
  return {
    id: 'commit-0170de08',
    label: 'First Authored GLB',
    shortLabel: 'C10 · 0170de08',
    description: 'First authored-body design (introduced at 113a74c1) using the working buffer-fixed revision 0170de08.',
    kind: 'authored',
    assetUrl: `/assets/models/fighters/variants/${characterId}/authored-v1.glb`,
    sourceCommit: '0170de08cb5c',
    timelineIndex: 10
  };
}

function authoredHighFidelity(characterId: string): CharacterDesign {
  return {
    id: 'commit-0bfc3094',
    label: 'High-Fidelity Authored',
    shortLabel: 'C11 · 0bfc3094',
    description: 'High-fidelity authored body with faces, hair and layered outfit detail; this is the working revision after the hair-expression fix.',
    kind: 'authored',
    assetUrl: `/assets/models/fighters/variants/${characterId}/authored-v2.glb`,
    sourceCommit: '0bfc30944669',
    timelineIndex: 11
  };
}

const LLOYD_TIMELINE: CharacterDesign[] = [
  {
    id: 'commit-425c89d4',
    label: 'Detailed Lloyd',
    shortLabel: 'C12 · 425c89d4',
    description: 'Hand-built detailed Lloyd with blond procedural hair, layered green/gold outfit, armor and energy-weapon silhouette.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/lloyd-detailed.glb',
    sourceCommit: '425c89d402a2',
    timelineIndex: 12
  },
  {
    id: 'commit-6860d027',
    label: 'Exact Mould Initial',
    shortLabel: 'C13 · 6860d027',
    description: 'First dedicated LDraw-derived exact-mould Lloyd production generator.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/exact-6860d027.glb',
    sourceCommit: '6860d0274f71',
    timelineIndex: 13
  },
  {
    id: 'commit-70f95ff9',
    label: 'Exact Mould Intermediate',
    shortLabel: 'C14 · 70f95ff9',
    description: 'Intermediate exact-mould production pass from the former Lloyd generator path.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/exact-70f95ff9.glb',
    sourceCommit: '70f95ff967a3',
    timelineIndex: 14
  },
  {
    id: 'commit-05b7ce43',
    label: 'Exact Mould Refined',
    shortLabel: 'C15 · 05b7ce43',
    description: 'Exact-mould silhouette, bandana, front orientation and Tournament print-placement refinement.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/exact-05b7ce43.glb',
    sourceCommit: '05b7ce43000e',
    timelineIndex: 15
  },
  {
    id: 'commit-961edd9b',
    label: 'Exact Mould + Back Emblem',
    shortLabel: 'C16 · 961edd9b',
    description: 'Latest Lloyd visual revision: refined exact-mould design plus rear Tournament power emblem.',
    kind: 'authored',
    assetUrl: '/assets/models/fighters/variants/lloyd-tournament/lloyd-exact.glb',
    sourceCommit: '961edd9b4692',
    timelineIndex: 16
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
  return 'commit-67a0ba97';
}

const LEGACY_SELECTION_MAP: Readonly<Record<string, string>> = {
  procedural: 'commit-67a0ba97',
  'authored-v1': 'commit-0170de08',
  'authored-v2': 'commit-0bfc3094',
  'lloyd-detailed': 'commit-425c89d4',
  'lloyd-exact': 'commit-961edd9b'
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
