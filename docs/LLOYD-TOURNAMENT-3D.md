# Lloyd Tournament 3D Fidelity Pipeline

## Production status

The production `lloyd-tournament.glb` is now generated from **vendored LDraw-derived exact minifigure mould geometry** on every normal web build. Blender is no longer required for the production Lloyd asset.

Build order:

1. `scripts/generate-core-fighters.mjs` creates the generic fighter set.
2. `scripts/generate-lloyd-fighter.mjs` creates the earlier detailed Lloyd fallback.
3. `scripts/generate-lloyd-exact-production.mjs` runs last and overwrites Lloyd with the exact-mould Tournament version.

The exact production route uses the real 61183 hair, 15619 ninja bandana, 3626b head, 973 torso, 3815 hips, 3816/3817 legs, 3818/3819 arms, and 3820 hand moulds. The Tournament robe print is recreated with project-authored geometry over those moulds.

## Which Lloyd this targets

The game entry \`lloyd-tournament\` now has two authoring routes:

1. **Runtime/default generator** — \`scripts/generate-lloyd-fighter.mjs\`, which creates the GLB on every web build and is the current production asset.
2. **Exact-mould Blender route** — \`scripts/blender/build_lloyd_tournament_exact.py\`, which reconstructs the Tournament Robe Lloyd using official LDraw mould geometry.

The Tournament Robe reference is BrickLink minifigure **njo0123**. The inventory identifies the characteristic pieces as a green torso with yellow arms and black hands, green ninja bandana, tan swept-back hair, yellow head, and decorated green hips/legs.

## Why the repository does not commit a Mecabricks export

Mecabricks is very useful as a visual/modeling reference and its workshop can export geometry. However, the Mecabricks administrator has stated that exported Mecabricks assets must not be redistributed in project/source files under the general license.

This repository is public and intended to remain redistributable, so committed game assets should not embed an exported Mecabricks community model unless separate permission/license is obtained.

## Exact mould source used instead

The Blender route uses the official **LDraw Parts Library**, whose approved parts are redistributable under Creative Commons Attribution licensing.

Relevant moulds:

- \`61183.dat\` — Minifig Hair Swept Back Tousled
- \`15619.dat\` — Minifig Bandana Ninja
- \`3626b.dat\` — Minifig Head
- \`973.dat\` — Minifig Torso
- \`3818.dat\` / \`3819.dat\` — Minifig arms
- \`3820.dat\` — Minifig hand
- \`3815.dat\` — Minifig hips
- \`3816.dat\` / \`3817.dat\` — Minifig legs

The assembly placement is based on the official LDraw standing-minifig shortcut \`979.dat\`.

Attribution: **This project uses geometry from the LDraw Parts Library.** LDraw is an unofficial community project and is not affiliated with or endorsed by the LEGO Group. See LDraw.org legal/licensing information for individual part authors and license terms.

## Build in Blender

From the repository root:

\`\`\`bash
blender --background --python scripts/blender/build_lloyd_tournament_exact.py
\`\`\`

This creates:

\`\`\`text
public/assets/models/fighters/lloyd-tournament-v2.glb
\`\`\`

To overwrite the production Lloyd GLB intentionally:

\`\`\`bash
blender --background --python scripts/blender/build_lloyd_tournament_exact.py -- --replace-game
\`\`\`

The exported model preserves the game's required animation nodes:

- \`torso\`
- \`head\`
- \`leftArm\`
- \`rightArm\`
- \`leftLeg\`
- \`rightLeg\`

## Fidelity note

The physical mould geometry comes from LDraw rather than being eyeballed. The Tournament robe, face and leg decoration in this script are **clean-room geometric recreations**, not copied commercial texture maps. That keeps the open-source asset pipeline safer while substantially improving silhouette and proportion accuracy.
