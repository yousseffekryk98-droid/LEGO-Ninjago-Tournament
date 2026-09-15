import { expect, test } from '@playwright/test';
import { ROSTER } from '../../src/roster';

test('roster data is complete, unique, and playable', () => {
  expect(ROSTER.length).toBe(43);
  expect(new Set(ROSTER.map((fighter) => fighter.id)).size).toBe(ROSTER.length);
  expect(ROSTER.filter((fighter) => fighter.unlockedByDefault).length).toBeGreaterThanOrEqual(4);

  const specials = new Set(ROSTER.map((fighter) => fighter.special));
  for (const special of ['spinjitzu', 'boost', 'charge', 'overload', 'airstrike', 'toxic-cloud', 'shout']) {
    expect(specials.has(special as never), `missing special family ${special}`).toBeTruthy();
  }

  for (const fighter of ROSTER) {
    expect(fighter.id.length).toBeGreaterThan(2);
    expect(fighter.name.length).toBeGreaterThan(1);
    expect(fighter.element.length).toBeGreaterThan(1);
    expect(fighter.speed).toBeGreaterThan(0);
    expect(fighter.damage).toBeGreaterThan(0);
    expect(fighter.maxHealth).toBeGreaterThanOrEqual(3);
    expect(fighter.cost).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(fighter.color)).toBeTruthy();
    expect(Number.isInteger(fighter.accent)).toBeTruthy();
  }
});
