# LEGO Ninjago Tournament — Fan Remake

A clean-room, fan-made recreation project inspired by the discontinued 2015 mobile arena brawler.

> This repository does **not** contain extracted/ripped LEGO, TT Games, Hellbent Games, APK, OBB, audio, models, textures, logos, or other proprietary game assets. Use only assets you own or have permission to use.

## Current playable prototype

The `remake/playable-prototype` branch contains a browser-playable 3D reconstruction built with TypeScript, Vite and Three.js.

Implemented now:

- original-inspired diagonal/isometric arena presentation;
- mobile virtual joystick and touch combat buttons;
- desktop WASD/arrow controls;
- attack, block, jump, grab/throw and charged Spinjitzu;
- combo counter and escalating stud multiplier;
- melee, heavy and ranged enemies;
- escalating waves and boss waves;
- gong instant-KO throws;
- marked falling-boulder arena event;
- procedural block-style fighters and environment (no ripped game art);
- unlockable roster with local stud bank/progression;
- responsive phone/tablet/desktop HUD;
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

Desktop: WASD / arrows to move, `Space` or `J` attack, `K` jump, `L` grab/throw, `Shift` block, `E` Spinjitzu.

Mobile: left virtual joystick plus the on-screen action cluster. Fill the special meter by landing hits, then press the spiral button.

## Next fidelity pass

The next milestone adds dodge/roll, jump slam, individual boss powers, additional arena events (Titanium Dragon, Roto Jet, Condrai Crushers, spikes/training props), five-level fighter progression, challenges/daily tasks, prize draw, power-ups and a proper playable Dojo tutorial.

## Legal / project scope

This is an unofficial fan-development project and is not affiliated with or endorsed by The LEGO Group, TT Games, Hellbent Games, or the Ninjago rights holders. LEGO, NINJAGO and related names/characters are trademarks/copyrighted properties of their respective owners. Do not distribute proprietary assets from the original game through this repository.
