import { expect, test } from '@playwright/test';
import {
  ROSTER,
  createCharacterModel,
  findCharacter,
  getCharacterIdentity
} from '../../src/features/characters';

test('roster data is complete, unique, and playable', () => {
  expect(ROSTER.length).toBe(51);
  expect(new Set(ROSTER.map((fighter) => fighter.id)).size).toBe(ROSTER.length);
  expect(ROSTER.filter((fighter) => fighter.unlockedByDefault).length).toBeGreaterThanOrEqual(4);

  for (const requiredId of ['master-chen', 'techno-wu', 'tox', 'karlof', 'paleman', 'neuro', 'griffin-turner', 'zane-techno', 'zane-battle-damaged', 'snike', 'bytar', 'skales', 'kai-zx']) {
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

test('every roster fighter builds a stable 3d model with animation parts', () => {
  for (const fighter of ROSTER) {
    const model = createCharacterModel(fighter);
    expect(model.name, fighter.id).toBe('fighterModel');
    expect(model.getObjectByName('torso'), `${fighter.id} missing torso`).toBeTruthy();
    expect(model.getObjectByName('head'), `${fighter.id} missing head`).toBeTruthy();
    expect(model.getObjectByName('leftArm'), `${fighter.id} missing leftArm`).toBeTruthy();
    expect(model.getObjectByName('rightArm'), `${fighter.id} missing rightArm`).toBeTruthy();
    expect(model.getObjectByName('headStud'), `${fighter.id} missing LEGO head stud`).toBeTruthy();
    expect(model.getObjectByName('weaponRig'), `${fighter.id} missing animated weapon rig`).toBeTruthy();
    expect(model.userData.modelProfile, `${fighter.id} missing model profile`).toBeTruthy();
  }

  const zane = createCharacterModel(findCharacter('zane-techno'));
  expect(zane.userData.modelProfile.archetype).toBe('nindroid');
  expect(zane.getObjectByName('shuriken1')).toBeTruthy();

  const garmadon = createCharacterModel(findCharacter('master-garmadon'));
  expect(garmadon.getObjectByName('leftArmUpper')).toBeTruthy();
  expect(garmadon.getObjectByName('rightArmUpper')).toBeTruthy();
});


test('level five fighters render True Potential visuals and documented obsidian variants', () => {
  const truePotentialKai = createCharacterModel({
    ...findCharacter('kai-dx'),
    potentialLevel: 5
  });
  expect(truePotentialKai.getObjectByName('truePotentialAura')).toBeTruthy();
  expect(truePotentialKai.getObjectByName('truePotentialLight')).toBeTruthy();
  expect(truePotentialKai.userData.modelProfile.weaponColor).toBe(0x252434);

  const normalKai = createCharacterModel({
    ...findCharacter('kai-dx'),
    potentialLevel: 4
  });
  expect(normalKai.getObjectByName('truePotentialAura')).toBeFalsy();
  expect(normalKai.userData.modelProfile.weaponColor).toBeUndefined();
});


test('video-observed legacy fighters have distinct model treatments', () => {
  const kaiZx = createCharacterModel(findCharacter('kai-zx'));
  expect(kaiZx.getObjectByName('shoulderPad1')).toBeTruthy();
  expect(kaiZx.getObjectByName('zxChestPlate')).toBeTruthy();
  expect(kaiZx.getObjectByName('zxBladeRack1')).toBeTruthy();
  expect(kaiZx.getObjectByName('headStud')).toBeTruthy();

  const damagedZane = createCharacterModel(findCharacter('zane-battle-damaged'));
  expect(damagedZane.getObjectByName('damagedChestPanel')).toBeTruthy();
  expect(damagedZane.getObjectByName('damagedFacePanel')).toBeTruthy();

  const snike = createCharacterModel(findCharacter('snike'));
  expect(snike.getObjectByName('leftLeg')).toBeTruthy();
  expect(snike.getObjectByName('serpentineTail')).toBeFalsy();

  const bytar = createCharacterModel(findCharacter('bytar'));
  expect(bytar.getObjectByName('leftLeg')).toBeTruthy();
  expect(bytar.getObjectByName('serpentineTail')).toBeFalsy();

  const skales = createCharacterModel(findCharacter('skales'));
  expect(skales.getObjectByName('serpentineTail')).toBeTruthy();
});


test('hooded ninja models include the refined shared minifigure detail', () => {
  const kai = createCharacterModel(findCharacter('kai-tournament'));
  expect(kai.getObjectByName('hoodCrown')).toBeTruthy();
  expect(kai.getObjectByName('hoodCheekLeft')).toBeTruthy();
  expect(kai.getObjectByName('maskLowerFold')).toBeTruthy();
  expect(kai.getObjectByName('leftArmCuff')).toBeTruthy();
  expect(kai.getObjectByName('rightArmWrap')).toBeTruthy();
  expect(kai.getObjectByName('leftKneeWrap')).toBeTruthy();
  expect(kai.getObjectByName('rightBootSole')).toBeTruthy();
});
