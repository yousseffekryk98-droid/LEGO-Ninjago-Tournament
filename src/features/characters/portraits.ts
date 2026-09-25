import * as THREE from 'three';
import type { CharacterDef } from './types';
import { createCharacterModel } from './model';

export const USER_CHARACTER_PORTRAITS: Readonly<Record<string, string>> = {
  'lloyd-tournament': '/assets/reference/lloyd-user-reference.webp',
  'kai-tournament': '/assets/reference/kai-user-reference.webp',
  'jay-tournament': '/assets/reference/jay-user-reference.webp'
};

const portraitCache = new Map<string, string>(Object.entries(USER_CHARACTER_PORTRAITS));

export function getUserCharacterPortrait(characterId: string) {
  return USER_CHARACTER_PORTRAITS[characterId] ?? null;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function buildPortraitScene(character: CharacterDef) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 30);
  camera.position.set(0, 2.26, 4.05);
  camera.lookAt(0, 1.78, 0);

  const hemi = new THREE.HemisphereLight(0xfff3d6, 0x272032, 2.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe2a6, 4.1);
  key.position.set(-3.2, 5.7, 4.6);
  scene.add(key);

  const rim = new THREE.DirectionalLight(character.accent, 2.0);
  rim.position.set(4.1, 3.2, -3.4);
  scene.add(rim);

  const fighter = createCharacterModel(character, 1.24);
  fighter.position.set(0, -0.3, 0);
  fighter.rotation.y = -0.16;
  scene.add(fighter);

  return { scene, camera, fighter };
}

export function getCachedCharacterPortrait(characterId: string) {
  return portraitCache.get(characterId);
}

export async function renderCharacterPortraits(characters: CharacterDef[]) {
  const missing = characters.filter((character) => !portraitCache.has(character.id));
  if (missing.length === 0) return portraitCache;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(1);
  renderer.setSize(176, 176, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setClearColor(0x000000, 0);

  for (const character of missing) {
    const { scene, camera, fighter } = buildPortraitScene(character);
    renderer.render(scene, camera);
    portraitCache.set(character.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(fighter);
    disposeObject(fighter);

    // Yield between portraits so opening the 51-fighter roster never freezes the UI.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  renderer.dispose();
  renderer.forceContextLoss();
  return portraitCache;
}
