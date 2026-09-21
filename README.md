# LEGO Ninjago Tournament — Fan Remake

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
- visible element-colored Spinjitzu tornado VFX with AoE hits, invulnerability window and a clearly labeled special control;
- **46** playable roster entries/variants covering the documented playable cast plus the regional Tox variant (Ronin remains boss-only);
- a dedicated 3D Dojo tutorial with seven interactive training steps and low-FPS input reconciliation;
- Temple Gallery-style collection archive with fighter filters, lock state, stats and enemy codex;
- Single Challenge, timed Score Attack and Boss Challenge modes;
- procedural block-style fighters and environments (no ripped game art);
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

See [`docs/RESEARCH.md`](docs/RESEARCH.md) for the gameplay research, public references and clean-room rules. See [`docs/ANDROID.md`](docs/ANDROID.md) for Android packaging.

## Run locally

```bash
npm install
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
npm install
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

Desktop: WASD / arrows to move, `Space` or `J` attack, `K` jump, `L` grab/throw, `Shift` block, `E` special, `Q` dodge. Attack while airborne to perform a jump slam.

Controller: left stick/D-pad move, A attack, RB jump, X grab, LB block, Y special, B dodge.

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
