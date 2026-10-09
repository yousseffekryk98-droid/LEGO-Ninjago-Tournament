import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeGlb, parseGlb, remaster } from './remaster-tournament-fighters.mjs';

function fixture() {
  return {
    asset: { version: '2.0' },
    nodes: ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map((name) => ({ name, children: [] })),
    meshes: ['PrimaryBox', 'PrimaryCylinder', 'SkinSphere'].map((name) => ({
      name,
      primitives: [{ attributes: { POSITION: 0 }, material: 0 }]
    })),
    materials: [{ name: 'Base' }],
    scenes: [{ nodes: [0, 1, 2, 3, 4, 5] }],
    buffers: [{ byteLength: 4 }]
  };
}

test('round-trips valid GLB and preserves binary geometry', () => {
  const binary = Buffer.from([1, 2, 3, 4]);
  const encoded = encodeGlb(fixture(), binary);
  const parsed = parseGlb(encoded);
  assert.deepEqual(parsed.gltf, fixture());
  assert.deepEqual(Buffer.from(parsed.binary), binary);
  assert.throws(() => parseGlb(Buffer.from('no')), /Invalid GLB/);
});

test('remastered ninjas add face and uniform detail on the original articulation joints', () => {
  for (const id of ['kai-tournament', 'jay-tournament', 'cole-tournament', 'zane-techno', 'zane-zx']) {
    const gltf = remaster(fixture(), id);
    const names = new Set(gltf.nodes.map((node) => node.name));
    for (const value of ['remasterMaskLower', 'remasterHoodCrown', 'remasterChestMedallion', 'remasterKneeWrap-1']) {
      assert.ok(names.has(value), `${id} missing ${value}`);
    }
    for (const name of ['torso', 'head', 'leftLeg', 'rightLeg']) {
      assert.ok(gltf.nodes.find((node) => node.name === name)?.children?.length > 0, `${id}: empty joint ${name}`);
    }
    for (const name of ['leftArm', 'rightArm']) {
      assert.ok(gltf.nodes.some((node) => node.name === name), `${id}: missing arm joint ${name}`);
    }
    const payload = encodeGlb(gltf, Buffer.from([1, 2, 3, 4]));
    assert.equal(parseGlb(payload).gltf.asset.extras.remaster, true);
  }
});

test('samurai, elemental and master variants retain distinct silhouettes', () => {
  for (const id of ['nya', 'skylor', 'master-chen', 'master-garmadon']) {
    const gltf = remaster(fixture(), id);
    const names = gltf.nodes.map((node) => node.name);
    assert.ok(names.includes('remasterTempleBand'), id);
    assert.ok(names.includes(id === 'nya' ? 'remasterSamuraiSkirt-1' : 'remasterDiagonalSash'), id);
  }
  assert.throws(() => remaster(fixture(), 'not-a-fighter'), /Unknown remaster fighter/);
});
