# Source Architecture

The game uses a feature-first structure. The root `src/main.ts` is intentionally a tiny boot entrypoint; gameplay and product logic live in domain folders.

```text
src/
├─ main.ts
├─ app/
│  ├─ main.ts
│  ├─ styles.css
│  └─ fidelity.css
├─ features/
│  ├─ characters/
│  │  ├─ index.ts
│  │  ├─ types.ts
│  │  ├─ roster.ts
│  │  ├─ identity.ts
│  │  ├─ model-profile.ts
│  │  └─ model.ts
│  ├─ combat/
│  │  ├─ index.ts
│  │  ├─ TournamentGame.ts
│  │  ├─ ContentGameBase.ts
│  │  ├─ ContentGame.ts
│  │  └─ styles.css
│  ├─ dojo/
│  │  └─ DojoGame.ts
│  ├─ challenges/
│  │  ├─ index.ts
│  │  └─ styles.css
│  ├─ gallery/
│  │  ├─ index.ts
│  │  └─ styles.css
│  └─ loadout/
│     ├─ index.ts
│     └─ styles.css
└─ shared/
   ├─ three/
   │  ├─ model-types.ts
   │  └─ minifigure-model.ts
   ├─ platform/
   │  ├─ index.ts
   │  └─ styles.css
   ├─ feedback/
   │  ├─ index.ts
   │  └─ styles.css
   └─ storage/
      └─ save-sync.ts
```

## Character domain

`features/characters/roster.ts` is the single source of truth for playable fighters. A fighter keeps its historically documented full variant label in data, while `getCharacterIdentity()` splits it into a large primary name and a secondary variant for the UI.

Example:

- stored label: `Zane (Techno)`
- primary UI name: `Zane`
- variant badge: `Techno`

This prevents important character names from disappearing inside long suit labels.

## 3D model system

All playable characters, Dojo fighters and generic arena fighters use the same reusable builder in `shared/three/minifigure-model.ts`.

The current models are original clean-room procedural meshes. They are not ripped LEGO/TT/Hellbent assets. The builder creates a real Three.js hierarchy with stable named parts:

- `torso`
- `head`
- `leftArm`
- `rightArm`
- `leftLeg`
- `rightLeg`
- optional `leftArmUpper` / `rightArmUpper`
- weapon/accessory meshes such as shuriken, katana, staff, scythe, spear and nunchucks

Animations look parts up by name rather than by fragile `children[n]` indexes.

`features/characters/model-profile.ts` maps roster entries to silhouettes and equipment. Examples include Nindroid Zane with metallic treatment and shuriken, four-armed Garmadon, Samurai X armor, serpentine tails, and skeleton bodies.

## Dependency rule

Dependency direction is:

```text
app -> features -> shared
```

Shared infrastructure must not import feature modules. This keeps the Three.js model system reusable and makes later model-loader work (for original/licensed GLB assets) straightforward.

## Adding a fighter

1. Add the fighter to `features/characters/roster.ts`.
2. If the standard model profile is not enough, add an ID-specific rule to `model-profile.ts`.
3. Keep the primary character name/variant behavior in `identity.ts`.
4. Run the roster/model acceptance tests.
5. Do not commit extracted commercial game assets.
