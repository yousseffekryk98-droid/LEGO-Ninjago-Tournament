import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const staticGlbCache = new Map<string, Promise<THREE.Group>>();

function loadStaticGlbSource(url: string) {
  const existing = staticGlbCache.get(url);
  if (existing) return existing;

  const pending = new GLTFLoader()
    .loadAsync(url)
    .then((gltf) => gltf.scene)
    .catch((error) => {
      staticGlbCache.delete(url);
      throw error;
    });

  staticGlbCache.set(url, pending);
  return pending;
}

function prepareStaticModel(root: THREE.Group) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;

    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const clonedMaterials = sourceMaterials.map((material) => {
      const clone = material.clone();
      clone.transparent = true;
      clone.userData.baseOpacity = clone.opacity;
      if (clone instanceof THREE.MeshStandardMaterial) {
        clone.envMapIntensity = Math.max(0.8, clone.envMapIntensity);
      }
      return clone;
    });
    object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0];
  });
  return root;
}

export async function loadStaticGlb(url: string) {
  const source = await loadStaticGlbSource(url);
  const root = source.clone(true);
  root.name = source.name || 'authoredStaticGlb';
  return prepareStaticModel(root);
}

export async function replaceWithStaticGlb(options: {
  holder: THREE.Group;
  fallback: readonly THREE.Object3D[];
  url: string;
  name: string;
}) {
  const { holder, fallback, url, name } = options;
  try {
    const model = await loadStaticGlb(url);
    model.name = name;
    holder.add(model);
    fallback.forEach((object) => {
      object.visible = false;
    });
    holder.userData.assetState = 'authored-glb';
    holder.userData.assetUrl = url;
    return model;
  } catch (error) {
    holder.userData.assetState = 'procedural-fallback';
    holder.userData.assetError = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to load authored GLB ${url}; keeping procedural fallback.`, error);
    return null;
  }
}

export function clearStaticGlbCache() {
  staticGlbCache.clear();
}
