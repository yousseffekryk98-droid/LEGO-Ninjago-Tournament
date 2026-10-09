import * as THREE from 'three';
import { loadStaticGlb } from '../../shared/three/gltf-assets';

/**
 * TRELLIS.2 exports a textured, unrigged mesh. Treat it as a visual skin,
 * never as the physics/collision rig. The procedural minifigure remains
 * available if the file cannot be decoded or has invalid dimensions.
 */
export async function attachTrellisCharacterBody(
  holder: THREE.Group,
  characterId: string,
  url: string,
  designId: string
): Promise<THREE.Group | null> {
  if (typeof window === 'undefined') return null;

  const originalVisibility = holder.children.map((object) => ({
    object,
    visible: object.visible
  }));
  holder.userData.characterAssetState = 'loading-trellis2-glb';

  try {
    const mesh = await loadStaticGlb(url);
    if (holder.userData.characterAssetCancelled === true) return null;

    const bounds = new THREE.Box3().setFromObject(mesh);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    if (
      bounds.isEmpty() ||
      !Number.isFinite(size.x + size.y + size.z) ||
      size.y < 0.001 ||
      size.x / size.y > 3 ||
      size.z / size.y > 3
    ) {
      throw new Error('TRELLIS.2 asset is empty or is not an upright character');
    }

    // Mesh coordinates produced by image-to-3D are not in game units.
    // The built-in fighter skeleton is approximately 3.1 units tall.
    const factor = 3.1 / size.y;
    mesh.scale.multiplyScalar(factor);
    mesh.position.set(-center.x * factor, -bounds.min.y * factor, -center.z * factor);

    const skin = new THREE.Group();
    skin.name = 'trellis2CharacterBody';
    skin.add(mesh);
    holder.add(skin);

    // Preserve gameplay-controlled weapons, effects, and the underlying
    // collision model. A single generated mesh does not have articulated
    // limbs; full limb animation requires an external rigging step.
    for (const { object } of originalVisibility) {
      if (
        object.name !== 'weaponRig' &&
        object.name !== 'truePotentialAura' &&
        object.name !== 'truePotentialLight' &&
        object.userData.truePotential !== true
      ) {
        object.visible = false;
      }
    }

    holder.userData.characterAssetState = 'trellis2-glb';
    holder.userData.characterAssetUrl = url;
    holder.userData.characterDesignId = designId;
    holder.userData.characterAssetSource = 'TRELLIS.2';
    holder.userData.characterId = characterId;
    return skin;
  } catch (error) {
    originalVisibility.forEach(({ object, visible }) => { object.visible = visible; });
    holder.userData.characterAssetState = 'procedural-fallback';
    holder.userData.characterAssetError = error instanceof Error ? error.message : String(error);
    console.warn(`Could not load TRELLIS.2 character ${characterId}; using procedural fallback.`, error);
    return null;
  }
}
