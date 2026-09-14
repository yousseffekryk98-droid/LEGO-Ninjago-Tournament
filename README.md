# LEGO Ninjago Tournament — Fan Remake

A clean-room, fan-made recreation project inspired by the discontinued 2015 mobile arena brawler.

> This repository does **not** contain extracted/ripped LEGO, TT Games, Hellbent Games, APK, OBB, audio, models, textures, logos, animations, or other proprietary game assets. Use only assets you own or have permission to use.

## Current playable build

The project is a browser-playable 3D reconstruction built with TypeScript, Vite and Three.js.

Implemented now:

- original-inspired diagonal/isometric arena presentation;
- mobile virtual joystick and four-button combat cluster;
- desktop WASD/arrow controls;
- attack, block, jump, jump-slam, grab/throw, dodge and charged Spinjitzu;
- combo counter and escalating stud multiplier;
- melee, heavy and ranged enemies;
- escalating waves and boss waves;
- boss-specific mechanics for Karlof, Ash, Mr. Pale, Neuro, Griffin Turner, Master Chen and Ronin;
- gong instant-KO throws;
- Boulder Basher, Titanium Dragon freeze projectile, Condrai reinforcement and spike hazards;
- procedural block-style fighters and environment (no ripped game art);
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

Desktop: WASD / arrows to move, `Space` or `J` attack, `K` jump, `L` grab/throw, `Shift` block, `E` Spinjitzu, `Q` dodge. Attack while airborne to perform a jump slam.

Mobile: left virtual joystick plus the on-screen action cluster. Swipe across the arena to dodge. Fill the special meter by landing hits, then press the spiral button.

## Next fidelity work

The largest remaining original-loop pieces are a fully playable scripted Dojo tutorial, Roto Jet supply drops/destructible training props, consumable power-ups, deeper character-specific special abilities, a larger verified roster/variant set, stronger animation/VFX/audio hooks, controller support, PWA/offline packaging and optional Android packaging.

## Legal / project scope

This is an unofficial fan-development project and is not affiliated with or endorsed by The LEGO Group, TT Games, Hellbent Games, or the Ninjago rights holders. LEGO, NINJAGO and related names/characters are trademarks/copyrighted properties of their respective owners. Do not distribute proprietary assets from the original game through this repository.
