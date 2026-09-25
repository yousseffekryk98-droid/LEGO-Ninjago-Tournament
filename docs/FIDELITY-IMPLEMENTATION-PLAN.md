# Fidelity Implementation Plan — Arena, Traps, Spinjitzu and Fighters

This is the file-by-file implementation order for the next fidelity pass.

The goal is not only to enlarge the arena. The target is the original-game feel visible in the supplied gameplay screenshots: engraved stone arena, separated hazards, temporary collapsing floor, readable elemental powers, strong Spinjitzu silhouettes, bronze/gold HUD controls, boss progression and recognisable minifigures.

## Phase 0 — protect the baseline

Before each gameplay batch:
- keep `main` as the backup/release branch;
- work on a feature branch;
- make one focused commit per subsystem;
- run `npm run typecheck` and `npm run build`;
- compare Playwright failures against the known baseline so pre-existing failures are not confused with new regressions.

## Phase 1 — arena floor and hazard architecture

### New file: `src/features/combat/arena-hazards.ts`

Create a dedicated hazard manager instead of scattering trap timers inside `TournamentGame.ts`.

Core types:
- `pit`
- `spikes`
- `fire-jet`
- `poison`

Each hazard owns:
- world position / radius or tile polygon;
- state: idle → warning → active → recovery;
- warning time;
- active time;
- cooldown;
- damage/fall behavior;
- geometry references;
- collision test.

Rules:
- hazards must never overlap each other;
- keep a safe radius around the initial player spawn;
- keep exits/gongs/boss spawn readable;
- at most a small number of active hazards at once;
- hazard scheduling becomes harder by wave, not purely random chaos.

### `src/features/combat/TournamentGame.ts`

Integrate the hazard manager lifecycle:
- build arena hazard anchor positions;
- update scheduler each frame;
- query player/enemy overlap;
- stop/remove hazards on destroy;
- expose wave/difficulty to the manager.

### Collapsing pit trap

Required behavior:
1. Choose one eligible stone floor sector.
2. Warning: cracks/glow/dust and subtle shake.
3. Sector drops/opens.
4. The hole remains open long enough to matter.
5. Player entering the open hole triggers a short fall animation and loses the run.
6. Enemies can also fall.
7. Floor returns and becomes safe again.
8. Same sector cannot immediately reopen.

The pit must look like an actual missing floor section, not a dark circle placed over intact stone.

### Spike trap

- separate anchor positions from pits;
- warning plate movement before spikes rise;
- active collision only when spikes are extended;
- retract fully before cooldown;
- no spike/pit overlap.

### Fire/poison traps

Add later in this phase after pit/spike behavior is stable. They should use the same state machine and placement system.

## Phase 2 — arena art and engraved floor

### `src/features/combat/TournamentGame.ts` arena builder

Refine the current procedural floor:
- stronger circular rings;
- larger radial stone slabs;
- readable serpent/Chen-inspired engraved lines;
- darker grooves with subtle height/depth difference;
- central motif that still reads from overhead camera;
- outer architecture pushed away from combat space;
- hazard tiles integrated into the stone layout.

Do not make the playable area smaller to make it look detailed. Detail must scale with the enlarged arena.

### Camera

Keep both current follow views:
- legacy diagonal/isometric;
- overhead.

Tune damping and look-ahead so the player can reach the expanded perimeter without being visually lost.

## Phase 3 — elemental VFX architecture

### `src/features/characters/elemental.ts`

Expand each theme beyond a single color. Add declarative fields such as:
- core color;
- secondary color;
- particle shape;
- trail style;
- impact style;
- ground effect;
- optional status effect;
- light intensity.

### New file: `src/features/combat/element-vfx.ts`

Centralise reusable effects:
- flame trail/burst;
- lightning arc;
- frost shards/mist;
- earth debris/shock ring;
- water ribbon/splash;
- energy pulse;
- poison cloud;
- shadow/smoke blink;
- speed afterimage;
- sound/mind wave.

Use this from kicks, specials and later boss attacks so powers stop looking like generic recolored rings.

## Phase 4 — Spinjitzu fidelity pass

### `src/features/combat/TournamentGame.ts`

