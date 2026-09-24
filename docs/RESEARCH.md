# LEGO Ninjago: Tournament — Reconstruction Research

_Last research / implementation audit: 2026-09-24._

This document is a clean-room behavior and presentation reference for the fan remake. It intentionally does **not** contain extracted APK/OBB code, proprietary models, textures, audio, animation files, logos, or other copyrighted game assets.

## What the original game was

The discontinued 2015 mobile title was a single-player action arena brawler tied to the Tournament of Elements period. Archived listings and contemporary coverage describe a short tutorial followed by repeated arena waves, character progression, unlocks, challenges, and bosses.

Public sources disagree slightly on exact launch date/developer attribution depending on platform/listing. Archived App Store metadata places the iOS release in January 2015; modern summaries credit TT Games and Hellbent Games, while some databases emphasize Hellbent Games. The remake therefore avoids embedding uncertain historical claims into gameplay code.

## Visual language

Reference screenshots consistently show:

- diagonal/isometric third-person camera above a compact stone arena;
- dark gray tiled floors, carved circular motifs, rock/wall perimeter, gates and large arena props;
- a portrait and heart-based health display at the upper left with the stud counter beneath it;
- an opponent portrait/health indicator or multiplier information toward the upper right depending on encounter/context;
- a translucent circular movement stick at lower left;
- a nearby Spinjitzu/special control and charge indicator;
- four circular action buttons at lower right;
- dark purple/black UI plates edged with bronze/gold rings;
- heavy impact flashes and defeated fighters breaking into brick-like pieces.

The current build reproduces this **layout and interaction language** with original procedural geometry and CSS rather than copied art, including the lower diagonal camera, purple/gold score plates, circular portraits, legacy-style controls, staged Chen throne, tournament banners and arena crowd silhouettes.

## Core loop

1. Choose/unlock a fighter.
2. Enter the arena.
3. Defeat increasingly large enemy waves.
4. Chain hits without taking damage to increase the combo/stud multiplier.
5. Fill the special meter by landing attacks.
6. Trigger Spinjitzu or another character special when charged.
7. Deal with melee, ranged, heavy, and boss behaviors plus arena events.
8. Collect/bank studs and use them to unlock more fighters.
9. Replay for higher waves, better multipliers, challenges, and progression.

## Confirmed control vocabulary

Contemporary reviews and reference pages consistently describe the following actions:

- movement by virtual joystick;
- standard attack;
- block/defend;
- jump and jump attacks/slams;
- grab/throw;
- dodge/evade;
- charged special ability such as Spinjitzu.

The current build implements movement, attack, block, jump, jump-slam, grab/throw, dodge/roll and charged specials including Spinjitzu.

## Wave, boss, and hazard behavior

Public references describe Chen's Arena as the primary mode. Enemy groups include melee fighters, ranged attackers, bomb users, stronger forms, and periodic Elemental Master bosses. Bosses have bespoke mechanics, with examples such as Karlof's ground tremor and Ash's disappear/reposition behavior.

Documented arena/events include:

- **Gongs:** throwing an enemy into a side gong can immediately defeat that target, including bosses in descriptions of the original behavior.
- **Boulder Basher:** marked target circles warn the player before rocks fall.
- **Titanium Dragon:** an ice projectile/event capable of freezing targets.
- **Roto Jet:** missile/box drops, with boxes able to yield studs or health.
- **Condrai Crushers:** reinforcement delivery/event behavior.
- **Training equipment:** destructible bags/props and damaging spikes.

The current build includes gong KOs, marked falling boulders, a visible Titanium Dragon flyover with freezing projectile, Roto Jet flyovers with breakable supply boxes and missile runs, visible Condrai Crusher reinforcement delivery, destructible training equipment and damaging spike traps.

## Economy and progression

Archived descriptions establish:

