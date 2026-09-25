import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import {
  ArenaHazardManager,
  DEFAULT_ARENA_HAZARD_ANCHORS,
  getArenaHazardDifficulty,
  validateArenaHazardLayout,
  type ArenaHazardAnchor
} from '../../src/features/combat/arena-hazards';

test('arena pit and spike anchors are separated and preserve spawn safety', () => {
  const validation = validateArenaHazardLayout(DEFAULT_ARENA_HAZARD_ANCHORS);
  expect(validation.valid, validation.errors.join('\n')).toBeTruthy();
  expect(validation.errors).toEqual([]);
  expect(DEFAULT_ARENA_HAZARD_ANCHORS.filter((hazard) => hazard.kind === 'pit')).toHaveLength(4);
  expect(DEFAULT_ARENA_HAZARD_ANCHORS.filter((hazard) => hazard.kind === 'spikes')).toHaveLength(4);
  expect(new Set(DEFAULT_ARENA_HAZARD_ANCHORS.map((hazard) => hazard.id)).size).toBe(DEFAULT_ARENA_HAZARD_ANCHORS.length);
});

test('hazard difficulty increases concurrency gradually instead of activating everything at once', () => {
  expect(getArenaHazardDifficulty(1)).toEqual({ maxConcurrent: 1, cooldownScale: 1 });
  expect(getArenaHazardDifficulty(5)).toEqual({ maxConcurrent: 2, cooldownScale: 0.82 });
  expect(getArenaHazardDifficulty(9)).toEqual({ maxConcurrent: 3, cooldownScale: 0.7 });
});

test('collapsing pit warns, opens, becomes lethal, and later restores', () => {
  const scene = new THREE.Scene();
  const anchor: ArenaHazardAnchor = { id: 'test-pit', kind: 'pit', x: 12, z: 12, radius: 2.65, minWave: 2 };
  const hazards = new ArenaHazardManager(scene, [anchor], () => 0);

  for (let i = 0; i < 58; i++) hazards.update(0.1, 2, []);
  expect(hazards.getSnapshot()[0].phase).toBe('warning');

  for (let i = 0; i < 13; i++) hazards.update(0.1, 2, []);
  expect(hazards.getSnapshot()[0].phase).toBe('active');

  const impact = hazards.update(0.5, 2, [{
    id: 'player',
    position: new THREE.Vector3(12, 0, 12),
    grounded: true
  }]);
  expect(impact.impacts).toEqual([{
    hazardId: 'test-pit',
    hazardKind: 'pit',
    targetId: 'player',
    lethal: true
  }]);

  for (let i = 0; i < 40; i++) hazards.update(0.1, 2, []);
  expect(hazards.getSnapshot()[0].phase).toBe('idle');
  hazards.destroy();
});

test('spike trap is telegraphed and damages a grounded target only once per activation', () => {
  const scene = new THREE.Scene();
  const anchor: ArenaHazardAnchor = { id: 'test-spikes', kind: 'spikes', x: 10, z: 10, radius: 1.35, minWave: 1 };
  const hazards = new ArenaHazardManager(scene, [anchor], () => 0);

  for (let i = 0; i < 35; i++) hazards.update(0.1, 1, []);
  expect(hazards.getSnapshot()[0].phase).toBe('warning');

  for (let i = 0; i < 9; i++) hazards.update(0.1, 1, []);
  expect(hazards.getSnapshot()[0].phase).toBe('active');

  const target = {
    id: 'enemy',
    position: new THREE.Vector3(10, 0, 10),
    grounded: true
  };
  const first = hazards.update(0.3, 1, [target]);
  const second = hazards.update(0.1, 1, [target]);
  expect(first.impacts).toHaveLength(1);
  expect(first.impacts[0].lethal).toBeFalsy();
  expect(second.impacts).toHaveLength(0);

  hazards.destroy();
});
