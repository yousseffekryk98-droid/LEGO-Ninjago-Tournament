import * as THREE from 'three';
import { TournamentGame as StableContentGame, type HudState, type GameCallbacks } from './ContentGameBase';
import type { CharacterDef } from '../characters';

export type { HudState, GameCallbacks } from './ContentGameBase';

type BaseAction = 'attack' | 'jump' | 'grab' | 'special';
type EnemyFaction = 'anacondrai' | 'nindroid' | 'bomber';

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

  constructor(host: HTMLElement, character: CharacterDef, callbacks: GameCallbacks) {
    super(host, character, callbacks);
    this.spawnTrainingProps();
    this.createPlayerAura();
    this.productionLoop();
  }

  override action(action: BaseAction) {
    const state = this.productionRuntime();
    const specialWasReady = state.special >= 100;
    super.action(action);
    if (action === 'attack') this.hitTrainingProps(2.55, 1);
    if (action === 'special' && specialWasReady) this.hitTrainingProps(4.3, 3);
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
    if (this.playerAura) state.scene.remove(this.playerAura);
    this.props = [];
    this.heartPickups = [];
    this.bombs = [];
    this.missileJets = [];
    this.missiles = [];
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
    this.updatePresentation();

    if (state.wave >= 3 && state.elapsed >= this.nextMissileRunAt && this.missileJets.length === 0) {
      this.spawnMissileJetRun();
      this.nextMissileRunAt = state.elapsed + 29 + Math.random() * 13;
    }
  };

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

    // Procedural minifigure motion: subtle arm/torso movement without imported
    // animation assets. The base fighter is intentionally block-built, so these
    // rotations remain safe across every clean-room character variant.
    const leftArm = state.player.getObjectByName('leftArm');
    const rightArm = state.player.getObjectByName('rightArm');
    if (leftArm && rightArm) {
      const swing = Math.sin(state.elapsed * 8) * 0.12;
      leftArm.rotation.x = swing;
      rightArm.rotation.x = -swing;
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
        const faction: EnemyFaction = enemy.kind === 'ranged'
          ? 'nindroid'
          : enemy.kind === 'heavy' && (index + state.wave) % 3 === 0
            ? 'bomber'
            : 'anacondrai';
        brain = {
          faction,
          cooldown: 1.2 + Math.random() * 2.4,
          phase: Math.random() < 0.5 ? -1 : 1,
          revealTime: faction === 'nindroid' ? 1.1 + Math.random() * 0.8 : 0
        };
        this.factionBrains.set(enemy.mesh, brain);
        enemy.mesh.userData.faction = faction;
        this.addFactionMarker(enemy, faction);
        if (faction === 'nindroid') this.setFactionOpacity(enemy.mesh, 0.08);
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

      if (brain.faction === 'anacondrai') {
        if (distance > 2.1 && distance < 7.5) enemy.mesh.position.addScaledVector(tangent, dt * 1.15);
        if (brain.cooldown <= 0 && distance > 2.3 && distance < 8) {
          enemy.knock.add(toward.multiplyScalar(5.8));
          brain.cooldown = 3 + Math.random() * 1.8;
          this.spawnRing(enemy.mesh.position, 0x9d5680, 1.1);
        }
      } else if (brain.faction === 'nindroid') {
        if (distance > 3 && distance < 9) enemy.mesh.position.addScaledVector(tangent, dt * 1.45);
        if (brain.cooldown <= 0) {
          enemy.mesh.position.addScaledVector(tangent, 1.45);
          brain.phase *= -1;
          brain.cooldown = 3.4 + Math.random() * 2;
          this.spawnRing(enemy.mesh.position, 0x63cceb, 1.0);
        }
      } else if (brain.cooldown <= 0 && distance < 10) {
        this.spawnBomb(enemy.mesh.position.clone().setY(1.2), state.player.position.clone().setY(0));
        brain.cooldown = 4.4 + Math.random() * 2.4;
        state.callbacks.onMessage('Bomber enemy: explosive incoming!');
      }
    }
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
    const color = faction === 'anacondrai' ? 0x9d5680 : faction === 'nindroid' ? 0x63cceb : 0xe78439;
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
