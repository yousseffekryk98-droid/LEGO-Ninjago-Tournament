# Full Roster Rollout Plan

This document turns the supplied all-era NINJAGO character list into an implementation plan that can be shipped without destabilising the current game.

## Current state

- Live playable `ROSTER`: 58 entries/variants.
- Extended planning catalog: 284 source appearances in `src/features/characters/expanded-catalog.ts`.
- The expanded catalog is intentionally **not** injected into the live roster automatically.
- Every catalog entry has a unique appearance ID, era/group metadata and an implementation wave.
- Duplicate characters across eras are preserved as separate appearances so later we can choose whether they become variants, skins, bosses or separate fighters.

## Required asset set per implemented fighter

Every fighter promoted from the planning catalog to the live game must have all three:

1. **Portrait** — circular/select-screen image designed for the bronze/gold legacy UI.
2. **SVG icon** — simplified scalable head/element icon for HUD, boss paths and compact menus.
3. **Procedural 3D model** — original clean-room minifigure geometry and materials, with character-specific headgear, face, torso treatment, armor and weapon.

Reference photos may be used to study costume/color details, but do not commit scraped/ripped proprietary textures or game meshes. If a redistributable third-party model is considered, record its exact license and source in `docs/ASSET-SOURCES.md` first.

## Implementation waves

### Wave 1 — Tournament fidelity

49 source appearances. This is the first priority because it most directly supports the 2015 Tournament of Elements game.

Groups:
- Original Ninja / Main heroes
- Original Elemental Masters
- Tournament of Elements cast

Highest-priority playable/boss set:
- Lloyd
- Kai
- Jay
- Cole
- Zane
- Nya
- Master Wu
- Lord/Master Garmadon
- P.I.X.A.L.
- Skylor
- Karlof
- Griffin Turner
- Shade
- Neuro
- Mr. Pale
- Tox
- Jacob
- Bolobo
- Chamille
- Ash
- Gravis
- Master Chen
- Clouse
- Eyezor
- Zugu
- Kapau
- Chope
- Krait
- Sleven

Promotion rule: reuse an existing live fighter when it already represents the same character/suit well; otherwise add a new variant deliberately.

**Wave 1 live promotion status:** the planned Tournament priority set is now represented in the live roster, including Jacob Pevsner, Bolobo, Gravis, Kapau, Chope, Krait and Sleven.

### Wave 2 — Classic expansion

79 source appearances:
- Skeleton Army and original dragons
- Rise of the Snakes tribes
- Legacy of the Green Ninja
- Rebooted
- Possession
- Skybound

Priority examples:
- Samukai, Kruncha, Nuckal, Wyplash
- Pythor, Skales, Fangtom, Skalidor, Acidicus
- Overlord, General Kozu, Dareth
- General Cryptor and Nindroid enemies
- Morro, Ronin, Bansha, Soul Archer
- Nadakhan, Flintlocke, Dogshank, Doubloon

### Wave 3 — Middle-era expansion

102 source appearances:
- Hands of Time
- Sons of Garmadon
- Hunted
- March of the Oni
- Secrets of the Forbidden Spinjitzu
- Prime Empire
- Master of the Mountain
- The Island
- Seabound
- Crystalized

This wave should land only after the Tournament arena, trap system and elemental VFX architecture are stable.

### Wave 4 — Dragons Rising / modern expansion

54 source appearances:
- Dragons Rising / Imperium
- Crossroads allies
- Forbidden Five
- Dragon Masters and major dragons
- modern elemental masters listed in the supplied source

These powers frequently need new gameplay systems rather than simple recolors, so they are intentionally last.

## Character data contract

The live `CharacterDef` remains the balancing/runtime contract. Promotion from the expanded catalog should add or derive:

- `id`
- `name`
- `variant`
- `element/power`
- combat style
- normal attack family
- special attack
- Spinjitzu style
- ultimate style
- passive
- color/accent palette
- speed/damage/max health
- unlock cost
- model profile
- portrait id
- SVG icon id
- voice/SFX profile when available

Do not overload `CharacterDef` with research-only metadata. Keep source/era/asset tracking in the catalog or a future asset registry.

## Power identity rules

Element powers must be immediately readable in motion:

- Fire/Heat: flame trails, embers, hot impact bloom.
- Lightning: branching arcs and short electrical afterglow.
- Ice: frost shards, mist and freeze buildup.
- Earth/Quake: rock fragments, dust and ground shock rings.
- Water: splash ribbons and flowing impact waves.
- Energy: green energy arcs and pulse rings.
- Metal: bright heavy impact flash and armor state.
- Speed/Reflex: afterimages and dash streaks.
- Shadow/Smoke: fade/teleport trails and dark volume.
- Poison/Venom: green toxic cloud and damage-over-time presentation.
- Mind/Fear/Sound: radial psychic/audio wave with status feedback.
- Gravity/Fusion/Technology/Magic and newer powers get dedicated mechanics rather than generic colored rings.

## Model pipeline

For each promoted fighter:

1. Add/confirm identity and variant.
2. Add model profile.
3. Add headgear/hair/helmet geometry if missing.
4. Add torso/leg procedural print geometry.
5. Add weapon/equipment.
6. Add portrait composition.
7. Add SVG icon.
8. Add element VFX profile.
9. Add gameplay values and unlock price.
10. Add automated roster/model tests.
11. Verify desktop + phone character selector.
12. Verify low-FX/Safe graphics fallback.

## Definition of done for a fighter

A fighter is not considered complete merely because the name is selectable. It must:
- look recognisable from the legacy camera distance;
- have a working 3D preview;
- have a portrait and compact icon;
- have element-specific kick/special feedback;
- have no missing animation part names;
- be balanced enough to finish an arena run;
- work in Tournament, Dojo and Challenge modes;
- pass roster/model tests.
