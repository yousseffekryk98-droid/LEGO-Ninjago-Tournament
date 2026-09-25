import * as THREE from 'three';
import { TournamentGame as StableContentGame, type HudState, type GameCallbacks, type TournamentGameOptions } from './ContentGameBase';
import { findCharacter, type CharacterDef } from '../characters';
import { createCharacterModel } from '../characters/model';

export type { HudState, GameCallbacks, TournamentGameOptions } from './ContentGameBase';

type BaseAction = 'attack' | 'punch' | 'kick' | 'jump' | 'grab' | 'special' | 'ultimate';
type EnemyFaction =
  | 'anacondrai'
  | 'anacondrai-serpentine'
  | 'nindroid'
  | 'serpentine'
  | 'stone-warrior'
  | 'skulkin'
  | 'shade-clone'
  | 'bomber';

interface RuntimeEnemy {
  mesh: THREE.Group;
  kind: string;
  hp: number;
  knock: THREE.Vector3;
  bossName?: string;
}

interface RuntimeInternals {
  scene: THREE.Scene;
  player: THREE.Group;
  enemies: RuntimeEnemy[];
  character: CharacterDef;
  callbacks: GameCallbacks;
  running: boolean;
  paused: boolean;
  studs: number;
  health: number;
  special: number;
  wave: number;
  elapsed: number;
  attackCooldown: number;
  combatMove: 'jab' | 'cross' | 'kick' | 'roundhouse';
  attackAnimationTime: number;
  attackAnimationDuration: number;
  input: { x: number; y: number; block: boolean };
  grounded: boolean;
  jumpVelocity: number;
  dodgeTime: number;
  spinTime: number;
  getMultiplier: () => number;
  emitHud: () => void;
  hitEnemy: (enemy: RuntimeEnemy, damage: number, knockback: number, force?: boolean) => void;
  damagePlayer: (amount: number) => void;
}

interface ArenaProp {
  group: THREE.Group;
  hp: number;
  wobble: number;
  alive: boolean;
}

interface HeartPickup {
  group: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
}

interface FactionBrain {
  faction: EnemyFaction;
  cooldown: number;
  phase: number;
  revealTime: number;
  phaseTime: number;
}

interface BombHazard {
  mesh: THREE.Mesh;
  marker: THREE.Mesh;
  start: THREE.Vector3;
  target: THREE.Vector3;
  total: number;
  remaining: number;
}

interface MissileJet {
  group: THREE.Group;
  life: number;
  dropped: boolean;
  dropAt: number;
}

interface JetMissile {
  group: THREE.Group;
  marker: THREE.Mesh;
  target: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
}

interface CombatFx {
  mesh: THREE.Mesh;
  life: number;
  total: number;
  startScale: number;
  endScale: number;
  spin: number;
}

/**
 * Production gameplay layer. It deliberately builds on the already-tested
 * clean-room tournament rather than replacing it, so each fidelity feature is
 * isolated and can be tested independently.
 */
export class TournamentGame extends StableContentGame {
  private productionFrame = 0;
  private productionDestroyed = false;
  private previousProductionElapsed = 0;
  private props: ArenaProp[] = [];
  private heartPickups: HeartPickup[] = [];
  private factionBrains = new WeakMap<THREE.Group, FactionBrain>();
  private bombs: BombHazard[] = [];
  private missileJets: MissileJet[] = [];
  private missiles: JetMissile[] = [];
  private nextMissileRunAt = 23 + Math.random() * 8;
  private playerAura: THREE.Mesh | null = null;
  private combatFx: CombatFx[] = [];
  private creationUltimateEnabled = false;
  private creationUltimateGroup: THREE.Group | null = null;
  private creationUltimateFighters: THREE.Group[] = [];
  private creationUltimateTime = 0;
  private creationUltimateTick = 0;
  private creationUltimateCooldown = 0;
  private lastPlayerPosition = new THREE.Vector3();
  private visualMoveAmount = 0;

  constructor(host: HTMLElement, character: CharacterDef, callbacks: GameCallbacks, options: TournamentGameOptions = {}) {
    super(host, character, callbacks, options);
    this.lastPlayerPosition.copy(this.productionRuntime().player.position).setY(0);
    this.spawnTrainingProps();
    this.createPlayerAura();
    this.productionLoop();
  }

  override action(action: BaseAction) {
    if (action === 'ultimate') {
      this.triggerCreationTornado();
      return;
    }
    const state = this.productionRuntime();
    const specialWasReady = state.special >= 100;
    super.action(action);
    if (action === 'attack' || action === 'punch' || action === 'kick') {
      this.hitTrainingProps(2.55, 1);
      this.spawnCombatSlash(action);
    }
    if (action === 'special' && specialWasReady) {
      this.hitTrainingProps(4.3, 3);
      this.spawnSpecialBurst();
    }
  }

  setCreationUltimateEnabled(enabled: boolean) {
    this.creationUltimateEnabled = enabled;
    if (!enabled) this.stopCreationTornado();
  }

