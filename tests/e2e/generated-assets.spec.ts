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