Refine the player cyclone to match the legacy visual language:
- dense bright lower tornado;
- clear character-colored spiral shell;
- lighter translucent outer wind;
- readable rotating base ring;
- less tall/empty-looking than a generic cone;
- element-specific particles inside the vortex;
- hit sparks when the tornado connects;
- movement remains controllable while spinning.

Spinjitzu gameplay:
- core damage radius;
- weaker suction radius;
- invulnerability window;
- per-element impact response;
- no invisible oversized hitbox.

### Boss Spinjitzu

Boss cyclone must have:
- bigger silhouette than player;
- unique accent color;
- telegraphed startup;
- separate damage timing;
- readable safe escape space.

### Tornado of Creation

Keep the existing team ultimate, but apply:
- denser combined vortex;
- clearer six-fighter gathering path;
- multi-element ribbons;
- stronger final release;
- Safe graphics version with reduced geometry/particles, not a totally different effect.

## Phase 5 — fighter realism

### `src/shared/three/minifigure-model.ts`

Continue clean-room procedural improvements:
- LEGO-like limb/torso proportions;
- better hood/cowl silhouette;
- character-specific masks/hair/helmets;
- layered armor;
- robe/belt/leg print geometry;
- proper weapon scale;
- glossy ABS-like material without excessive reflections.

### `src/features/characters/model-profile.ts`

Move away from one generic fallback where possible.
Add profiles for Wave-1 Tournament fighters first:
- Chen
- Clouse
- Eyezor
- Zugu
- Kapau/Chope
- Karlof
- Griffin
- Shade
- Neuro
- Mr. Pale
- Tox
- Jacob
- Bolobo
- Chamille
- Ash
- Gravis
- Skylor

### Portrait/SVG pipeline

Files:
- `src/features/characters/portraits.ts`
- future `src/features/characters/icons.ts` or `public/fighters/*.svg`

For every Wave-1 fighter:
- circular portrait composition close to the legacy HUD;
- same character palette as the 3D model;
- separate compact SVG element/head icon;
- fallback generated from the procedural 3D model if no redistributable authored art is available.

## Phase 6 — HUD and controls

### `index.html`
### `src/app/main.ts`
### `src/app/styles.css`
### `src/features/controls/styles.css`

Target layout:
- top-left round fighter portrait;
- full/half/empty hearts immediately beside it;
- stud counter below;
- combo multiplier right side;
- large bronze/gold circular action buttons;
- readable left joystick;
- distinct Spinjitzu/special button;
- action icons that remain understandable without text on phone.

Do not sacrifice laptop responsiveness: the fighter selector and menus must remain scrollable at lower viewport heights.

## Phase 7 — boss path/progression presentation

Use the supplied progression screenshot as the UI direction:
- connected boss/room nodes;
- portraits inside circular bronze frames;
- locked/completed/current states;
- boss and enemy routes visually separated;
- reward/stud information;
- start/play button.

Keep existing Boss Rush mechanics; this phase improves the presentation and progression layer instead of deleting working combat logic.

## Phase 8 — staged roster promotion

Use `EXPANDED_CHARACTER_CATALOG`.

For each implementation batch:
1. select 4–8 fighters;
2. research/reference their visual identity;
3. create model profiles and missing geometry;
4. add portrait/SVG assets;
5. add element/special behavior;
6. promote into live `ROSTER`;
7. add tests;
8. validate before the next batch.

Never promote all 284 catalog appearances in one commit.

## Test plan

Add/extend coverage for:
- catalog IDs unique;
- every promoted fighter has a model;
- required named animation parts exist;
- every Wave-1 playable has element VFX;
- pits open, kill/fall correctly and close;
- spike warning/active/recovery state;
- hazards never overlap spawn safety zone;
- Spinjitzu damage/suction radii;
- Safe/High graphics both instantiate;
- desktop and mobile controls remain usable.

## Recommended next coding batch

After this planning branch is merged:

1. implement `arena-hazards.ts` with **pit + spike** only;
2. integrate into TournamentGame;
3. add hazard tests;
4. then create the central `element-vfx.ts`;
5. then promote the missing Wave-1 Tournament fighters and assets in small batches.