  triggerCreationTornado() {
    if (!this.creationUltimateEnabled || this.creationUltimateTime > 0 || this.creationUltimateCooldown > 0) return false;
    const state = this.productionRuntime();
    const group = new THREE.Group();
    group.name = 'tornadoOfCreation';
    group.position.copy(state.player.position).setY(0);

    const teamIds = ['lloyd-tournament', 'kai-tournament', 'cole-tournament', 'zane-zx', 'jay-tournament', 'nya'];
    const safe = this.lowFxMode();
    this.creationUltimateFighters = teamIds.map((id, index) => {
      const fighter = findCharacter(id);
      const model = createCharacterModel({ ...fighter, special: 'spinjitzu' }, 0.9);
      model.userData.creationAngle = index / teamIds.length * Math.PI * 2;
      model.userData.creationColor = fighter.color;
      group.add(model);

      const funnel = new THREE.Mesh(
        new THREE.CylinderGeometry(1.08, 0.34, 2.7, safe ? 22 : 34, 1, true),
        new THREE.MeshBasicMaterial({
          color: fighter.color,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      funnel.name = `creationMiniTornado-${id}`;
      funnel.position.y = 1.25;
      funnel.userData.creationAngle = model.userData.creationAngle;
      group.add(funnel);
      return model;
    });

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 1.0, 7.4, safe ? 38 : 64, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xe9c75d,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    core.name = 'creationCore';
    core.position.y = 3.5;
    group.add(core);

    const colors = teamIds.map((id) => findCharacter(id).color);

    // Six interwoven elemental ribbons make the team ultimate read as one
    // combined tornado instead of several separate rings.
    for (let ribbonIndex = 0; ribbonIndex < (safe ? 3 : 6); ribbonIndex++) {
      const points: THREE.Vector3[] = [];
      for (let step = 0; step <= (safe ? 28 : 42); step++) {
        const t = step / (safe ? 28 : 42);
        const radius = 1.0 + t * 4.65;
        const angle = t * Math.PI * 6.0 + ribbonIndex * (Math.PI * 2 / 6);
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          0.35 + t * 6.75,
          Math.sin(angle) * radius
        ));
      }
      const ribbon = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), safe ? 38 : 64, safe ? 0.055 : 0.07, 7, false),
        new THREE.MeshBasicMaterial({
          color: colors[ribbonIndex % colors.length],
          transparent: true,
          opacity: safe ? 0.58 : 0.72,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      ribbon.name = 'creationRibbon';
      ribbon.userData.spinRate = ribbonIndex % 2 === 0 ? 3.6 : -4.2;
      group.add(ribbon);
    }

    for (let sparkIndex = 0; sparkIndex < (safe ? 12 : 24); sparkIndex++) {
      const spark = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.08, 0.28 + (sparkIndex % 4) * 0.05),
        new THREE.MeshBasicMaterial({
          color: colors[sparkIndex % colors.length],
          transparent: true,
          opacity: 0.82,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      spark.name = 'creationSpark';
      spark.userData.sparkAngle = sparkIndex / (safe ? 12 : 24) * Math.PI * 2;
      spark.userData.sparkRadius = 1.5 + (sparkIndex % 6) * 0.72;
      spark.userData.sparkHeight = 0.5 + (sparkIndex % 9) * 0.72;
      spark.userData.sparkSpeed = (sparkIndex % 2 === 0 ? 1 : -1) * (3.2 + (sparkIndex % 5) * 0.36);
      group.add(spark);
    }
    for (let index = 0; index < (safe ? 9 : 15); index++) {
      const t = index / (safe ? 8 : 14);
      const radius = 1.2 + t * 4.2;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.07 + t * 0.045, safe ? 7 : 9, safe ? 34 : 54),
        new THREE.MeshBasicMaterial({
          color: colors[index % colors.length],
          transparent: true,
          opacity: 0.78 - t * 0.28,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      ring.name = 'creationBand';
      ring.position.y = 0.45 + t * 6.25;
      ring.rotation.x = Math.PI / 2;
      ring.userData.spinRate = index % 2 === 0 ? 4.8 : -5.5;
      group.add(ring);
    }

    const floorWave = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 8.8, safe ? 48 : 84),
      new THREE.MeshBasicMaterial({
        color: 0xe8c65c,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    floorWave.name = 'creationFloorWave';
    floorWave.rotation.x = -Math.PI / 2;
    floorWave.position.y = 0.06;
    group.add(floorWave);

    const light = new THREE.PointLight(0xffdc72, safe ? 4.2 : 6.8, safe ? 12 : 18, 2);
    light.position.y = 3.4;
    group.add(light);

    state.scene.add(group);
    this.creationUltimateGroup = group;
    this.creationUltimateTime = 5.4;
    this.creationUltimateTick = 0;
    this.creationUltimateCooldown = 6.5;
    state.callbacks.onMessage('TORNADO OF CREATION — ALL NINJA, GO!');
    return true;
  }

  private stopCreationTornado() {
    if (!this.creationUltimateGroup) return;
    this.productionRuntime().scene.remove(this.creationUltimateGroup);
    this.creationUltimateGroup = null;
    this.creationUltimateFighters = [];
    this.creationUltimateTime = 0;
    this.creationUltimateTick = 0;
  }

  override destroy() {
    this.productionDestroyed = true;
    cancelAnimationFrame(this.productionFrame);
    const state = this.productionRuntime();
    for (const prop of this.props) state.scene.remove(prop.group);
    for (const heart of this.heartPickups) state.scene.remove(heart.group);
    for (const bomb of this.bombs) state.scene.remove(bomb.mesh, bomb.marker);
    for (const jet of this.missileJets) state.scene.remove(jet.group);
    for (const missile of this.missiles) state.scene.remove(missile.group, missile.marker);
    for (const effect of this.combatFx) state.scene.remove(effect.mesh);
    this.stopCreationTornado();
    if (this.playerAura) state.scene.remove(this.playerAura);
    this.props = [];
    this.heartPickups = [];
    this.bombs = [];
    this.missileJets = [];
    this.missiles = [];
    this.combatFx = [];
    super.destroy();
  }

  private productionRuntime() {
    return this as unknown as RuntimeInternals;
  }

  private productionLoop = () => {
    if (this.productionDestroyed) return;
    this.productionFrame = requestAnimationFrame(this.productionLoop);
    const state = this.productionRuntime();
    if (!state.running || state.paused) {
      this.previousProductionElapsed = state.elapsed;
      return;
    }
    const dt = Math.max(0, Math.min(0.05, state.elapsed - this.previousProductionElapsed));
    this.previousProductionElapsed = state.elapsed;
    if (dt <= 0) return;

    this.updateFactionBehaviors(dt);
    this.updateBombs(dt);
    this.updateTrainingProps(dt);
    this.updateHeartPickups(dt);
    this.updateMissileJets(dt);
    this.updateMissiles(dt);
    this.updateCombatFx(dt);
    this.updateCreationTornado(dt);
    this.updatePresentation();

    if (state.wave >= 3 && state.elapsed >= this.nextMissileRunAt && this.missileJets.length === 0) {
      this.spawnMissileJetRun();
      this.nextMissileRunAt = state.elapsed + 29 + Math.random() * 13;
    }
  };

  private lowFxMode() {
    return (document.documentElement.dataset.graphics ?? 'safe') === 'safe';
  }

  private addCombatFx(mesh: THREE.Mesh, life: number, startScale: number, endScale: number, spin = 0) {
    const state = this.productionRuntime();
    state.scene.add(mesh);
    this.combatFx.push({ mesh, life, total: life, startScale, endScale, spin });
  }

  private spawnCombatSlash(action: 'attack' | 'punch' | 'kick') {
    const state = this.productionRuntime();
    const player = state.player;
    const kick = action === 'kick';
    const color = new THREE.Color(state.character.accent).lerp(new THREE.Color(0xf1c95b), 0.28);
    const slash = new THREE.Mesh(
      new THREE.TorusGeometry(
        kick ? 1.22 : 0.98,
        kick ? 0.07 : 0.055,
        this.lowFxMode() ? 5 : 7,
        this.lowFxMode() ? 22 : 38,
        Math.PI * (kick ? 1.42 : 1.16)
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: kick ? 0.78 : 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    const facing = new THREE.Vector3(Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y));
    slash.position.copy(player.position).addScaledVector(facing, kick ? 0.95 : 0.72);
    slash.position.y += kick ? 0.72 : 1.18;
    slash.rotation.set(Math.PI / 2, player.rotation.y, kick ? -1.02 : -0.5);
    this.addCombatFx(slash, kick ? 0.3 : 0.22, 0.46, kick ? 1.65 : 1.35, kick ? 5 : 3.5);

    if (!this.lowFxMode()) {
      const echo = slash.clone();
      echo.material = (slash.material as THREE.MeshBasicMaterial).clone();
      (echo.material as THREE.MeshBasicMaterial).opacity *= 0.42;
      echo.position.y += kick ? 0.1 : 0.16;
      echo.rotation.z -= 0.2;
      this.addCombatFx(echo, kick ? 0.36 : 0.29, 0.35, kick ? 1.9 : 1.58, kick ? -4 : -2.8);
    }
  }

  private spawnSpecialBurst() {
    const state = this.productionRuntime();
    const color = new THREE.Color(state.character.accent).lerp(new THREE.Color(0xffffff), 0.18);
    const ringCount = this.lowFxMode() ? 2 : 4;
    for (let index = 0; index < ringCount; index++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.78 + index * 0.15, 0.86 + index * 0.15, this.lowFxMode() ? 26 : 48),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: Math.max(0.2, 0.58 - index * 0.08),
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(state.player.position).setY(0.08 + index * 0.025);
      this.addCombatFx(ring, 0.7 + index * 0.07, 0.22 + index * 0.08, 4.3 + index * 0.68, index % 2 === 0 ? 2.8 : -2.8);
    }
  }

  private updateCombatFx(dt: number) {
    const state = this.productionRuntime();
    for (const effect of [...this.combatFx]) {
      effect.life -= dt;
      const progress = 1 - Math.max(0, effect.life / effect.total);
      const scale = THREE.MathUtils.lerp(effect.startScale, effect.endScale, progress);
      effect.mesh.scale.setScalar(scale);
      effect.mesh.rotation.z += dt * effect.spin;
      const material = effect.mesh.material;
      if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
        material.opacity = Math.max(0, material.opacity * Math.pow(0.018, dt));
      }
      if (effect.life <= 0) {
        state.scene.remove(effect.mesh);
        const index = this.combatFx.indexOf(effect);
        if (index >= 0) this.combatFx.splice(index, 1);
      }
    }
  }

  private updateCreationTornado(dt: number) {
    this.creationUltimateCooldown = Math.max(0, this.creationUltimateCooldown - dt);
    const group = this.creationUltimateGroup;
    if (!group) return;

    const state = this.productionRuntime();
    this.creationUltimateTime = Math.max(0, this.creationUltimateTime - dt);
    this.creationUltimateTick -= dt;
    const elapsed = 5.4 - this.creationUltimateTime;
    group.position.x = state.player.position.x;
    group.position.z = state.player.position.z;
    group.rotation.y += dt * (elapsed < 1.25 ? 1.8 : 4.8);

    const gather = THREE.MathUtils.clamp(elapsed / 1.25, 0, 1);
    const orbitRadius = THREE.MathUtils.lerp(4.8, 1.45, gather);
    this.creationUltimateFighters.forEach((fighter, index) => {
      const base = Number(fighter.userData.creationAngle ?? index / Math.max(1, this.creationUltimateFighters.length) * Math.PI * 2);
      const angle = base + elapsed * (1.8 + index * 0.08);
      fighter.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
      fighter.rotation.y = Math.atan2(-fighter.position.x, -fighter.position.z) + elapsed * 7.5;
      fighter.visible = this.creationUltimateTime > 0.45;
    });

    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name === 'creationBand' || object.name === 'creationRibbon') {
        object.rotation.z += dt * Number(object.userData.spinRate ?? 4.5);
      }
      if (object.name === 'creationSpark') {
        const base = Number(object.userData.sparkAngle ?? 0);
        const radius = Number(object.userData.sparkRadius ?? 2);
        const height = Number(object.userData.sparkHeight ?? 1);
        const angle = base + elapsed * Number(object.userData.sparkSpeed ?? 3.6);
        object.position.set(Math.cos(angle) * radius, height + Math.sin(elapsed * 8 + base) * 0.22, Math.sin(angle) * radius);
        object.rotation.x += dt * 9;
        object.rotation.z += dt * 11;
      }
      if (object.name.startsWith('creationMiniTornado-')) {
        const base = Number(object.userData.creationAngle ?? 0);
        const angle = base + elapsed * 1.9;
        object.position.set(Math.cos(angle) * orbitRadius, 1.25, Math.sin(angle) * orbitRadius);
        object.rotation.y += dt * 10;
      }
      if (object.name === 'creationCore') {
        object.rotation.y += dt * 5.6;
        const pulse = 1 + Math.sin(elapsed * 8) * 0.06;
        object.scale.set(pulse, 1, pulse);
      }
      if (object.name === 'creationFloorWave') object.rotation.z -= dt * 3.2;
    });

    if (elapsed >= 0.75 && this.creationUltimateTick <= 0) {
      this.creationUltimateTick = 0.16;
      for (const enemy of [...state.enemies]) {
        const planar = enemy.mesh.position.clone().sub(group.position).setY(0);
        const distance = planar.length();
        if (distance > 14.5) continue;
        if (distance > 0.05) enemy.mesh.position.addScaledVector(planar.normalize(), -0.24);
        state.hitEnemy(enemy, state.character.damage * 0.46, 3.8, true);
      }
    }

    if (this.creationUltimateTime <= 0) {
      for (const enemy of [...state.enemies]) {
        if (enemy.mesh.position.distanceTo(group.position) <= 16.0) {
          state.hitEnemy(enemy, state.character.damage * 2.35, 13.5, true);
        }
      }
      this.spawnRing(group.position.clone(), 0xf0cc64, 9.6);
      state.callbacks.onMessage('Creation energy released!');
      this.stopCreationTornado();
    }
  }

