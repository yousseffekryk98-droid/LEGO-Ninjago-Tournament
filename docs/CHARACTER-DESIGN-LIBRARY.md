# Character Design Library

Historical fighter visuals are preserved as selectable designs instead of replacing one another.

## Shared design slots

Every authored design used by the runtime preserves these animation roots:

- `torso`
- `head`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`

That shared contract is intentional. It is the basis for the next-stage design mixer, where a fighter can use a head from one design, torso from another, and arms/legs from another without changing combat code.

## Available generations

### Classic Procedural
Available to **every fighter**.

This is the normal shared minifigure/model-profile path. It remains in the game permanently as the fallback and as a selectable visual style.

### Authored V1
Available to the ten fighters that received the first GLB body pass:

- Lloyd (Tournament)
- Kai (Tournament)
- Jay (Tournament)
- Cole (Tournament)
- Zane Techno
- Zane ZX
- Nya
- Master Garmadon
- Master Chen
- Skylor

Recovered from commit:

`f06ea597d25fb4872527ce2a8542a56990a43857`

Generated to:

`public/assets/models/fighters/variants/<fighter-id>/authored-v1.glb`

### Authored V2
Available to the same ten core fighters.

This is the later high-fidelity core generation with more face, hair, outfit and character-specific detail.

Source generation lineage:

`36008526f5a655ee9f4b88b558ca03c5dc163e83`

Generated to:

`public/assets/models/fighters/variants/<fighter-id>/authored-v2.glb`

### Lloyd Detailed
Available to Lloyd.

This restores the hand-built detailed Lloyd that existed before the exact-mould experiment replaced it. It includes the layered green/gold suit, expressive face, blond procedural hair, armor details and energy weapon silhouette.

Recovered from merge:

`4074853454a059414332e93237027fdd9da230a7`

Generated to:

`public/assets/models/fighters/variants/lloyd-tournament/lloyd-detailed.glb`

This is now Lloyd's **default** design because it is the version preferred before the exact-mould experiment.

### Lloyd Exact Mould
Available to Lloyd as an optional comparison design.

This is the later LDraw-derived exact-mould experiment using the 61183 hair, 15619 bandana and exact minifigure body moulds.

Lineage:

`ac3983ea99daf1849cdaf375e6d000588e34e74c`

Generated to:

`public/assets/models/fighters/variants/lloyd-tournament/lloyd-exact.glb`

It remains preserved for comparison and future part mixing; it no longer forces itself as Lloyd's selected look.

## Selection behavior

The Fighters screen contains a **DESIGNS** button on every fighter card.

The live 3D viewer exposes all designs that actually exist for that fighter. Selection is stored per character under:

`ninja-tournament-character-designs-v1`

The chosen design is used by:

- the live 3D fighter preview;
- Tournament gameplay;
- Free Play;
- Dojo;
- any other runtime path that calls `createCharacterModel`.

Default rules:

- Lloyd Tournament → **Lloyd Detailed**
- other core authored fighters → **Authored V2**
- everyone else → **Classic Procedural**

## Future mixer

Do not delete historical designs when creating a new visual pass.

A future mixer should store independent selections for the six shared slots:

```text
head
torso
leftArm
rightArm
leftLeg
rightLeg
```

Example future request:

> Lloyd head from Detailed + torso from V2 + legs from Exact.

Because all authored GLBs preserve the same root-node contract, the loader can compose those roots into one fighter while keeping the same combat animations.