- studs as the main earnable currency;
- studs used for unlocks/upgrades and other run benefits;
- characters getting stronger as they are used/leveled;
- challenge categories including one-off, daily, and boss challenges;
- character potential progressing through multiple levels (up to five in MobyGames' description);
- a daily draw/reward system in community documentation;
- special abilities/power-ups beyond Spinjitzu.

The current build banks run studs locally and uses them for roster unlocks and Continue. Character XP, five-level potential/True Potential, daily draws, consumable pre-fight power-ups, challenge tracking and current/best-score results are implemented.

## Roster research

A community game page currently lists at least the following playable entries/variants: Lloyd (Tournament/Techno/Jungle/Garmadon), Kai (Tournament/Teacher/Jungle/Techno/DX), Cole (Tournament), Jay (Tournament/ZX), Zane (Techno/Pink/ZX/Teacher), Master Garmadon variants, Nya, Samurai X, Ash, Chamille, Shade, Skylor, Paleman, P.I.X.A.L., Clouse variants, Anacondrai/cultist variants, Zugu, Min-Droid, Pythor, Dareth, Acidicus, Stone Army Scout, Samukai, and Kruncha.

The same reference identifies bosses including Master Chen, Karlof, Ash, Mr. Pale, Neuro, Griffin Turner, and Ronin, plus enemy families such as Anacondrai Cultists, Nindroids, Serpentine, Stone Warriors, Skullkins, and Shade clones.

The current clean-room roster contains 51 data entries. It covers the explicitly documented playable list, the playable Elemental Master bosses supported by the public game documentation, Techno Wu, and the regional Tox replacement noted for the Bulgarian release. Ronin remains boss-only because the public game page specifically identifies him as the only unplayable boss.

Some fan posts and modified-game videos claim larger 70+ rosters or show extra golden/hidden variants. Those are not treated as canonical playable entries without stronger evidence; the roster remains data-driven so newly verified variants can be added without rewriting combat code.

## Special ability vocabulary found in public references

- Spinjitzu
- Boost
- Charge Attack
- Overload
- Air Strike
- Toxic Cloud
- Shout

All seven special families are represented through the data-driven fighter definitions and the combat content layer.

## Sources used for this pass

- Ninjago Wiki — LEGO Ninjago: Tournament gameplay, levels, bosses, events, roster, special abilities and discontinued status: https://ninjago.fandom.com/wiki/LEGO_Ninjago%3A_Tournament
- MobyGames — progression, challenges, character potential, power-ups, controls and release metadata: https://www.mobygames.com/game/73532/lego-ninjago-tournament/
- The Irish Times 2015 app review — contemporary description of waves, studs, joystick/action buttons, Spinjitzu charge, Elemental Master behavior and Boulder Basher: https://www.irishtimes.com/culture/games/game-reviews/lego-ninjago-tournament-app-review-1.2106257
- TouchArcade archived listing — original-era product description emphasizing leveling, unlockable characters and waves: https://toucharcade.com/games/lego%C2%AE-ninjago-tournament
- TapGameplay walkthrough — long-form visual/gameplay reference: https://www.youtube.com/watch?v=SIZGw7HGgG0
- SuperSoluce screenshot archive — HUD, arena, controls and camera reference: https://www.supersoluce.com/jeu/lego-ninjago-tournament
- MobyGames screenshots index — menu, dojo, character select, challenge, arena and game-over reference frames: https://www.mobygames.com/game/73532/lego-ninjago-tournament/screenshots/

## Reconstruction rules

- Do not commit files extracted from the original APK/OBB.
- Do not decompile/copy the original source code into this repository.
- Do not copy official logos, music, voices, models, textures, character portraits, or animations without a license/permission.
- Recreate mechanics from observation and public descriptions.
- Keep fighter stats, enemy types, abilities, waves, hazards, UI and progression data-driven.
- Prefer original procedural/blocky placeholder art until licensed/original replacement assets exist.

## Implementation status

The clean-room gameplay milestones are now implemented in code:

- fixed diagonal 3D arena plus a fully staged Dojo;
- mobile, keyboard and controller input;
- attack, jump/jump-slam, block, grab/throw, dodge and seven special families;
- combo/stud multiplier, physical stud/heart pickups, banking and 2,000-stud Continue;
- escalating waves, boss waves and distinct legacy enemy families;
- gong KO, Boulder Basher, Titanium Dragon, Roto Jet, Condrai Crusher, spikes and training props;
- boss-specific mechanics for Karlof, Ash, Mr. Pale, Neuro, Griffin Turner, Master Chen and Ronin;
- roster unlock economy, fighter XP, levels 1–5 and True Potential;
- pre-fight power-ups, challenges, daily tasks/prize draw and current/best score results;
- Temple Gallery, enemy codex and playable Dojo tutorial;
- camera/impact shake, micro hit-stop, combat sparks, brick breakup and synthesized clean-room SFX;
- deterministic save migration, PWA/offline support, Capacitor Android path, graphics presets and automated tests.

The remaining gap is **production art/release acceptance**, not missing core gameplay: fully authored/licensed character models and animation clips, final environment textures/artwork, original/licensed music/voice, real-device visual/performance acceptance, and final signed Android packaging.


## Supplied-video legacy additions

A September 2026 video-fidelity pass reviewed the user-supplied walkthrough and playlists alongside public archival descriptions. Five previously missing entries are now represented:

- Snike — named as unlockable in the original public app description.
- Bytar — observed as controlled gameplay in a legacy Tournament showcase.
- Skales — observed as controlled gameplay in a legacy Tournament showcase.
- Zane (Battle Damaged) — observed as controlled gameplay in a legacy Tournament walkthrough.
- Kai ZX — observed as a playable fighter in legacy Tournament gameplay and represented with a dedicated ZX armor silhouette.

Bytar, Skales, Battle-Damaged Zane and Kai ZX are deliberately classified as video-observed legacy entries because common public roster summaries are inconsistent about them. See `VIDEO-FIDELITY.md` for the evidence policy and implementation matrix.
