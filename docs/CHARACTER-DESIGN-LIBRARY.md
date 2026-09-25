# Character Design Commit Timeline

The fighter selector preserves visual history **from the first 3D character-design commit to the latest visual revision**. New design work must be added as another timeline entry; older designs must not be replaced or deleted.

## Timeline

| Slot | Commit | Design | Availability |
| --- | --- | --- | --- |
| C01 | `998d2fce` | Initial 3D Model | Every fighter |
| C02 | `819add38` | Video Fidelity | Every fighter |
| C03 | `b9eb6bfc` | LEGO Proportions | Every fighter |
| C04 | `d1e20ac2` | Glossy Articulated | Every fighter |
| C05 | `d11705e6` | Armor Variants | Every fighter |
| C06 | `cae32dc0` | Ninja Detail Pass | Every fighter |
| C07 | `3dfe70cb` | Procedural Realism | Every fighter |
| C08 | `8c67c327` | Tournament Geometry | Every fighter |
| C09 | `67a0ba97` | Wave-1 Geometry | Every fighter |
| C10 | `0170de08` | First Authored GLB | Core authored fighters |
| C11 | `0bfc3094` | High-Fidelity Authored | Core authored fighters |
| C12 | `425c89d4` | Detailed Lloyd | Lloyd |
| C13 | `6860d027` | Exact Mould Initial | Lloyd |
| C14 | `70f95ff9` | Exact Mould Intermediate | Lloyd |
| C15 | `05b7ce43` | Exact Mould Refined | Lloyd |
| C16 | `961edd9b` | Exact Mould + Back Emblem | Lloyd |

The first authored design was introduced in `113a74c1`; `0170de08` is used for the selectable asset because it is the working buffer-size-fixed version of that same design. The high-fidelity authored design was introduced in `36008526`; `0bfc3094` is used because it contains the generator-expression fix required to build that design correctly. Lloyd Detailed originated at `ca1faa7d`; `425c89d4` is the repaired hair-data revision of the same design.

## Exact procedural snapshots

C01–C09 are not approximations. Their original `src/shared/three/minifigure-model.ts` source revisions are preserved under:

`src/shared/three/history/`

The runtime registry in:

`src/shared/three/history/index.ts`

loads the selected historical renderer directly.

For fighters that did not exist yet at an early commit, the historical renderer is applied to the fighter's current identity/profile data. This preserves the old rendering/design engine while keeping the modern roster playable.

## Authored assets

Historical authored assets are generated independently so one revision cannot overwrite another:

- `variants/<fighter>/authored-v1.glb`
- `variants/<fighter>/authored-v2.glb`
- `variants/lloyd-tournament/lloyd-detailed.glb`
- `variants/lloyd-tournament/exact-6860d027.glb`
- `variants/lloyd-tournament/exact-70f95ff9.glb`
- `variants/lloyd-tournament/exact-05b7ce43.glb`
- `variants/lloyd-tournament/lloyd-exact.glb`

## Selection behavior

Every fighter card has a **DESIGNS** button. The live 3D panel displays the timeline in chronological order and shows both the timeline slot and commit ID, for example:

`C07 · 3dfe70cb`

The selection is remembered separately for each fighter and is used by Tournament, Free Play, Dojo, and the live 3D model viewer.

Defaults remain:

- Lloyd Tournament → C12 Detailed Lloyd
- other core authored fighters → C11 High-Fidelity Authored
- all other fighters → C09 latest procedural design

Old selections from the previous grouped selector are migrated automatically.

## Future design mixer

Every authored design preserves the gameplay animation roots:

- `head`
- `torso`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`

That lets a later mixer support requests such as:

> head from C12 + torso from C11 + arms from C15 + legs from C09

The rule going forward is: **add another design entry; never destroy the previous visual state.**
