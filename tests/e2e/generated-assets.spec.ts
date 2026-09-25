import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('generated Chen center pillar is a valid GLB 2.0 asset', async () => {
  const path = resolve('public/assets/models/arena/chen-center-pillar.glb');
  const file = await readFile(path);

  expect(file.byteLength).toBeGreaterThan(40_000);
  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.byteLength);

  const jsonLength = file.readUInt32LE(12);
  expect(file.readUInt32LE(16)).toBe(0x4e4f534a);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8').trim());
  expect(json.asset.version).toBe('2.0');
  expect(json.scenes[0].name).toBe('ChenCenterPillar');
  expect(json.materials.map((material: { name?: string }) => material.name)).toContain('SerpentRed');
  expect(json.nodes.length).toBeGreaterThan(100);
});

test('generated Chen arena gate is a valid GLB 2.0 asset', async () => {
  const path = resolve('public/assets/models/arena/chen-gate.glb');
  const file = await readFile(path);

  expect(file.byteLength).toBeGreaterThan(15_000);
  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.byteLength);

  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8').trim());
  expect(json.scenes[0].name).toBe('ChenArenaGate');
  expect(json.materials.map((material: { name?: string }) => material.name)).toContain('DoorRed');
  expect(json.nodes.length).toBeGreaterThan(45);
});


test('generated serpent column is a valid GLB 2.0 asset', async () => {
  const path = resolve('public/assets/models/arena/serpent-column.glb');
  const file = await readFile(path);
  expect(file.byteLength).toBeGreaterThan(12_000);
  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.byteLength);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8').trim());
  expect(json.scenes[0].name).toBe('ChenSerpentColumn');
  expect(json.materials.map((material: { name?: string }) => material.name)).toContain('SerpentRed');
  expect(json.nodes.length).toBeGreaterThan(15);
});

test('generated Chen gong is a valid GLB 2.0 asset', async () => {
  const path = resolve('public/assets/models/arena/chen-gong.glb');
  const file = await readFile(path);
  expect(file.byteLength).toBeGreaterThan(8_000);
  expect(file.readUInt32LE(0)).toBe(0x46546c67);
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.byteLength);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8').trim());
  expect(json.scenes[0].name).toBe('ChenArenaGong');
  expect(json.materials.map((material: { name?: string }) => material.name)).toContain('GongBronze');
  expect(json.nodes.length).toBeGreaterThan(8);
});


test('generated core fighter GLBs preserve the animation-part contract', async () => {
  const ids = [
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
  ];
  const requiredParts = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];

  for (const id of ids) {
    const path = resolve(`public/assets/models/fighters/${id}.glb`);
    const file = await readFile(path);
    expect(file.byteLength, id).toBeGreaterThan(7_000);
    expect(file.readUInt32LE(0), id).toBe(0x46546c67);
    expect(file.readUInt32LE(4), id).toBe(2);
    expect(file.readUInt32LE(8), id).toBe(file.byteLength);
    const jsonLength = file.readUInt32LE(12);
    const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8').trim());
    expect(json.scenes[0].name, id).toBe(`Fighter_${id}`);
    const names = new Set(json.nodes.map((node: { name?: string }) => node.name));
    for (const part of requiredParts) expect(names.has(part), `${id} missing ${part}`).toBeTruthy();

    if (id === 'lloyd-tournament') {
      expect(file.byteLength).toBeGreaterThan(100_000);
      for (const exactNode of [
        'torsoMould973',
        'headMould3626b',
        'hairMould61183',
        'bandanaMould15619',
        'leftArmMould3818',
        'rightArmMould3819',
        'leftHandMould3820',
        'rightHandMould3820',
        'hipsExact3815'
      ]) {
        expect(names.has(exactNode), `Lloyd missing exact mould node ${exactNode}`).toBeTruthy();
      }
      const materialNames = new Set(json.materials.map((material: { name?: string }) => material.name));
      for (const material of ['TournamentGreen', 'SkinYellow', 'Black', 'TanHair', 'WarmGold', 'Olive']) {
        expect(materialNames.has(material), `Lloyd missing ${material} material`).toBeTruthy();
      }
    }
  }
});


test('supplied Lloyd Kai and Jay look references are bundled as WebP assets', async () => {
  for (const id of ['lloyd', 'kai', 'jay']) {
    const file = await readFile(resolve(`public/assets/reference/${id}-user-reference.webp`));
    expect(file.byteLength, id).toBeGreaterThan(2_000);
    expect(file.subarray(0, 4).toString('ascii'), id).toBe('RIFF');
    expect(file.subarray(8, 12).toString('ascii'), id).toBe('WEBP');
  }
});

test('high-fidelity hero GLBs include faces hair and outfit-specific detail', async () => {
  const heroRequirements: Record<string, string[]> = {
    // Tournament Lloyd intentionally has no visible mouth or bulky shoulder armor:
    // the exact 15619 ninja bandana covers the lower face and the physical njo0123
    // figure uses bare yellow arms with black hands.
    'lloyd-tournament': [
      'leftEye', 'rightEye', 'leftBrow', 'rightBrow',
      'hairMould61183', 'bandanaMould15619',
      'tournamentSash', 'powerMedallionDisk', 'backPowerEmblemRing',
      'leftArmMould3818', 'rightArmMould3819',
      'leftHandMould3820', 'rightHandMould3820'
    ],
    'kai-tournament': ['leftEye', 'rightEye', 'leftBrow', 'rightBrow', 'kaiHeadband', 'hairCap', 'hairSpike0', 'leftShoulderArmor', 'rightShoulderArmor'],
    'jay-tournament': ['leftEye', 'rightEye', 'leftBrow', 'rightBrow', 'hairCap', 'hairLock0', 'jayChestStrap', 'jayBuckle']
  };

  const materialRequirements: Record<string, string[]> = {
    'lloyd-tournament': ['TanHair', 'TournamentGreen', 'SkinYellow', 'Black', 'WarmGold', 'White'],
    'kai-tournament': ['Hair', 'Secondary', 'Eye', 'White'],
    'jay-tournament': ['Hair', 'Secondary', 'Eye', 'White']
  };

  for (const [id, required] of Object.entries(heroRequirements)) {
    const file = await readFile(resolve(`public/assets/models/fighters/${id}.glb`));
    const jsonLength = file.readUInt32LE(12);
    const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8').trim());
    const names = new Set(json.nodes.map((node: { name?: string }) => node.name));
    for (const part of required) expect(names.has(part), `${id} missing ${part}`).toBeTruthy();
    expect(json.nodes.length, id).toBeGreaterThan(35);
    if (id === 'lloyd-tournament') {
      for (const inaccurateLegacyPart of ['leftShoulderGold', 'rightShoulderGold', 'energyBlade', 'backSwordBlade', 'mouth', 'hairLock0']) {
        expect(names.has(inaccurateLegacyPart), `Lloyd should not include legacy placeholder ${inaccurateLegacyPart}`).toBeFalsy();
      }
    }
    expect(json.materials.map((material: { name?: string }) => material.name), id).toEqual(
      expect.arrayContaining(materialRequirements[id])
    );
  }
});
