import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { buildTournamentFloorDetails } from '../../src/features/combat/arena-floor';
import { DEFAULT_ARENA_HAZARD_ANCHORS } from '../../src/features/combat/arena-hazards';

test('reconstructed tournament floor includes engraved rings, serpent work, and hazard inlays', () => {
  const scene = new THREE.Scene();
  const floor = buildTournamentFloorDetails(scene);

  expect(floor.name).toBe('legacyTournamentFloorDetails');
  expect(scene.getObjectByName('legacyTournamentFloorDetails')).toBe(floor);

  for (const anchor of DEFAULT_ARENA_HAZARD_ANCHORS) {
    expect(scene.getObjectByName(`floorInlay:${anchor.id}`), `missing floor inlay for ${anchor.id}`).toBeTruthy();
  }

  const inlays = floor.children.filter((child) => child.name.startsWith('floorInlay:'));
  expect(inlays).toHaveLength(DEFAULT_ARENA_HAZARD_ANCHORS.length);
  expect(scene.getObjectByName('centerPillarFootprint')).toBeTruthy();
  expect(floor.children.length).toBeGreaterThan(150);
});
