# Visual asset sources and policy

This fan remake keeps shipped game art clean-room or openly licensed. Do not copy assets from the original APK/OBB, promotional renders, official screenshots, or proprietary character models into the repository.

## Bundled assets

- `src/features/characters/icons.ts` — original, code-generated fighter SVG badge icons. Covered by this repository's MIT license.
- `src/features/characters/portraits.ts` — original Three.js renders made from the project's procedural fighter geometry.
- `public/icons/minifigure-silhouette.svg` — original clean-room block-toy/minifigure silhouette. Covered by this repository's MIT license.
- Procedural Three.js fighter geometry in `src/shared/three/minifigure-model.ts` — original project geometry.
- `scripts/generate-authored-assets.mjs` — original clean-room source that generates the local Chen center-pillar GLB used by the arena GLB pipeline. The generated binary is intentionally not committed.

## Open-license references approved for future additions

### SVG Repo — Lego Minifigures SVG
- Page: https://www.svgrepo.com/svg/6823588/lego-minifigures
- Listed license: CC0
- Use: generic minifigure silhouette/reference only. Do not treat it as official NINJAGO character art.

### LDraw Parts Library
- Legal information: https://www.ldraw.org/legal-info
- Contributor agreement: https://www.ldraw.org/docs-main/licenses/ldraw-org-contributor-agreement.html
- Part licensing is declared per file. Current LDraw contributor rules allow CC BY 4.0 or CC0, while legacy files can carry CC BY 2.0/4.0-compatible headers.
- Before importing any individual part, keep its header/license metadata and add the required attribution for CC BY material.

## Character likeness rule

Named fighters may use the project's own colors, gameplay data, text names, and clean-room procedural geometry. Do not bundle official LEGO/NINJAGO logos, extracted textures, voice/audio, animations, screenshots, or copied meshes.

When a third-party asset is added later, record:
1. exact source URL;
2. creator/uploader;
3. exact license;
4. whether modified;
5. the repository path where it is used.
