# LEGO Ninjago Tournament — Fan Remake https://lego-ninjago-tournament.pages.dev/

A clean-room, fan-made recreation project inspired by the discontinued 2015 mobile arena brawler.

> This repository does **not** contain extracted/ripped LEGO, TT Games, Hellbent Games, APK, OBB, audio, models, textures, logos, animations, or other proprietary game assets. Use only assets you own or have permission to use.

## Current release-candidate build

The project is a browser-playable 3D reconstruction built with TypeScript, Vite and Three.js, with an installable PWA and a Capacitor 8 Android packaging path.

Implemented now:

- original-inspired diagonal/isometric arena presentation;
- mobile virtual joystick and four-button combat cluster;
- desktop WASD/arrow controls and standard gamepad support;
- attack, block, jump, jump-slam, grab/throw and swipe/Q/controller dodge;
- combo counter and escalating stud multiplier;
- melee, heavy and ranged enemies plus production-layer faction behaviors;
- Anacondrai flanking/dash behavior, Nindroid repositioning and bomber hazards;
- escalating waves and boss waves;
- boss-specific mechanics for Karlof, Ash, Mr. Pale, Neuro, Griffin Turner, Master Chen and Ronin;
- gong instant-KO throws;
- Boulder Basher, Titanium Dragon freeze projectile, Condrai reinforcement, spike hazards and telegraphed bombs;
- Roto Jet-style flyovers with physical supply crates **and missile attack runs**;
- destructible training/punching-bag props with debris and stud rewards;
- supply rewards for hearts, studs, special-meter charge and temporary combat boosts;
- seven data-driven special families: Spinjitzu, Boost, Charge Attack, Overload, Air Strike, Toxic Cloud and Shout;
- visible element-colored Spinjitzu tornado VFX with movable AoE attack, helical energy bands, debris, dust, light, invulnerability window and a clearly labeled special control;
- physical stud drops from defeated enemies, training props and supply crates, with scatter/bounce/magnet collection;
- original-style stage introduction/completion presentation, low-health red vignette, boss health bar and a one-use stud-funded Continue flow;
- **51** playable roster entries/variants covering the documented cast, regional Tox variant and supplied-video legacy fighters including Kai ZX (Ronin remains boss-only), with primary names and suit/variant labels separated in the UI;
- a dedicated 3D Dojo tutorial with seven interactive training steps and low-FPS input reconciliation;
- Temple Gallery-style collection archive with fighter filters, lock state, stats and enemy codex;
- Single Challenge, timed Score Attack and Boss Challenge modes;
- shared procedural 3D minifigure models with named animation parts, character-specific silhouettes/equipment and no ripped game art;
- live rotating 3D fighter viewer in the roster, including locked fighters, with Zane and every other character shown by primary name plus suit/variant;
- unlockable roster with local stud bank/progression;
- five-level fighter potential/XP system with stat growth;
- daily free prize draw plus three daily challenges that award extra draws;
- prize-draw bonus consumables and pre-fight power-up purchasing/equipping;
- Iron Heart, Charged Scroll and Battle Focus one-run consumables;
- clean-room synthesized UI/combat/reward/special SFX, optional vibration and an SFX toggle;
- camera/impact shake and flash feedback with reduced-motion support;
- responsive phone/tablet/desktop HUD;
- local save migration/persistence;
- installable offline PWA with service-worker caching;
- Capacitor **8.5.2** Android build/sync/open/run configuration;
- automated TypeScript, production build and Playwright browser acceptance coverage.

See [`docs/RESEARCH.md`](docs/RESEARCH.md) for gameplay research and clean-room rules, [`docs/VIDEO-FIDELITY.md`](docs/VIDEO-FIDELITY.md) for the supplied-video feature matrix, [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the feature-first source/model architecture, and [`docs/ANDROID.md`](docs/ANDROID.md) for Android packaging.

## Graphics modes and laptop safety

Fresh installs start in **Safe** graphics mode: 30 FPS, 1× render scale, low-power WebGL preference, antialiasing off and realtime shadows off. The graphics control on menu/panel screens lets players switch between **Auto Safe**, **Safe**, **Balanced** and **High**.

Balanced and High sessions arm a recovery guard. If an accelerated WebGL session loses its context or does not finish cleanly, the next launch automatically falls back to Safe mode. This keeps the richer Three.js arena, 3D fighters and Spinjitzu effects usable on lower-power laptops without removing higher-fidelity options.

## Run locally

```bash
npm ci
npm run dev
```

Then open the local Vite URL on desktop or a phone on the same network.

Full release check:

```bash
npm run test:release
```

Manual production preview:

```bash
npm run build
npm run preview
```

## Android

First native setup on a machine with Android Studio/SDK:

```bash
npm ci
npm run android:init
npm run android:open
```

After web changes:

```bash
npm run android:sync
```

To run on a connected device/emulator:

```bash
npm run android:run
```

Generate signed APK/AAB releases from Android Studio. Keep signing keys out of the repository.

## Controls

Desktop defaults: `WASD` / arrows move, `J` punch/box, `I` kick, `K` jump, `L` grab/throw, `Shift` block, `E` Spinjitzu/special, `Q` dodge, `R` Tornado of Creation ultimate in Free Play. All keyboard bindings can be changed from **Keyboard Controls** on the main menu. Attack while airborne to perform a jump slam.

Controller: left stick/D-pad move, A punch, RT kick, RB jump, X grab, LB block, Y Spinjitzu/special, B dodge.

Mobile: left virtual joystick plus the on-screen action cluster. Swipe across the arena/Dojo to dodge. Fill the special meter by landing hits, then press the labeled spiral button to trigger Spinjitzu or the selected fighter's special.

## What still depends on production assets / real-device acceptance

The code-side systems above are implemented. The remaining work is primarily the production-asset and release-certification layer rather than missing core game systems:

- fully authored, original/licensed minifigure-quality character models and rigs;
- hand-authored combat animation sets beyond the current procedural animation layer;
- final arena/environment textures, props and UI artwork;
- original/licensed full music score and optional voice work (current build uses synthesized clean-room SFX only);
- broader real-device GPU/performance tuning and visual acceptance;
- final Android Studio-generated native project/signing, APK/AAB testing and store packaging;
- optional remappable controller bindings and additional verified suit/content variants if reliable references become available.

A pixel-for-pixel copy using extracted commercial assets is intentionally outside this repository's scope.

## Legal / project scope

This is an unofficial fan-development project and is not affiliated with or endorsed by The LEGO Group, TT Games, Hellbent Games, or the Ninjago rights holders. LEGO, NINJAGO and related names/characters are trademarks/copyrighted properties of their respective owners. Do not distribute proprietary assets from the original game through this repository.


- Fighter-specific **Elemental Kick**: the Kick control and impact inherit the selected fighter's element (Fire, Ice, Lightning, Earth, Energy, Water, Poison, Metal, Shadow, etc.) with distinct VFX and combat behavior.
- Defeated enemies can drop physical health pickups during normal combat: mostly **½-heart** drops with occasional full hearts; heavy enemies have a higher chance and bosses guarantee a healing drop.
- The HUD now renders full, half, and empty hearts instead of rounding fractional health.
- Every fighter can spend banked studs on permanent level upgrades. Existing earned XP reduces the remaining upgrade price; levels increase damage/speed and levels 3 and 5 each add **+1 maximum heart**.
- Purchased fighter levels apply in Tournament, Dojo, and Challenge Arena through one shared progression rule set.
