import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import {
  CENTER_PILLAR_AUTHORED_ASSET_URL,
  CENTER_PILLAR_CLEARANCE,
  CENTER_PILLAR_RADIUS,
  buildLegacyCenterPillar,
  resolveCenterPillarCollision,
  updateCenterPillarOcclusion
} from '../../src/features/combat/arena-landmarks';

test('center serpent pillar is a tall named arena landmark with authored details', () => {
  const scene = new THREE.Scene();
  const pillar = buildLegacyCenterPillar(scene);

  expect(pillar.name).toBe('legacyCenterSerpentPillar');
  expect(scene.getObjectByName('legacyCenterSerpentPillar')).toBe(pillar);
  expect(scene.getObjectByName('centerPillarPlinth')).toBeTruthy();
  expect(scene.getObjectByName('centerPillarShaft')).toBeTruthy();
  expect(scene.getObjectByName('centerPillarSerpentBody')).toBeTruthy();
  expect(scene.getObjectByName('centerPillarSerpentHead')).toBeTruthy();
  expect(scene.getObjectByName('centerPillarSerpentTail')).toBeTruthy();
  expect(pillar.children.length).toBeGreaterThan(25);
  expect(CENTER_PILLAR_AUTHORED_ASSET_URL).toBe('/assets/models/arena/chen-center-pillar.glb');
  expect(pillar.userData.assetState).toBe('procedural-fallback');

  const box = new THREE.Box3().setFromObject(pillar);
  expect(box.max.y - box.min.y).toBeGreaterThan(10);
  expect(box.max.x - box.min.x).toBeGreaterThan(3);
});

test('pillar collision pushes fighters outside the landmark footprint', () => {
  const atCenter = new THREE.Vector3(0, 0, 0);
  expect(resolveCenterPillarCollision(atCenter)).toBeTruthy();
  expect(Math.hypot(atCenter.x, atCenter.z)).toBeCloseTo(
    CENTER_PILLAR_RADIUS + CENTER_PILLAR_CLEARANCE,
    5
  );

  const alreadyClear = new THREE.Vector3(6, 0, 0);
  expect(resolveCenterPillarCollision(alreadyClear)).toBeFalsy();
  expect(alreadyClear.x).toBe(6);
});

test('pillar fades when it would hide the player and restores when clear', () => {
  const scene = new THREE.Scene();
  const pillar = buildLegacyCenterPillar(scene);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 8, 15);

  updateCenterPillarOcclusion(pillar, camera, new THREE.Vector3(0, 0, -7), 1);
  const shaft = scene.getObjectByName('centerPillarShaft') as THREE.Mesh;
  const material = shaft.material as THREE.Material;
  expect(material.opacity).toBeLessThan(0.5);
  expect(material.depthWrite).toBeFalsy();

  updateCenterPillarOcclusion(pillar, camera, new THREE.Vector3(8, 0, 8), 1);
  expect(material.opacity).toBeGreaterThan(0.95);
  expect(material.depthWrite).toBeTruthy();
});
