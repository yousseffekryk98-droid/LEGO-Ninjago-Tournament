import { ROSTER } from './roster';
import type { CharacterDef } from './types';

/**
 * Clean-room gauntlet ordering.
 *
 * The first stretch emphasizes the Tournament of Elements cast shown in the
 * progression UI. Every other playable fighter follows, so Boss Rush still
 * fulfills the "fight the whole roster" rule.
 */
export const BOSS_RUSH_PRIORITY_IDS = [
  'karlof',
  'griffin-turner',
  'shade',
  'neuro',
  'paleman',
  'tox',
  'jacob-pevsner',
  'bolobo',
  'chamille',
  'ash',
  'gravis',
  'skylor',
  'kapau',
  'chope',
  'eyezor',
  'zugu',
  'krait',
  'sleven',
  'clouse',
  'master-chen'
] as const;

export function getBossRushRoster(playerId: string): CharacterDef[] {
  const available = ROSTER.filter((fighter) => fighter.id !== playerId);
  const byId = new Map(available.map((fighter) => [fighter.id, fighter]));
  const ordered: CharacterDef[] = [];

  for (const id of BOSS_RUSH_PRIORITY_IDS) {
    const fighter = byId.get(id);
    if (!fighter) continue;
    ordered.push(fighter);
    byId.delete(id);
  }

  for (const fighter of available) {
    if (!byId.has(fighter.id)) continue;
    ordered.push(fighter);
    byId.delete(fighter.id);
  }

  return ordered;
}
