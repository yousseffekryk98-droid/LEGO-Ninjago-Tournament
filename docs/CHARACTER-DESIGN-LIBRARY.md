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
| C08 | `26b198d6` | Wave-1 Profiles | Every fighter |
| C09 | `8c67c327` | Tournament Geometry | Every fighter |
| C10 | `ae6277d2` | Tournament Identity Priority | Every fighter |
| C11 | `cf2f6329` | Remaining Wave-1 Identities | Every fighter |
| C12 | `67a0ba97` | Remaining Wave-1 Geometry | Every fighter |
| C13 | `99837226` | Catalog Identity Preservation | Every fighter |
| C14 | `b5994b44` | Skeleton Profile Fix | Every fighter |
| C15 | `0170de08` | First Authored GLB | Core authored fighters |
| C16 | `0bfc3094` | High-Fidelity Authored | Core authored fighters |
| C17 | `425c89d4` | Detailed Lloyd | Lloyd |
| C18 | `6860d027` | Exact Mould Initial | Lloyd |
| C19 | `70f95ff9` | Exact Mould Intermediate | Lloyd |
| C20 | `05b7ce43` | Exact Mould Refined | Lloyd |
| C21 | `961edd9b` | Exact Mould + Back Emblem | Lloyd |

The first authored design was introduced in `113a74c1`; `0170de08` is used for the selectable asset because it is the working buffer-size-fixed version of that same design. The high-fidelity authored design was introduced in `36008526`; `0bfc3094` is used because it contains the generator-expression fix required to build that design correctly. Lloyd Detailed originated at `ca1faa7d`; `425c89d4` is the repaired hair-data revision of the same design.

## Exact historical procedural states

C01–C14 preserve both parts of each visual state:

1. the historical `minifigure-model.ts` renderer revision;
2. the historical `model-profile.ts` silhouette/profile revision active at that point.

Renderer snapshots live under:

`src/shared/three/history/`

Profile snapshots live under:

`src/features/characters/history/`

The runtime registries select both together. Profile-only visual commits such as C08, C10, C11, C13 and C14 reuse the renderer that was current at that commit but use the exact profile mapping from that commit.

For fighters that did not exist yet at an early commit, the old renderer/profile logic is applied to the fighter's modern data where possible. This keeps the complete present-day roster playable while still preserving the historical visual engine.

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

`C10 · ae6277d2`

The selection is remembered separately for each fighter and is used by Tournament, Free Play, Dojo, and the live 3D model viewer.

Counts:

- every fighter: at least **14** historical procedural/profile states;
- authored core fighters: **16** states;
- Lloyd Tournament: **21** states.

Defaults remain:

- Lloyd Tournament → C17 Detailed Lloyd
- other core authored fighters → C16 High-Fidelity Authored
- all other fighters → C14 latest procedural/profile design

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

> head from C17 + torso from C16 + arms from C20 + legs from C14

The rule going forward is: **add another design entry; never destroy the previous visual state.**
