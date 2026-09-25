/**
 * Extended NINJAGO character planning catalog.
 *
 * This is intentionally separate from the live ROSTER in roster.ts.
 * Entries here are staged candidates and do not automatically become playable.
 * Names/powers come from the project owner's supplied roster notes.
 * Wave numbers and asset strategy are implementation planning decisions.
 */
export type RosterImplementationWave = 1 | 2 | 3 | 4;

export interface ExpandedCharacterCatalogEntry {
  id: string;
  name: string;
  power: string;
  era: string;
  group: string;
  wave: RosterImplementationWave;
}

export const REQUIRED_CHARACTER_ASSETS = ['portrait', 'svg-icon', 'procedural-3d'] as const;

export const EXPANDED_CHARACTER_CATALOG: readonly ExpandedCharacterCatalogEntry[] = [

];

export const getExpandedCatalogWave = (wave: RosterImplementationWave) =>
  EXPANDED_CHARACTER_CATALOG.filter((entry) => entry.wave === wave);

export const findExpandedCatalogEntry = (id: string) =>
  EXPANDED_CHARACTER_CATALOG.find((entry) => entry.id === id);

export const getExpandedCatalogByEra = (era: string) =>
  EXPANDED_CHARACTER_CATALOG.filter((entry) => entry.era === era);
