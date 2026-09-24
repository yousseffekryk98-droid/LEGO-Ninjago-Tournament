# Video Fidelity Matrix

This document tracks the clean-room remake against the gameplay material supplied for the project and public archival references.

## Supplied video references

- https://www.youtube.com/watch?v=SIZGw7HGgG0
- https://www.youtube.com/playlist?list=PLVWuYVItyjiQCYKJQzsoakD2YtrOZNdio
- https://www.youtube.com/playlist?list=PLj5n3gHxng9hdSiv3oqZRmSMUJ3RpRUZq

The implementation does **not** copy APK/OBB assets, textures, audio, models, animation files or source code. Video and screenshot material is used only as behavioral and visual reference for original clean-room code and geometry.

## Evidence levels

### A — official/public app description
Strongest reference. Includes the Tournament of Elements loop, Chen's Arena, character leveling / True Potential, unlockable characters, Elemental Masters and Spinjitzu.

### B — gameplay / screenshot observed
Visible in supplied walkthroughs, archived screenshots or multiple gameplay captures. Used for interaction, HUD and presentation fidelity.

### C — legacy showcase observed
Characters demonstrably shown being controlled in legacy gameplay showcase videos, but not consistently present in the common public roster list. These are included in the remake and clearly documented as video-observed rather than silently promoted to standard-roster provenance.

## Gameplay fidelity status

| Area | Observed behavior | Remake status |
| --- | --- | --- |
| Arena waves | Successive enemy waves in Chen's Arena | Implemented |
| Stage introduction | Stage/wave presentation before combat | Implemented with stage banner |
| Stage completed | Completion presentation between waves | Implemented |
| Melee / ranged / heavy foes | Different pressure patterns | Implemented |
| Elemental Master bosses | Bosses have unique abilities | Implemented |
| Boss health feedback | Boss durability is visible during fights | Implemented HUD health bar |
| Attack | Dedicated attack input | Implemented |
| Block | Dedicated block input | Implemented |
| Jump | Dedicated jump input | Implemented |
| Jump slam | Air attack / slam | Implemented |
| Grab / throw | Grab enemies and throw them | Implemented |
| Dodge | Swipe / directional dodge | Implemented |
| Gong KO | Thrown enemies can be eliminated against gongs | Implemented |
| Spinjitzu meter | Successful attacks charge special power | Implemented |
| Spinjitzu movement | Move while tornado attack is active | Implemented |
| Spinjitzu AoE | Tornado damages nearby opponents | Implemented |
| Spinjitzu VFX | Strong visible elemental tornado | Implemented with funnel, helical bands, rings, debris, dust and light |
| Combo multiplier | Multiplier rises with successful combat streaks | Implemented |
| Stud drops | Defeated enemies drop studs into arena | Implemented as physical collectible pickups |
| Stud magnet / collect | Nearby studs pull toward the player | Implemented |
| Run studs | In-run stud count visible prominently | Implemented |
| Banked studs | Persistent currency used outside the run | Implemented |
| Continue | Spend currency for another chance after knockout | Implemented: one stud-funded continue per run |
| Character unlocks | Spend progression currency to unlock fighters | Implemented |
| Character leveling | Repeated use strengthens fighters | Implemented levels 1–5 |
| True Potential | Highest level has stronger identity | Implemented stats + clean-room visual aura |
| Obsidian weapon treatment | Documented high-potential DX/ZX/Zukin variants use dark weapons | Implemented for supported variants |
| Power-up selection | Select/equip a power-up before a run | Implemented |
| Daily prize draw | Prize draw / rewards loop | Implemented |
| Challenges | Challenge preview and objectives | Implemented |
| Red low-energy screen | Screen turns red at low health | Implemented |
| Current score feedback | Stud/score and multiplier remain visible | Implemented |
| Temple Gallery | Collection / fighter archive | Implemented |
| Dojo training | Movement, attack, jump, block, grab, dodge, special tutorial | Implemented |
| Roto Jet | Supply boxes and missile attack runs | Implemented |
| Titanium Dragon | Freezing ice attack/event | Implemented |
| Condrai Crusher | Reinforcement delivery/event | Implemented |
| Boulder Basher | Telegraph then falling boulders | Implemented |
| Training props | Breakable practice props can reward studs | Implemented |
| Spike hazards | Arena spikes damage the player | Implemented |
| Mr. Pale invisibility | Boss can become difficult to see / hit | Implemented |
| Karlof tremor | Ground shockwave boss behavior | Implemented |
| Ash smoke movement | Smoke/reposition boss behavior | Implemented |
| Neuro mind burst | Radial projectile pressure | Implemented |
| Griffin Turner speed charge | High-speed charge behavior | Implemented |
| Chen reinforcements | Chen calls additional enemies | Implemented |
| Ronin mysterious foe | Boss-only encounter | Implemented |

## Graphics fidelity added in the video pass

The arena remains original geometry, but now follows the footage's visual language more closely:

- circular layered stone combat floor;
- central radial/sigil markings;
- large stone-and-red tournament gate;
- gold architectural accents;
- serpent-wrapped perimeter pillars;
- visible braziers and warm local lighting;
- stronger key/rim lighting and shadows;
- fog/depth treatment;
- red low-health vignette;
- prominent stud and multiplier HUD;
- richer Spinjitzu light/debris/tornado presentation.

Blender-exported GLB models can be introduced later through the existing character model factory, but this pass intentionally stays dependency-light and clean-room.

## Roster provenance

The primary documented roster remains represented, plus regional/documented additions already tracked in `RESEARCH.md`.

This video pass adds five entries that were missing from the remake:

- **Snike** — explicitly named as unlockable in the original public app description.
- **Bytar** — directly shown in a supplied legacy gameplay showcase.
- **Skales** — directly shown in a supplied legacy gameplay showcase.
- **Zane (Battle Damaged)** — directly shown in a supplied legacy gameplay walkthrough.
- **Kai ZX** — directly shown as a playable fighter in legacy Tournament gameplay (TanJinGames, 2017).

Bytar, Skales, Battle-Damaged Zane and Kai ZX are treated as **video-observed legacy entries** because public roster summaries are inconsistent about them. Their inclusion is evidence-driven, but the project should not claim stronger provenance without a better first-party roster archive.

The clean-room roster is now **51 entries**. Ronin remains boss-only.

## Asset rule

Do not commit extracted commercial game assets. If higher-fidelity art is created in Blender, it must be original, commissioned, or otherwise licensed for this repository. The runtime model interface is deliberately centralized under `src/features/characters/model.ts` and `src/shared/three/` so authored GLB assets can replace or augment procedural geometry later without rewriting gameplay.
