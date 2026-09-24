import type { CharacterDef } from '../characters';

export const LEVEL_THRESHOLDS = [0, 800, 2200, 4500, 8000] as const;

export function fighterLevelFromXp(rawXp: number) {
  const xp = Math.max(0, rawXp || 0);
  let level = 1;
  for (let index = 1; index < LEVEL_THRESHOLDS.length; index++) {
    if (xp >= LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  return Math.min(5, level);
}

export function xpProgressFromXp(rawXp: number) {
  const xp = Math.max(0, rawXp || 0);
  const level = fighterLevelFromXp(xp);
  if (level >= 5) return { xp, level, current: 1, target: 1, percent: 100 };
  const floor = LEVEL_THRESHOLDS[level - 1];
  const target = LEVEL_THRESHOLDS[level];
  const current = xp - floor;
  return {
    xp,
    level,
    current,
    target: target - floor,
    percent: Math.max(0, Math.min(100, current / (target - floor) * 100))
  };
}

export function fighterUpgradeCostFromXp(rawXp: number) {
  const xp = Math.max(0, rawXp || 0);
  const level = fighterLevelFromXp(xp);
  if (level >= 5) return 0;
  const floor = LEVEL_THRESHOLDS[level - 1];
  const target = LEVEL_THRESHOLDS[level];
  const remainingRatio = Math.max(0.05, Math.min(1, (target - xp) / Math.max(1, target - floor)));
  const fullLevelCosts = [1800, 3200, 5200, 8000];
  return Math.max(500, Math.ceil((fullLevelCosts[level - 1] * remainingRatio) / 100) * 100);
}

export function nextUpgradeCopyFromXp(rawXp: number) {
  const level = fighterLevelFromXp(rawXp);
  if (level >= 5) return 'MAX POTENTIAL · +2 MAX HEARTS';
  const next = level + 1;
  const heart = next === 3 || next === 5 ? ' · +1 MAX ♥' : '';
  return 'NEXT LV ' + next + ': +7% DMG · +0.12 SPD' + heart;
}

export function applyFighterLevel(base: CharacterDef, level: number): CharacterDef {
  const safeLevel = Math.max(1, Math.min(5, level));
  const bonus = safeLevel - 1;
  return {
    ...base,
    speed: base.speed + bonus * 0.12,
    damage: Math.round(base.damage * (1 + bonus * 0.07)),
    maxHealth: base.maxHealth + (safeLevel >= 3 ? 1 : 0) + (safeLevel >= 5 ? 1 : 0),
    potentialLevel: safeLevel
  };
}

export function applyFighterXp(base: CharacterDef, xp: number) {
  return applyFighterLevel(base, fighterLevelFromXp(xp));
}