  private createPlayerAura() {
    const state = this.productionRuntime();
    const material = new THREE.MeshBasicMaterial({
      color: state.character.accent,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.playerAura = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.9, 36), material);
    this.playerAura.rotation.x = -Math.PI / 2;
    this.playerAura.position.y = 0.035;
    state.scene.add(this.playerAura);
  }

  private updatePresentation() {
    const state = this.productionRuntime();
    if (this.playerAura) {
      this.playerAura.position.x = state.player.position.x;
      this.playerAura.position.z = state.player.position.z;
      const charge = Math.min(1, state.special / 100);
      this.playerAura.scale.setScalar(0.9 + charge * 0.55 + Math.sin(state.elapsed * 5) * 0.035);
      (this.playerAura.material as THREE.MeshBasicMaterial).opacity = 0.1 + charge * 0.32;
      this.playerAura.rotation.z += 0.008 + charge * 0.02;
    }

    const planar = new THREE.Vector3(state.player.position.x, 0, state.player.position.z);
    const moved = planar.distanceTo(this.lastPlayerPosition);
    this.lastPlayerPosition.copy(planar);
    this.visualMoveAmount = THREE.MathUtils.lerp(this.visualMoveAmount, Math.min(1, moved * 28), 0.2);

    const leftArm = state.player.getObjectByName('leftArm');
    const rightArm = state.player.getObjectByName('rightArm');
    const leftLeg = state.player.getObjectByName('leftLeg');
    const rightLeg = state.player.getObjectByName('rightLeg');
    const torso = state.player.getObjectByName('torso');
    const head = state.player.getObjectByName('head');
    const weaponRig = state.player.getObjectByName('weaponRig');

    const runSwing = Math.sin(state.elapsed * 11) * 0.48 * this.visualMoveAmount;
    const attackProgress = state.attackAnimationTime > 0 && state.attackAnimationDuration > 0
      ? THREE.MathUtils.clamp(1 - state.attackAnimationTime / state.attackAnimationDuration, 0, 1)
      : 0;
    const attackPulse = attackProgress > 0 ? Math.sin(Math.PI * attackProgress) : 0;
    const attackingWithLeg = state.combatMove === 'kick' || state.combatMove === 'roundhouse';

    if (leftLeg && rightLeg) {
      leftLeg.rotation.x = runSwing;
      rightLeg.rotation.x = -runSwing;
      leftLeg.rotation.z = 0;
      rightLeg.rotation.z = 0;
      if (!state.grounded) {
        leftLeg.rotation.x = -0.28;
        rightLeg.rotation.x = 0.34;
      } else if (attackPulse > 0.01 && state.combatMove === 'kick') {
        rightLeg.rotation.x = -1.38 * attackPulse;
        rightLeg.rotation.z = 0.18 * attackPulse;
        leftLeg.rotation.x = 0.18 * attackPulse;
      } else if (attackPulse > 0.01 && state.combatMove === 'roundhouse') {
        rightLeg.rotation.x = -0.72 * attackPulse;
        rightLeg.rotation.z = -1.08 * attackPulse;
        leftLeg.rotation.x = 0.24 * attackPulse;
      }
    }

    if (leftArm && rightArm) {
      leftArm.rotation.x = -runSwing * 0.82;
      rightArm.rotation.x = runSwing * 0.82;
      leftArm.rotation.z = -0.22;
      rightArm.rotation.z = 0.22;

      if (state.input.block) {
        leftArm.rotation.x = -1.05;
        rightArm.rotation.x = -1.05;
        leftArm.rotation.z = -0.58;
        rightArm.rotation.z = 0.58;
      } else if (attackPulse > 0.01 && state.combatMove === 'jab') {
        rightArm.rotation.x = -1.5 * attackPulse;
        rightArm.rotation.z = 0.2 + attackPulse * 0.42;
        leftArm.rotation.x = -0.72 * attackPulse;
        leftArm.rotation.z = -0.48;
      } else if (attackPulse > 0.01 && state.combatMove === 'cross') {
        leftArm.rotation.x = -1.52 * attackPulse;
        leftArm.rotation.z = -0.2 - attackPulse * 0.44;
        rightArm.rotation.x = -0.7 * attackPulse;
        rightArm.rotation.z = 0.48;
      } else if (attackPulse > 0.01 && attackingWithLeg) {
        leftArm.rotation.x = -0.8 * attackPulse;
        rightArm.rotation.x = -0.8 * attackPulse;
        leftArm.rotation.z = -0.48;
        rightArm.rotation.z = 0.48;
      } else if (!state.grounded) {
        leftArm.rotation.x = -0.72;
        rightArm.rotation.x = -0.72;
        leftArm.rotation.z = -0.45;
        rightArm.rotation.z = 0.45;
      }
    }

    if (torso) {
      const twist = state.combatMove === 'cross'
        ? attackPulse * 0.34
        : state.combatMove === 'roundhouse'
          ? attackPulse * -0.62
          : attackPulse * -0.22;
      torso.rotation.y = twist;
      torso.rotation.z = state.dodgeTime > 0
        ? -0.18
        : attackingWithLeg
          ? attackPulse * 0.13
          : runSwing * 0.05;
    }
    if (head) head.rotation.y = state.combatMove === 'cross' ? attackPulse * -0.18 : attackPulse * 0.12;
    if (weaponRig) {
      weaponRig.rotation.z = attackingWithLeg ? 0 : attackPulse * -0.42;
      weaponRig.rotation.x = attackingWithLeg ? 0 : attackPulse * -0.18;
    }

    if (state.spinTime > 0) {
      if (leftArm) leftArm.rotation.x = -0.35;
      if (rightArm) rightArm.rotation.x = 0.35;
      if (weaponRig) weaponRig.rotation.z = 0;
    }
  }

