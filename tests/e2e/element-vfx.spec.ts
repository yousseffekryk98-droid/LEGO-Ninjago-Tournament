import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { getElementCombatTheme } from '../../src/features/characters';
import { ElementVfxSystem } from '../../src/features/combat/element-vfx';

test('core elements expose distinct visual identities beyond color', () => {
  const fire = getElementCombatTheme('Fire');
  const ice = getElementCombatTheme('Ice');
  const lightning = getElementCombatTheme('Lightning');
  const earth = getElementCombatTheme('Earth');
  const water = getElementCombatTheme('Water');
  const poison = getElementCombatTheme('Poison');

  expect(fire.particleShape).toBe('ember');
  expect(fire.trailStyle).toBe('flame');
  expect(fire.groundStyle).toBe('scorch');

  expect(ice.particleShape).toBe('ice-shard');
  expect(ice.impactStyle).toBe('shatter');

  expect(lightning.particleShape).toBe('spark');
  expect(lightning.trailStyle).toBe('arc');

  expect(earth.particleShape).toBe('rock');
  expect(earth.groundStyle).toBe('crack');

  expect(water.particleShape).toBe('droplet');
  expect(water.impactStyle).toBe('splash');

  expect(poison.particleShape).toBe('toxic-cloud');
  expect(poison.impactStyle).toBe('cloud');

  expect(new Set([fire.trailStyle, ice.trailStyle, lightning.trailStyle, earth.trailStyle, water.trailStyle, poison.trailStyle]).size).toBe(6);
});

test('element VFX system spawns and cleans short-lived effects without WebGL', () => {
  const scene = new THREE.Scene();
  const vfx = new ElementVfxSystem(scene, () => 0.5);
  const origin = new THREE.Vector3(0, 0, 0);
  const forward = new THREE.Vector3(0, 0, 1);

  vfx.spawnKick(getElementCombatTheme('Fire'), origin, forward);
  const fireCount = vfx.getActiveCount();
  expect(fireCount).toBeGreaterThan(8);

  vfx.spawnImpact(getElementCombatTheme('Ice'), new THREE.Vector3(1, 0, 0));
  expect(vfx.getActiveCount()).toBeGreaterThan(fireCount);

  vfx.spawnSpinjitzuBurst(getElementCombatTheme('Lightning'), origin);
  expect(vfx.getActiveCount()).toBeGreaterThan(fireCount + 8);

  vfx.update(3);
  expect(vfx.getActiveCount()).toBe(0);
  vfx.destroy();
});
