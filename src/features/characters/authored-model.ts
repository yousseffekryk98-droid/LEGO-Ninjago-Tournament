import * as THREE from 'three';
import { loadStaticGlb } from '../../shared/three/gltf-assets';

export const AUTHORED_CHARACTER_ASSETS: Readonly<Record<string, string>> = {
  'lloyd-tournament': '/assets/models/fighters/lloyd-tournament.glb',
  'kai-tournament': '/assets/models/fighters/kai-tournament.glb',
  'jay-tournament': '/assets/models/fighters/jay-tournament.glb',
  'cole-tournament': '/assets/models/fighters/cole-tournament.glb',
  'zane-techno': '/assets/models/fighters/zane-techno.glb',
  'zane-zx': '/assets/models/fighters/zane-zx.glb',
  nya: '/assets/models/fighters/nya.glb',
  'master-garmadon': '/assets/models/fighters/master-garmadon.glb',
  'master-chen': '/assets/models/fighters/master-chen.glb',
  skylor: '/assets/models/fighters/skylor.glb'
};

const ANIMATED_BODY_PARTS = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

function keepProceduralChildVisible(object: THREE.Object3D) {
  return object.name === 'weaponRig'
    || object.name === 'truePotentialAura'
    || object.name === 'truePotentialLight'
    || object.userData.truePotential === true;
}

export async function attachAuthoredCharacterBody(holder: THREE.Group, characterId: string) {
  const url = AUTHORED_CHARACTER_ASSETS[characterId];
  if (!url || typeof window === 'undefined') return null;

  const fallbackStates = holder.children.map((object) => ({ object, visible: object.visible }));
  let replacements: Array<{ name: typeof ANIMATED_BODY_PARTS[number]; fallback: THREE.Object3D; replacement: THREE.Object3D }> = [];

  holder.userData.characterAssetState = 'loading-authored-glb';
  try {
    const authored = await loadStaticGlb(url);
    authored.name = 'authoredCharacterBody';

    replacements = ANIMATED_BODY_PARTS.map((name) => {
      const fallback = holder.getObjectByName(name);
      const replacement = authored.getObjectByName(name);
      if (!fallback || !replacement) throw new Error(`Authored fighter ${characterId} is missing animation part ${name}`);
      return { name, fallback, replacement };
    });

    holder.add(authored);

    // Authored GLBs are complete body replacements. Previously only the six
    // animated fallback nodes were hidden, leaving procedural masks, belts,
    // eyes, hood pieces and armor visible around the authored body. Hide the
    // whole procedural visual body while preserving gameplay-owned weapons
    // and True Potential VFX.
    for (const { object } of fallbackStates) {
      if (!keepProceduralChildVisible(object)) object.visible = false;
    }

    for (const { name, fallback } of replacements) {
      fallback.name = `fallback:${name}`;
      fallback.visible = false;
    }

    holder.userData.characterAssetState = 'authored-glb';
    holder.userData.characterAssetUrl = url;
    return authored;
  } catch (error) {
    const partial = holder.getObjectByName('authoredCharacterBody');
    if (partial) {
      holder.remove(partial);
      disposeObject(partial);
    }

    for (const { object, visible } of fallbackStates) object.visible = visible;
    for (const { name, fallback } of replacements) fallback.name = name;

    holder.userData.characterAssetState = 'procedural-fallback';
    holder.userData.characterAssetError = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to load authored fighter GLB ${url}; keeping procedural model.`, error);
    return null;
  }
}
