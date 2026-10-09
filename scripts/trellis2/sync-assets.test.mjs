import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCatalog, syncAssets, validateGlb } from './sync-assets.mjs';

function minimalGlb() {
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' }, meshes: [{ primitives: [{ attributes: {} }] }]
  }));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const glb = Buffer.alloc(20 + padded.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  return glb;
}

test('rejects invalid or empty model files', () => {
  assert.throws(() => validateGlb(Buffer.from('bad'), 'bad.glb'), /invalid GLB/);
  assert.equal(validateGlb(minimalGlb(), 'good.glb'), true);
});

test('registers only existing validated models and supports a check mode', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ninja-trellis-test-'));
  const output = join(directory, 'generated.ts');
  try {
    await writeFile(join(directory, 'kai-tournament.glb'), minimalGlb());
    await writeFile(join(directory, 'notes.txt'), 'not a model');
    assert.deepEqual(await syncAssets({ directory, output }), ['kai-tournament']);
    assert.match(await readFile(output, 'utf8'), /kai-tournament\.glb/);
    await syncAssets({ directory, output, check: true });
    await writeFile(output, createCatalog([]));
    await assert.rejects(syncAssets({ directory, output, check: true }), /out of sync/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
