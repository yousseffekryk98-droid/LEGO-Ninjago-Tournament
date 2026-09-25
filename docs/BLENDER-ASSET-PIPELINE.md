# Blender / GLB production pipeline

The game now supports authored GLB assets while preserving procedural fallbacks.

## Runtime contract

Static authored assets are loaded through `src/shared/three/gltf-assets.ts`. The center arena landmark currently resolves to:

`/assets/models/arena/chen-center-pillar.glb`

The procedural version is created first. When the GLB loads successfully it is inserted into the same landmark group and the procedural render parts are hidden. Collision and camera behavior do not depend on the GLB mesh topology.

## Current generated model

`scripts/generate-authored-assets.mjs` creates a clean-room GLB during:

- `npm run dev`
- `npm run build`
- `npm run test:e2e`

This provides a deterministic asset for Cloudflare Pages, Capacitor/Android, and local development without storing generated binary files in Git.

## Replacing it with Blender art

For a higher-detail Blender pass, keep the same runtime path and dimensions:

- origin: ground center of the landmark;
- up axis: Y after glTF export;
- approximate footprint: 4.1 m × 4.1 m;
- approximate height: 12.3 m;
- transforms: apply scale/rotation before export;
- materials: Principled BSDF / glTF-compatible PBR;
- textures: use only original or properly licensed textures;
- recommended export: glTF 2.0 binary (`.glb`), selected objects only;
- do not enable Draco unless a Draco decoder is also added to the runtime.

The model may use any internal Blender object names because gameplay collision is external. Useful semantic names such as `Shaft`, `SerpentHead`, `SerpentBody`, and `BronzeTrim` are still recommended for debugging.

## Character assets

Character GLBs should not bypass `features/characters/model.ts`. When character GLB overrides are introduced, they must preserve the named animation/attachment contract used by combat:

- `torso`
- `head`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`
- weapon/accessory attachment nodes

Until an authored character asset is validated, the procedural minifigure remains the fallback.

## Licensing rule

Never export or redistribute meshes, textures, animations, audio, or other assets extracted from the original commercial game. Blender assets added here must be original, commissioned, or license-compatible, and their source/license must be recorded in `docs/ASSET-SOURCES.md`.
