import { expect, test } from '@playwright/test';
import {
  ROSTER,
  createCharacterModel,
  findCharacter,
  getCharacterIdentity
} from '../../src/features/characters';

test('roster data is complete, unique, and playable', () => {
  expect(ROSTER.length).toBe(46);
  expect(new Set(ROSTER.map((fighter) => fighter.id)).size).toBe(ROSTER.length);
  expect(ROSTER.filter((fighter) => fighter.unlockedByDefault).length).toBeGreaterThanOrEqual(4);

  for (const requiredId of ['master-chen', 'techno-wu', 'tox', 'karlof', 'paleman', 'neuro', 'griffin-turner', 'zane-techno']) {
    expect(ROSTER.some((fighter) => fighter.id === requiredId), `missing documented fighter ${requiredId}`).toBeTruthy();
  }
  expect(ROSTER.some((fighter) => fighter.id === 'ronin'), 'Ronin should remain boss-only').toBeFalsy();

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

test('Zane is surfaced as the primary character name with the suit as a variant', () => {
  const zane = findCharacter('zane-techno');
  expect(getCharacterIdentity(zane)).toEqual({ name: 'Zane', variant: 'Techno' });
});

test('3d character models expose stable named animation parts', () => {
  for (const fighter of [findCharacter('zane-techno'), findCharacter('kai-tournament'), findCharacter('master-garmadon')]) {
    const model = createCharacterModel(fighter);
    expect(model.name).toBe('fighterModel');
    expect(model.getObjectByName('torso')).toBeTruthy();
    expect(model.getObjectByName('head')).toBeTruthy();
    expect(model.getObjectByName('leftArm')).toBeTruthy();
    expect(model.getObjectByName('rightArm')).toBeTruthy();
  }

  const zane = createCharacterModel(findCharacter('zane-techno'));
  expect(zane.userData.modelProfile.archetype).toBe('nindroid');
  expect(zane.getObjectByName('shuriken1')).toBeTruthy();

  const garmadon = createCharacterModel(findCharacter('master-garmadon'));
  expect(garmadon.getObjectByName('leftArmUpper')).toBeTruthy();
  expect(garmadon.getObjectByName('rightArmUpper')).toBeTruthy();
});
