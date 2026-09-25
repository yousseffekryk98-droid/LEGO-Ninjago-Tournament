import { expect, test } from '@playwright/test';
import {
  ROSTER,
  EXPANDED_CHARACTER_CATALOG,
  createCharacterModel,
  findCharacter,
  getBossRushRoster,
  getCharacterIdentity,
  getCharacterModelProfile,
  getCharacterReferenceImage,
  getCharacterSvgIcon,
  OFFICIAL_REFERENCE_IMAGE_COUNT,
  getElementCombatTheme,
  getCharacterDesigns,
  getDefaultCharacterDesignId
} from '../../src/features/characters';
import { applyFighterXp, fighterLevelFromXp } from '../../src/features/progression';

test('every fighter exposes a selectable design and historical core generations are preserved', () => {
  for (const fighter of ROSTER) {
    expect(getCharacterDesigns(fighter.id).length, \`\${fighter.id} should have a design choice\`).toBeGreaterThanOrEqual(1);
  }

  expect(getCharacterDesigns('lloyd-tournament').map((design) => design.id)).toEqual([
    'procedural',
    'authored-v1',
    'authored-v2',
    'lloyd-detailed',
    'lloyd-exact'
  ]);
  expect(getDefaultCharacterDesignId('lloyd-tournament')).toBe('lloyd-detailed');

  expect(getCharacterDesigns('kai-tournament').map((design) => design.id)).toEqual([
    'procedural',
    'authored-v1',
    'authored-v2'
  ]);
  expect(getDefaultCharacterDesignId('kai-tournament')).toBe('authored-v2');

  expect(getCharacterDesigns('tox').map((design) => design.id)).toEqual(['procedural']);
  expect(getDefaultCharacterDesignId('tox')).toBe('procedural');
});

test('roster data is complete, unique, and playable', () => {
  expect(ROSTER.length).toBe(58 + EXPANDED_CHARACTER_CATALOG.length);
  expect(new Set(ROSTER.map((fighter) => fighter.id)).size).toBe(ROSTER.length);
  expect(ROSTER.filter((fighter) => fighter.unlockedByDefault).length).toBeGreaterThanOrEqual(4);

  for (const requiredId of ['master-chen', 'techno-wu', 'tox', 'karlof', 'paleman', 'neuro', 'griffin-turner', 'jacob-pevsner', 'bolobo', 'gravis', 'kapau', 'chope', 'krait', 'sleven', 'zane-techno', 'zane-battle-damaged', 'snike', 'bytar', 'skales', 'kai-zx']) {
    expect(ROSTER.some((fighter) => fighter.id === requiredId), `missing documented fighter ${requiredId}`).toBeTruthy();
  }
  expect(ROSTER.some((fighter) => fighter.id === 'catalog-ronin'), 'Ronin should now be playable from the expanded catalog').toBeTruthy();

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
    expect(fighter.power?.length ?? 0, `${fighter.id} missing power`).toBeGreaterThan(0);
    expect(fighter.normalAttack?.length ?? 0, `${fighter.id} missing normal attack`).toBeGreaterThan(0);
    expect(fighter.specialAttack?.length ?? 0, `${fighter.id} missing special attack`).toBeGreaterThan(0);
    expect(fighter.spinjitzu?.length ?? 0, `${fighter.id} missing Spinjitzu`).toBeGreaterThan(0);
    expect(fighter.ultimateSpinjitzu?.length ?? 0, `${fighter.id} missing ultimate`).toBeGreaterThan(0);
    expect(fighter.passive?.length ?? 0, `${fighter.id} missing passive`).toBeGreaterThan(0);
  }

  for (const entry of EXPANDED_CHARACTER_CATALOG) {
    const fighter = findCharacter(`catalog-${entry.id}`);
    expect(fighter.id).toBe(`catalog-${entry.id}`);
    expect(fighter.name).toBe(entry.name);
    expect(fighter.power).toBe(entry.power);
    expect(fighter.sourceEra).toBe(entry.era);
    expect(fighter.sourceGroup).toBe(entry.group);
  }
});

test('verified official LEGO reference images cover supported core ninja without mislabeling variants', () => {
  expect(OFFICIAL_REFERENCE_IMAGE_COUNT).toBe(4);

  for (const id of ['kai-tournament', 'jay-tournament', 'zane-techno', 'nya']) {
    const reference = getCharacterReferenceImage(findCharacter(id));
    expect(reference, `${id} missing reference image`).toBeTruthy();
    expect(reference!.imageUrl).toMatch(/^https:\/\/www\.lego\.com\/cdn\//);
    expect(reference!.sourceUrl).toMatch(/^https:\/\/www\.lego\.com\//);
    expect(reference!.sourceLabel).toContain('Official LEGO');
  }

  const bizarro = ROSTER.find((fighter) => fighter.name === 'Bizarro Kai');
  if (bizarro) expect(getCharacterReferenceImage(bizarro)).toBeNull();
  expect(getCharacterReferenceImage(findCharacter('master-chen'))).toBeNull();
});

test('Zane is surfaced as the primary character name with the suit as a variant', () => {
  const zane = findCharacter('zane-techno');
  expect(getCharacterIdentity(zane)).toEqual({ name: 'Zane', variant: 'Techno' });
});

test('representative roster fighters build stable 3d models with animation parts', () => {
  const modelSample = Array.from(new Map([
    ...ROSTER.slice(0, 58),
    ...ROSTER.filter((_, index) => index >= 58 && index % 18 === 0)
  ].map((fighter) => [fighter.id, fighter])).values());

  for (const fighter of modelSample) {
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


test('elemental kick themes distinguish core ninja powers', () => {
  expect(getElementCombatTheme('Fire').effect).toBe('fire');
  expect(getElementCombatTheme('Fire').icon).toBe('🔥');
  expect(getElementCombatTheme('Ice').effect).toBe('ice');
  expect(getElementCombatTheme('Ice').icon).toBe('❄');
  expect(getElementCombatTheme('Lightning').effect).toBe('lightning');
  expect(getElementCombatTheme('Earth').effect).toBe('earth');
  expect(getElementCombatTheme('Energy').effect).toBe('energy');
  expect(getElementCombatTheme('Water').effect).toBe('water');
});

test('expanded powers resolve to power-matched VFX families', () => {
  expect(getElementCombatTheme('Heat').effect).toBe('fire');
  expect(getElementCombatTheme('Quake').effect).toBe('earth');
  expect(getElementCombatTheme('Technology').effect).toBe('lightning');
  expect(getElementCombatTheme('Fear').effect).toBe('mind');
  expect(getElementCombatTheme('Decay').effect).toBe('poison');
  expect(getElementCombatTheme('Chaos').effect).toBe('shadow');
  expect(getElementCombatTheme('Surface Tension').effect).toBe('water');
});

test('fighter levels add permanent stats and extra heart capacity', () => {
  const kai = findCharacter('kai-tournament');
  expect(fighterLevelFromXp(0)).toBe(1);
  expect(fighterLevelFromXp(2200)).toBe(3);
  const level3 = applyFighterXp(kai, 2200);
  expect(level3.damage).toBeGreaterThan(kai.damage);
  expect(level3.speed).toBeGreaterThan(kai.speed);
  expect(level3.maxHealth).toBe(kai.maxHealth + 1);
  const level5 = applyFighterXp(kai, 8000);
  expect(level5.maxHealth).toBe(kai.maxHealth + 2);
});


test('wave-one tournament fighters have distinct identity geometry and SVG icons', () => {
  const expectedParts: Record<string, string> = {
    'master-chen': 'chenHatCrown',
    clouse: 'clouseForeheadGem',
    eyezor: 'eyezorPatch',
    zugu: 'zuguHeadBand',
    karlof: 'karlofGauntlet1',
    'griffin-turner': 'griffinHairSpike2',
    shade: 'shadeScarfTailLeft',
    neuro: 'neuroMindGem',
    paleman: 'palemanHalo',
    tox: 'toxCanister1',
    skylor: 'skylorPonytail',
    chamille: 'chamilleHair0',
    ash: 'ashHairCap',
    'jacob-pevsner': 'jacobSoundDisc1',
    bolobo: 'boloboLeaf0',
    gravis: 'gravisHalo',
    kapau: 'kapauHeadBand',
    chope: 'chopeHairSpike1',
    krait: 'kraitCrestForkLeft',
    sleven: 'slevenCrestBlade'
  };

  const svgIcons = new Set<string>();
  for (const [id, part] of Object.entries(expectedParts)) {
    const fighter = findCharacter(id);
    const profile = getCharacterModelProfile(fighter);
    expect(profile.identityStyle, `${id} missing identity style`).toBeTruthy();

    const model = createCharacterModel(fighter);
    expect(model.getObjectByName(part), `${id} missing identity geometry ${part}`).toBeTruthy();

    const icon = getCharacterSvgIcon(fighter);
    expect(icon.startsWith('data:image/svg+xml;charset=utf-8,')).toBeTruthy();
    svgIcons.add(icon);
  }

  expect(svgIcons.size).toBe(Object.keys(expectedParts).length);
});


test('remaining Wave-1 powers have distinct combat themes', () => {
  expect(getElementCombatTheme('Sound').effect).toBe('sound');
  expect(getElementCombatTheme('Nature').effect).toBe('nature');
  expect(getElementCombatTheme('Gravity').effect).toBe('gravity');
  expect(getElementCombatTheme('Combat').effect).toBe('force');
  expect(new Set([
    getElementCombatTheme('Sound').trailStyle,
    getElementCombatTheme('Nature').trailStyle,
    getElementCombatTheme('Gravity').trailStyle
  ]).size).toBe(3);
});


test('boss rush prioritizes Tournament challengers then still covers the full playable roster', () => {
  const playerId = 'lloyd-tournament';
  const order = getBossRushRoster(playerId);
  expect(order).toHaveLength(ROSTER.length - 1);
  expect(new Set(order.map((fighter) => fighter.id)).size).toBe(order.length);
  expect(order.some((fighter) => fighter.id === playerId)).toBeFalsy();

  const opening = order.slice(0, 6).map((fighter) => fighter.id);
  expect(opening).toEqual(['karlof', 'griffin-turner', 'shade', 'neuro', 'paleman', 'tox']);

  for (const id of ['jacob-pevsner', 'bolobo', 'gravis', 'kapau', 'chope', 'krait', 'sleven', 'master-chen']) {
    expect(order.some((fighter) => fighter.id === id), `missing ${id} from boss rush`).toBeTruthy();
  }
});