  private spawnTrainingProps() {
    const state = this.productionRuntime();
    const positions = [
      new THREE.Vector3(-6.4, 0, -3.1),
      new THREE.Vector3(6.2, 0, 3.4),
      new THREE.Vector3(-5.7, 0, 5.1),
      new THREE.Vector3(5.4, 0, -5.2)
    ];

    for (const position of positions) {
      const group = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x754b30, roughness: 0.9 });
      const bagMat = new THREE.MeshStandardMaterial({ color: 0x8f3230, roughness: 0.82 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x35343a, roughness: 0.72, metalness: 0.18 });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 8), wood);
      post.position.y = 1.1;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.14), wood);
      arm.position.set(0.35, 2.15, 0);
      const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.05, 14), bagMat);
      bag.position.set(0.72, 1.48, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 0.2, 12), metal);
      base.position.y = 0.1;
      group.add(post, arm, bag, base);
      group.position.copy(position);
      group.rotation.y = Math.random() * Math.PI * 2;
      group.userData.destructible = 'training-bag';
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      state.scene.add(group);
      this.props.push({ group, hp: 3, wobble: 0, alive: true });
    }
  }

  private hitTrainingProps(radius: number, damage: number) {
    const state = this.productionRuntime();
    for (const prop of this.props) {
      if (!prop.alive || prop.group.position.distanceTo(state.player.position) > radius) continue;
      prop.hp -= damage;
      prop.wobble = 0.34;
      this.spawnRing(prop.group.position, 0xd6ad4e, 1.0);
      if (prop.hp > 0) continue;
      prop.alive = false;
      state.scene.remove(prop.group);
      const payout = 120 * Math.max(1, state.getMultiplier());
      this.spawnStudBurst(prop.group.position.clone(), payout, 6);
      const droppedHeart = Math.random() < 0.32;
      if (droppedHeart) this.spawnHeartPickup(prop.group.position.clone());
      state.callbacks.onMessage(
        droppedHeart
          ? `Training bag smashed! ${payout.toLocaleString()} studs + HEART dropped`
          : `Training bag smashed! ${payout.toLocaleString()} studs dropped`
      );
      this.spawnPropDebris(prop.group.position);
      state.emitHud();
    }
  }

  private updateTrainingProps(dt: number) {
    for (const prop of this.props) {
      if (!prop.alive) continue;
      prop.wobble = Math.max(0, prop.wobble - dt);
      prop.group.rotation.z = prop.wobble > 0
        ? Math.sin(prop.wobble * 34) * prop.wobble * 0.45
        : prop.group.rotation.z * Math.pow(0.02, dt);
    }
  }

  private spawnHeartPickup(origin: THREE.Vector3) {
    const state = this.productionRuntime();
    const group = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({
      color: 0xe83f4f,
      emissive: 0x551018,
      emissiveIntensity: 0.45,
      roughness: 0.34,
      metalness: 0.02
    });
    const left = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), red);
    const right = left.clone();
    left.position.set(-0.15, 0.1, 0);
    right.position.set(0.15, 0.1, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.48, 12), red);
    tip.rotation.z = Math.PI;
    tip.position.y = -0.13;
    group.add(left, right, tip);
    group.scale.setScalar(0.92);
    group.position.copy(origin).add(new THREE.Vector3(0, 1.05, 0));
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = true;
    });
    state.scene.add(group);
    this.heartPickups.push({
      group,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2.3, 3.4 + Math.random() * 1.6, (Math.random() - 0.5) * 2.3),
      life: 12
    });
    this.spawnRing(origin, 0xe83f4f, 1.25);
  }

  private updateHeartPickups(dt: number) {
    const state = this.productionRuntime();
    for (const heart of [...this.heartPickups]) {
      heart.life -= dt;
      heart.velocity.y -= 8.6 * dt;
      heart.group.position.addScaledVector(heart.velocity, dt);
      if (heart.group.position.y < 0.45) {
        heart.group.position.y = 0.45;
        heart.velocity.y = Math.abs(heart.velocity.y) * 0.35;
        heart.velocity.x *= 0.78;
        heart.velocity.z *= 0.78;
      }
      heart.group.rotation.y += dt * 3.4;
      heart.group.position.y += Math.sin(state.elapsed * 6 + heart.life) * dt * 0.07;

      const toPlayer = state.player.position.clone().sub(heart.group.position);
      const distance = toPlayer.length();
      if (distance < 4.2 && distance > 0.001) {
        heart.group.position.addScaledVector(toPlayer.normalize(), dt * (5.5 + (4.2 - distance) * 2.2));
      }
      if (distance < 0.85) {
        state.health = Math.min(state.character.maxHealth, state.health + 1);
        state.callbacks.onMessage('HEART collected! Health +1');
        state.emitHud();
        this.spawnRing(state.player.position, 0xe83f4f, 1.45);
        state.scene.remove(heart.group);
        this.heartPickups.splice(this.heartPickups.indexOf(heart), 1);
        continue;
      }
      if (heart.life <= 0) {
        state.scene.remove(heart.group);
        this.heartPickups.splice(this.heartPickups.indexOf(heart), 1);
      }
    }
  }

  private spawnPropDebris(origin: THREE.Vector3) {
    const state = this.productionRuntime();
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8d3030 : 0x775039, roughness: 0.8 })
      );
      mesh.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.5 + Math.random(), (Math.random() - 0.5) * 0.7));
      state.scene.add(mesh);
      const velocity = new THREE.Vector3((Math.random() - 0.5) * 4.5, 2 + Math.random() * 3, (Math.random() - 0.5) * 4.5);
      const started = performance.now();
      const animate = () => {
        if (this.productionDestroyed) { state.scene.remove(mesh); return; }
        const step = 1 / 60;
        velocity.y -= 9.8 * step;
        mesh.position.addScaledVector(velocity, step);
        mesh.rotation.x += step * 5;
        mesh.rotation.z += step * 4;
        if (performance.now() - started > 900 || mesh.position.y < 0) state.scene.remove(mesh);
        else requestAnimationFrame(animate);
      };
      animate();
    }
  }

  private updateFactionBehaviors(dt: number) {
    const state = this.productionRuntime();
    for (const [index, enemy] of state.enemies.entries()) {
      if (enemy.kind === 'boss' || enemy.bossName) continue;
      let brain = this.factionBrains.get(enemy.mesh);
      if (!brain) {
        const faction = this.chooseFaction(enemy, index, state.wave);
        brain = {
          faction,
          cooldown: 1.2 + Math.random() * 2.4,
          phase: Math.random() < 0.5 ? -1 : 1,
          revealTime: faction === 'nindroid' ? 1.1 + Math.random() * 0.8 : 0,
          phaseTime: faction === 'shade-clone' ? 1.4 + Math.random() * 1.2 : 0
        };
        this.factionBrains.set(enemy.mesh, brain);
        enemy.mesh.userData.faction = faction;
        this.applyFactionLook(enemy, faction);
        this.addFactionMarker(enemy, faction);
        if (faction === 'nindroid') this.setFactionOpacity(enemy.mesh, 0.08);
        if (faction === 'anacondrai-serpentine') {
          enemy.hp *= 1.28;
          enemy.mesh.userData.noGrab = true;
          enemy.mesh.scale.multiplyScalar(1.06);
        }
      }

      brain.cooldown -= dt;
      if (brain.revealTime > 0) {
        brain.revealTime -= dt;
        if (brain.revealTime <= 0) {
          this.setFactionOpacity(enemy.mesh, 1);
          this.spawnRing(enemy.mesh.position, 0x63cceb, 1.35);
        } else {
          continue;
        }
      }

      const toPlayer = state.player.position.clone().sub(enemy.mesh.position).setY(0);
      const distance = toPlayer.length();
      if (distance < 0.001) continue;
      const toward = toPlayer.normalize();
      const tangent = new THREE.Vector3(-toward.z, 0, toward.x).multiplyScalar(brain.phase);

      if (brain.faction === 'anacondrai' || brain.faction === 'anacondrai-serpentine') {
        if (distance > 2.1 && distance < 7.5) {
          const flank = brain.faction === 'anacondrai-serpentine' ? 0.95 : 1.15;
          enemy.mesh.position.addScaledVector(tangent, dt * flank);
        }
        if (brain.cooldown <= 0 && distance > 2.3 && distance < 8) {
          enemy.knock.add(toward.multiplyScalar(brain.faction === 'anacondrai-serpentine' ? 6.7 : 5.8));
          brain.cooldown = 3 + Math.random() * 1.8;
          this.spawnRing(enemy.mesh.position, brain.faction === 'anacondrai-serpentine' ? 0x744590 : 0x9d5680, 1.1);
        }
      } else if (brain.faction === 'nindroid') {
        if (distance > 3 && distance < 9) enemy.mesh.position.addScaledVector(tangent, dt * 1.45);
        if (brain.cooldown <= 0) {
          enemy.mesh.position.addScaledVector(tangent, 1.45);
          brain.phase *= -1;
          brain.cooldown = 3.4 + Math.random() * 2;
          this.spawnRing(enemy.mesh.position, 0x63cceb, 1.0);
        }
      } else if (brain.faction === 'serpentine') {
        enemy.mesh.position.addScaledVector(tangent, dt * (1.1 + Math.sin(state.elapsed * 5 + index) * 0.55));
        if (brain.cooldown <= 0 && distance > 2 && distance < 7) {
          enemy.mesh.position.addScaledVector(toward, 1.1);
          brain.phase *= -1;
          brain.cooldown = 2.5 + Math.random() * 1.4;
          this.spawnRing(enemy.mesh.position, 0x78a743, 0.95);
        }
      } else if (brain.faction === 'stone-warrior') {
        enemy.knock.multiplyScalar(Math.pow(0.18, dt));
        if (brain.cooldown <= 0 && distance < 4.6) {
          this.spawnRing(enemy.mesh.position, 0x9b9da2, 1.2);
          brain.cooldown = 3.8 + Math.random() * 1.8;
        }
      } else if (brain.faction === 'skulkin') {
        enemy.mesh.position.addScaledVector(tangent, dt * 2.35);
        if (brain.cooldown <= 0 && distance > 1.8 && distance < 7.5) {
          enemy.mesh.position.addScaledVector(toward, 1.45);
          brain.phase *= -1;
          brain.cooldown = 2.1 + Math.random() * 1.3;
          this.spawnRing(enemy.mesh.position, 0xd9d2c4, 0.9);
        }
      } else if (brain.faction === 'shade-clone') {
        brain.phaseTime -= dt;
        if (brain.phaseTime <= 0) {
          const hidden = enemy.mesh.userData.shadeHidden === true;
          enemy.mesh.userData.shadeHidden = !hidden;
          this.setFactionOpacity(enemy.mesh, hidden ? 0.82 : 0.14);
          enemy.mesh.position.addScaledVector(tangent, hidden ? 0.7 : 1.3);
          brain.phase *= -1;
          brain.phaseTime = hidden ? 1.1 + Math.random() * 1.1 : 0.45 + Math.random() * 0.35;
          this.spawnRing(enemy.mesh.position, 0x654a83, 0.82);
        }
      } else if (brain.cooldown <= 0 && distance < 10) {
        this.spawnBomb(enemy.mesh.position.clone().setY(1.2), state.player.position.clone().setY(0));
        brain.cooldown = 4.4 + Math.random() * 2.4;
        state.callbacks.onMessage('Bomb enemy: explosive incoming!');
      }
    }
  }

  private chooseFaction(enemy: RuntimeEnemy, index: number, wave: number): EnemyFaction {
    const seed = Math.abs(index + wave * 3);
    if (enemy.kind === 'ranged') return seed % 3 === 0 ? 'shade-clone' : 'nindroid';
    if (enemy.kind === 'heavy') return seed % 2 === 0 ? 'stone-warrior' : 'bomber';
    const melee: EnemyFaction[] = ['anacondrai', 'anacondrai-serpentine', 'serpentine', 'skulkin', 'shade-clone'];
    return melee[seed % melee.length];
  }

  private applyFactionLook(enemy: RuntimeEnemy, faction: EnemyFaction) {
    const tint: Record<EnemyFaction, number> = {
      anacondrai: 0x8f3f6d,
      'anacondrai-serpentine': 0x604283,
      nindroid: 0x345f82,
      serpentine: 0x588d42,
      'stone-warrior': 0x5d6165,
      skulkin: 0xd9d1bd,
      'shade-clone': 0x34283e,
      bomber: 0x91472f
    };
    enemy.mesh.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const entry of materials) {
        const material = entry as THREE.MeshStandardMaterial;
        if (!material.color) continue;
        material.color.lerp(new THREE.Color(tint[faction]), faction === 'stone-warrior' ? 0.48 : 0.34);
        if (faction === 'stone-warrior') {
          material.metalness = Math.max(material.metalness, 0.28);
          material.roughness = Math.min(material.roughness, 0.58);
        }
        if (faction === 'shade-clone') {
          material.transparent = true;
          material.opacity = Math.min(material.opacity, 0.82);
        }
      }
    });
  }

  private setFactionOpacity(group: THREE.Group, opacity: number) {
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material.userData.factionOriginalOpacity === undefined) {
          material.userData.factionOriginalOpacity = material.opacity;
          material.userData.factionOriginalTransparent = material.transparent;
        }
        const originalOpacity = Number(material.userData.factionOriginalOpacity ?? 1);
        const originalTransparent = Boolean(material.userData.factionOriginalTransparent);
        material.opacity = opacity < 1 ? Math.min(originalOpacity, opacity) : originalOpacity;
        material.transparent = opacity < 1 || originalTransparent;
        material.needsUpdate = true;
      }
    });
  }

  private addFactionMarker(enemy: RuntimeEnemy, faction: EnemyFaction) {
    const colors: Record<EnemyFaction, number> = {
      anacondrai: 0x9d5680,
      'anacondrai-serpentine': 0x7c5ba2,
      nindroid: 0x63cceb,
      serpentine: 0x80b84e,
      'stone-warrior': 0xa6a8ab,
      skulkin: 0xe4dccb,
      'shade-clone': 0x7a5b99,
      bomber: 0xe78439
    };
    const color = colors[faction];
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.055, 8, 18),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.y = 2.75;
    marker.name = `faction-${faction}`;
    enemy.mesh.add(marker);
  }

  private spawnBomb(origin: THREE.Vector3, target: THREE.Vector3) {
    const state = this.productionRuntime();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x29252b, roughness: 0.62, metalness: 0.2, emissive: 0x4e160c })
    );
    mesh.position.copy(origin);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.08, 30),
      new THREE.MeshBasicMaterial({ color: 0xff743d, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.copy(target).setY(0.04);
    state.scene.add(mesh, marker);
    this.bombs.push({ mesh, marker, start: origin.clone(), target: target.clone(), total: 1.25, remaining: 1.25 });
  }

  private updateBombs(dt: number) {
    const state = this.productionRuntime();
    for (const bomb of [...this.bombs]) {
      bomb.remaining -= dt;
      const t = Math.min(1, 1 - bomb.remaining / bomb.total);
      bomb.mesh.position.lerpVectors(bomb.start, bomb.target, t);
      bomb.mesh.position.y = Math.max(0.28, (1 - t) * bomb.start.y + Math.sin(t * Math.PI) * 2.1);
      bomb.mesh.rotation.x += dt * 7;
      bomb.mesh.rotation.z += dt * 9;
      (bomb.marker.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.abs(Math.sin(performance.now() * 0.014)) * 0.55;
      if (bomb.remaining > 0) continue;
      const impact = bomb.target.clone().setY(0);
      if (impact.distanceTo(state.player.position.clone().setY(0)) < 2.75) state.damagePlayer(1.25);
      for (const enemy of [...state.enemies]) if (enemy.mesh.position.distanceTo(impact) < 2) state.hitEnemy(enemy, 12, 4, true);
      this.spawnRing(impact, 0xff7b38, 3.0);
      state.scene.remove(bomb.mesh, bomb.marker);
      this.bombs.splice(this.bombs.indexOf(bomb), 1);
    }
  }

  private spawnMissileJetRun() {
    const state = this.productionRuntime();
    const group = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xb52d2d, roughness: 0.52, metalness: 0.18 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x282c32, roughness: 0.5, metalness: 0.28 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.44, 0.92), red);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 10), red);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 1.55;
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 3.7), dark);
    rotor.position.y = 0.45;
    group.add(body, nose, rotor);
    group.position.set(-18, 8.1, -6 + Math.random() * 12);
    group.rotation.y = Math.PI / 2;
    group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
    state.scene.add(group);
    this.missileJets.push({ group, life: 3.3, dropped: false, dropAt: -2 + Math.random() * 4 });
    state.callbacks.onMessage('Roto Jet missile run — watch the target markers!');
  }

  private updateMissileJets(dt: number) {
    const state = this.productionRuntime();
    for (const jet of [...this.missileJets]) {
      jet.life -= dt;
      jet.group.position.x += 12.2 * dt;
      const rotor = jet.group.children[2];
      if (rotor) rotor.rotation.y += dt * 22;
      if (!jet.dropped && jet.group.position.x >= jet.dropAt) {
        jet.dropped = true;
        const center = state.player.position.clone().setY(0);
        this.spawnJetMissile(jet.group.position.clone(), center.clone().add(new THREE.Vector3(-1.4 + Math.random() * 2.8, 0, -1.4 + Math.random() * 2.8)));
        this.spawnJetMissile(jet.group.position.clone().add(new THREE.Vector3(-1, 0, 0.7)), center.clone().add(new THREE.Vector3(-2.4 + Math.random() * 4.8, 0, -2.4 + Math.random() * 4.8)));
      }
      if (jet.life <= 0 || jet.group.position.x > 20) {
        state.scene.remove(jet.group);
        this.missileJets.splice(this.missileJets.indexOf(jet), 1);
      }
    }
  }

  private spawnJetMissile(origin: THREE.Vector3, target: THREE.Vector3) {
    const state = this.productionRuntime();
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 0.78, 10),
      new THREE.MeshStandardMaterial({ color: 0x393d43, metalness: 0.5, roughness: 0.38 })
    );
    body.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 10), new THREE.MeshStandardMaterial({ color: 0xc63832, roughness: 0.55 }));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.52;
    const glow = new THREE.PointLight(0xff6a39, 2.2, 3.5, 2);
    glow.position.z = 0.4;
    group.add(body, tip, glow);
    group.position.copy(origin);
    state.scene.add(group);

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.82, 30),
      new THREE.MeshBasicMaterial({ color: 0xff513f, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.copy(target).setY(0.045);
    state.scene.add(marker);
    this.missiles.push({ group, marker, target, velocity: new THREE.Vector3(), life: 2.2 });
  }

  private updateMissiles(dt: number) {
    const state = this.productionRuntime();
    for (const missile of [...this.missiles]) {
      missile.life -= dt;
      const toTarget = missile.target.clone().sub(missile.group.position);
      const planar = new THREE.Vector3(toTarget.x, 0, toTarget.z);
      if (planar.lengthSq() > 0.001) missile.velocity.lerp(planar.normalize().multiplyScalar(6.5), Math.min(1, dt * 4));
      missile.group.position.x += missile.velocity.x * dt;
      missile.group.position.z += missile.velocity.z * dt;
      missile.group.position.y -= (4.8 + (2.2 - missile.life) * 3.1) * dt;
      missile.group.rotation.x += dt * 8;
      (missile.marker.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.abs(Math.sin(performance.now() * 0.015)) * 0.5;
      if (missile.group.position.y > 0.2 && missile.life > 0) continue;
      const impact = missile.group.position.clone().setY(0);
      if (impact.distanceTo(state.player.position.clone().setY(0)) < 2.65) state.damagePlayer(1.15);
      for (const enemy of [...state.enemies]) if (enemy.mesh.position.distanceTo(impact) < 2.1) state.hitEnemy(enemy, 18, 5, true);
      this.spawnRing(impact, 0xff5a42, 3.1);
      state.scene.remove(missile.group, missile.marker);
      this.missiles.splice(this.missiles.indexOf(missile), 1);
    }
  }

  private spawnRing(origin: THREE.Vector3, color: number, maxRadius: number) {
    const state = this.productionRuntime();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.94, 36),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(origin).setY(0.055);
    ring.scale.setScalar(0.08);
    state.scene.add(ring);
    const start = performance.now();
    const animate = () => {
      if (this.productionDestroyed) { state.scene.remove(ring); return; }
      const t = Math.min(1, (performance.now() - start) / 430);
      ring.scale.setScalar(0.08 + t * maxRadius);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
      if (t >= 1) state.scene.remove(ring);
      else requestAnimationFrame(animate);
    };
    animate();
  }
}
