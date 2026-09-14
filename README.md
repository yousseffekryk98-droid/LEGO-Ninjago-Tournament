# LEGO Ninjago Tournament — Fan Remake

A clean-room, fan-made recreation project inspired by the discontinued 2015 mobile arena brawler.

> This repository does **not** contain extracted/ripped LEGO, TT Games, Hellbent Games, APK, OBB, audio, models, textures, logos, animations, or other proprietary game assets. Use only assets you own or have permission to use.

## Current playable build

The project is a browser-playable 3D reconstruction built with TypeScript, Vite and Three.js.

Implemented now:

- original-inspired diagonal/isometric arena presentation;
- mobile virtual joystick and four-button combat cluster;
- desktop WASD/arrow controls;
- attack, block, jump, jump-slam, grab/throw and swipe/Q dodge;
- combo counter and escalating stud multiplier;
- melee, heavy and ranged enemies;
- escalating waves and boss waves;
- boss-specific mechanics for Karlof, Ash, Mr. Pale, Neuro, Griffin Turner, Master Chen and Ronin;
- gong instant-KO throws;
- Boulder Basher, Titanium Dragon freeze projectile, Condrai reinforcement and spike hazards;
- Roto Jet-style arena flyovers with physical falling supply crates;
- supply rewards for hearts, studs, special-meter charge and temporary combat boosts;
- seven data-driven special families: Spinjitzu, Boost, Charge Attack, Overload, Air Strike, Toxic Cloud and Shout;
- **43** playable roster entries/variants based on currently verified public reference lists;
- a dedicated 3D Dojo tutorial with seven interactive training steps;
- procedural block-style fighters and environments (no ripped game art);
- unlockable roster with local stud bank/progression;
- five-level fighter potential/XP system with stat growth;
- daily free prize draw plus three daily challenges that award extra draws;
- responsive phone/tablet/desktop HUD;
- local save migration/persistence;
- automated TypeScript and production build workflow.

See [`docs/RESEARCH.md`](docs/RESEARCH.md) for the gameplay research, public references, clean-room rules and fidelity roadmap.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL on desktop or a phone on the same network.

Production check:

```bash
npm run typecheck
npm run build
npm run preview
```

## Controls

Desktop: WASD / arrows to move, `Space` or `J` attack, `K` jump, `L` grab/throw, `Shift` block, `E` special, `Q` dodge. Attack while airborne to perform a jump slam.

Mobile: left virtual joystick plus the on-screen action cluster. Swipe across the arena/Dojo to dodge. Fill the special meter by landing hits, then press the spiral button.

## What remains for a release-quality remake

The current project is a substantial playable reconstruction, but it is not yet a pixel-for-pixel/content-complete replacement for the original commercial game. The most valuable remaining work is:

- better authored combat animations, hit-stop, camera shake and VFX;
- original/licensed audio, music and voice hooks;
- destructible training props and a more detailed Roto Jet event set;
- more verified suit variants and enemy faction behaviors;
- challenge variety beyond the current daily set;
- controller support and remappable controls;
- PWA/offline packaging and optional Android packaging;
- performance presets and broader device testing;
- fully original or properly licensed production art replacing procedural placeholders.

## Legal / project scope

This is an unofficial fan-development project and is not affiliated with or endorsed by The LEGO Group, TT Games, Hellbent Games, or the Ninjago rights holders. LEGO, NINJAGO and related names/characters are trademarks/copyrighted properties of their respective owners. Do not distribute proprietary assets from the original game through this repository.
