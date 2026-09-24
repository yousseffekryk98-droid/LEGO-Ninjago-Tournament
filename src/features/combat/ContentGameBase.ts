import * as THREE from 'three';
import { TournamentGame as BaseTournamentGame, type HudState, type GameCallbacks } from './TournamentGame';
import type { CharacterDef } from '../characters';

export type { HudState, GameCallbacks } from './TournamentGame';

type BaseAction = 'attack' | 'jump' | 'grab' | 'special';

interface RuntimeEnemy {
  mesh: THREE.Group;
  kind: string;
  hp: number;
  knock: THREE.Vector3;
}

interface RuntimeInternals {
  scene: THREE.Scene;
  player: THREE.Group;
  enemies: RuntimeEnemy[];
  character: CharacterDef;
  callbacks: GameCallbacks;
  running: boolean;
  paused: boolean;
  health: number;
  studs: number;
  special: number;
  invulnerable: number;
  attackCooldown: number;
  wave: number;
  elapsed: number;
  getMultiplier: () => number;
  emitHud: () => void;
  hitEnemy: (enemy: RuntimeEnemy, damage: number, knockback: number, force?: boolean) => void;
}

interface SupplyCrate {
  group: THREE.Group;
  shadow: THREE.Mesh;
  velocity: number;
  landed: boolean;
  life: number;
  spin: number;
  hp: number;
}

interface JetPass {
  group: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
  dropped: boolean;
  dropAt: number;
}

export class TournamentGame extends BaseTournamentGame {
  private contentFrame = 0;
  private crates: SupplyCrate[] = [];
  private jets: JetPass[] = [];
  private nextSupplyAt = 17 + Math.random() * 7;
  private previousElapsed = 0;
  private boostTime = 0;
  private boostEchoCooldown = 0;
  private boostBaseSpeed = 0;
  private boostBaseDamage = 0;
  private toxicTime = 0;
  private toxicTick = 0;
  private contentDestroyed = false;

  constructor(host: HTMLElement, character: CharacterDef, callbacks: GameCallbacks) {
    super(host, character, callbacks);
    this.contentLoop();
  }

  override action(action: BaseAction) {
    const state = this.runtime();
    const specialWasReady = state.special >= 100;

    if (action !== 'special' || state.character.special === 'spinjitzu') {
      super.action(action);
    } else {
      this.performCharacterSpecial();
    }

    if (action === 'attack') this.hitSupplyCrates(2.7, 1);
    if (action === 'special' && specialWasReady) this.hitSupplyCrates(4.4, 3);
  }

  override destroy() {
    this.contentDestroyed = true;
    cancelAnimationFrame(this.contentFrame);
    this.restoreBoost();
    super.destroy();
  }

  private runtime() {
    return this as unknown as RuntimeInternals;
  }

  private contentLoop = () => {
    if (this.contentDestroyed) return;
    this.contentFrame = requestAnimationFrame(this.contentLoop);
    const state = this.runtime();
    if (!state.running || state.paused) {
      this.previousElapsed = state.elapsed;
      return;
    }
    const dt = Math.max(0, Math.min(0.05, state.elapsed - this.previousElapsed));
    this.previousElapsed = state.elapsed;
    if (dt <= 0) return;
    this.updateJets(dt);
    this.updateCrates(dt);
    this.updatePowerups(dt);
    if (state.wave >= 2 && state.elapsed >= this.nextSupplyAt && this.jets.length === 0) {
      this.spawnRotoJetPass();
      this.nextSupplyAt = state.elapsed + 22 + Math.random() * 12;
    }
  };

  private performCharacterSpecial() {
    const state = this.runtime();
    if (state.special < 100 || state.attackCooldown > 0) return;
    const special = state.character.special;
    state.special = 0;
    state.attackCooldown = 0.5;
    state.invulnerable = Math.max(state.invulnerable, 0.55);
    if (special === 'boost') {
      this.startBoost(6.5, 1.38, 1.28);
      state.callbacks.onMessage(`${state.character.name}: BOOST! Speed and damage increased.`);
    } else if (special === 'charge') {
      const forward = new THREE.Vector3(Math.sin(state.player.rotation.y), 0, Math.cos(state.player.rotation.y));
      state.player.position.addScaledVector(forward, 2.6);
      for (const enemy of [...state.enemies]) {
        const offset = enemy.mesh.position.clone().sub(state.player.position).setY(0);
        const forwardDistance = offset.dot(forward);
        const sideDistance = offset.clone().sub(forward.clone().multiplyScalar(forwardDistance)).length();
        if (forwardDistance > -1.2 && forwardDistance < 7.2 && sideDistance < 2.1) state.hitEnemy(enemy, state.character.damage * 1.65, 8, true);
      }
      this.spawnPulse(state.player.position, 0xe4b64d, 3.2);
      state.callbacks.onMessage(`${state.character.name}: CHARGE ATTACK!`);
    } else if (special === 'overload') {
      for (const enemy of [...state.enemies]) if (enemy.mesh.position.distanceTo(state.player.position) < 5.4) state.hitEnemy(enemy, state.character.damage * 1.4, 7.5, true);
      this.spawnPulse(state.player.position, 0x7edcff, 5.3);
      state.callbacks.onMessage(`${state.character.name}: OVERLOAD!`);
    } else if (special === 'airstrike') {
      const targets = [...state.enemies].sort((a, b) => a.mesh.position.distanceTo(state.player.position) - b.mesh.position.distanceTo(state.player.position)).slice(0, 6);
      for (const [index, enemy] of targets.entries()) this.spawnAirStrike(enemy, index * 0.1);
      state.callbacks.onMessage(`${state.character.name}: AIR STRIKE!`);
    } else if (special === 'toxic-cloud') {
      this.toxicTime = 5.2;
      this.toxicTick = 0;
      this.spawnCloud(state.player.position);
      state.callbacks.onMessage(`${state.character.name}: TOXIC CLOUD!`);
    } else if (special === 'shout') {
      for (const enemy of [...state.enemies]) if (enemy.mesh.position.distanceTo(state.player.position) < 6.2) state.hitEnemy(enemy, state.character.damage * 0.95, 11, true);
      this.spawnPulse(state.player.position, 0xe9d5a5, 6.1);
      state.callbacks.onMessage(`${state.character.name}: SHOUT!`);
    }
    state.emitHud();
  }

  private updatePowerups(dt: number) {
    const state = this.runtime();
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      this.boostEchoCooldown -= dt;
      if (this.boostEchoCooldown <= 0) {
        this.spawnSpeedEcho();
        this.boostEchoCooldown = 0.11;
      }
      if (this.boostTime <= 0) { this.restoreBoost(); state.callbacks.onMessage('Boost expired.'); }
    }
    if (this.toxicTime > 0) {
      this.toxicTime -= dt;
      this.toxicTick -= dt;
      if (this.toxicTick <= 0) {
        this.toxicTick = 0.45;
        for (const enemy of [...state.enemies]) if (enemy.mesh.position.distanceTo(state.player.position) < 4.3) state.hitEnemy(enemy, Math.max(8, state.character.damage * 0.32), 1.4, true);
      }
    }
  }

  private startBoost(seconds: number, speedMultiplier: number, damageMultiplier: number) {
    const state = this.runtime();
    if (this.boostTime <= 0) { this.boostBaseSpeed = state.character.speed; this.boostBaseDamage = state.character.damage; }
    state.character.speed = this.boostBaseSpeed * speedMultiplier;
    state.character.damage = Math.round(this.boostBaseDamage * damageMultiplier);
    this.boostTime = Math.max(this.boostTime, seconds);
    this.boostEchoCooldown = 0;
    this.spawnPulse(state.player.position, state.character.accent, 1.7);
  }

  private restoreBoost() {
    if (this.boostTime <= 0 && this.boostBaseSpeed === 0) return;
    const state = this.runtime();
    if (this.boostBaseSpeed > 0) state.character.speed = this.boostBaseSpeed;
    if (this.boostBaseDamage > 0) state.character.damage = this.boostBaseDamage;
    this.boostTime = 0; this.boostEchoCooldown = 0; this.boostBaseSpeed = 0; this.boostBaseDamage = 0;
  }

  private spawnRotoJetPass() {
    const state = this.runtime();
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb52d2d, roughness: 0.55, metalness: 0.12 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x282c32, roughness: 0.48, metalness: 0.25 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.48, 1.0), bodyMat);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.0, 10), bodyMat); nose.rotation.z = -Math.PI / 2; nose.position.x = 1.55;
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 3.8), darkMat); rotor.position.y = 0.48;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.2, 0.25), darkMat); tail.position.x = -1.65;
    group.add(body, nose, rotor, tail);
    group.position.set(-18, 8.5, -7.5 + Math.random() * 15); group.rotation.y = Math.PI / 2;
    group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
    state.scene.add(group);
    this.jets.push({ group, velocity: new THREE.Vector3(12.5, 0, 0), life: 3.2, dropped: false, dropAt: -1 + Math.random() * 2 });
    state.callbacks.onMessage('Roto Jet incoming — supply drop!');
  }

  private updateJets(dt: number) {
    const state = this.runtime();
    for (const jet of [...this.jets]) {
      jet.life -= dt; jet.group.position.addScaledVector(jet.velocity, dt);
      const rotor = jet.group.children[2]; if (rotor) rotor.rotation.y += dt * 20;
      if (!jet.dropped && jet.group.position.x >= jet.dropAt) { jet.dropped = true; this.spawnSupplyCrate(new THREE.Vector3(jet.group.position.x, 7.3, jet.group.position.z)); }
      if (jet.life <= 0 || jet.group.position.x > 20) { state.scene.remove(jet.group); this.jets.splice(this.jets.indexOf(jet), 1); }
    }
  }

  private spawnSupplyCrate(position: THREE.Vector3) {
    const state = this.runtime();
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), new THREE.MeshStandardMaterial({ color: 0x9e642b, roughness: 0.72 }));
    const bandA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 1.2), new THREE.MeshStandardMaterial({ color: 0xd6b148, metalness: 0.22, roughness: 0.5 }));
    const bandB = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 1.2), bandA.material);
    group.add(box, bandA, bandB); group.position.copy(position); group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(position.x, 0.03, position.z);
    state.scene.add(group, shadow);
    this.crates.push({ group, shadow, velocity: 0, landed: false, life: 18, spin: Math.random() * 3, hp: 3 });
  }

  private updateCrates(dt: number) {
    const state = this.runtime();
    for (const crate of [...this.crates]) {
      crate.life -= dt; crate.spin += dt; crate.group.rotation.y += dt * (crate.landed ? 0.35 : 1.8);
      if (!crate.landed) {
        crate.velocity += 18 * dt; crate.group.position.y -= crate.velocity * dt;
        if (crate.group.position.y <= 0.62) {
          crate.group.position.y = 0.62;
          crate.landed = true;
          crate.velocity = 0;
          this.spawnPulse(crate.group.position, 0xd6ae47, 1.6);
          state.callbacks.onMessage('Roto Jet box landed — smash it open!');
        }
      } else {
        crate.group.position.y = 0.62 + Math.sin(crate.spin * 2) * 0.06;
      }
      if (crate.life <= 0) this.removeCrate(crate);
    }
  }

  private hitSupplyCrates(radius: number, damage: number) {
    const state = this.runtime();
    for (const crate of [...this.crates]) {
      if (!crate.landed || crate.group.position.distanceTo(state.player.position) > radius) continue;
      crate.hp -= damage;
      crate.group.rotation.z += (Math.random() - 0.5) * 0.28;
      crate.group.rotation.x += (Math.random() - 0.5) * 0.18;
      this.spawnPulse(crate.group.position, crate.hp > 0 ? 0xd6ae47 : 0xffd65a, crate.hp > 0 ? 0.85 : 1.65);
      if (crate.hp <= 0) {
        state.callbacks.onMessage('Roto Jet box broken!');
        this.collectCrate(crate);
      }
    }
  }

  private collectCrate(crate: SupplyCrate) {
    const state = this.runtime(); const roll = Math.random();
    if (roll < 0.38) { state.health = Math.min(state.character.maxHealth, state.health + 1); state.callbacks.onMessage('Roto Jet box: HEART +1'); this.spawnPulse(crate.group.position, 0xe84b57, 2.1); }
    else if (roll < 0.82) { const reward = 300 * Math.max(1, state.getMultiplier()); this.spawnStudBurst(crate.group.position.clone(), reward, 8); state.callbacks.onMessage(`Roto Jet box: ${reward.toLocaleString()} STUDS DROPPED`); this.spawnPulse(crate.group.position, 0xe5c04f, 2.1); }
    else if (roll < 0.93) { state.special = Math.min(100, state.special + 55); state.callbacks.onMessage('Roto Jet box: SPECIAL CHARGE +55'); this.spawnPulse(crate.group.position, 0x9267d2, 2.1); }
    else { this.startBoost(8, 1.28, 1.22); state.callbacks.onMessage('Roto Jet box: COMBAT BOOST 8s'); this.spawnPulse(crate.group.position, 0x6fd5ff, 2.1); }
    state.emitHud(); this.removeCrate(crate);
  }

  private removeCrate(crate: SupplyCrate) { const state = this.runtime(); state.scene.remove(crate.group, crate.shadow); const index = this.crates.indexOf(crate); if (index >= 0) this.crates.splice(index, 1); }

  private spawnSpeedEcho() {
    const state = this.runtime();
    const echo = state.player.clone(true);
    const clonedMaterials: THREE.Material[] = [];
    echo.traverse((object) => {
      if (object instanceof THREE.Light) object.visible = false;
      if (!(object instanceof THREE.Mesh)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const echoMaterials = sourceMaterials.map((source) => {
        const copy = source.clone();
        copy.transparent = true;
        copy.opacity = 0.18;
        copy.depthWrite = false;
        clonedMaterials.push(copy);
        return copy;
      });
      object.material = Array.isArray(object.material) ? echoMaterials : echoMaterials[0];
      object.castShadow = false;
      object.receiveShadow = false;
    });
    const backward = new THREE.Vector3(Math.sin(state.player.rotation.y), 0, Math.cos(state.player.rotation.y)).multiplyScalar(-0.38);
    echo.position.copy(state.player.position).add(backward);
    echo.rotation.copy(state.player.rotation);
    state.scene.add(echo);
    const start = performance.now();
    const animate = () => {
      if (this.contentDestroyed) {
        state.scene.remove(echo);
        clonedMaterials.forEach((entry) => entry.dispose());
        return;
      }
      const t = Math.min(1, (performance.now() - start) / 260);
      echo.position.addScaledVector(backward, 0.045);
      echo.scale.setScalar(1 + t * 0.055);
      clonedMaterials.forEach((entry) => { entry.opacity = 0.18 * (1 - t); });
      if (t >= 1) {
        state.scene.remove(echo);
        clonedMaterials.forEach((entry) => entry.dispose());
      } else requestAnimationFrame(animate);
    };
    animate();
  }

  private spawnPulse(origin: THREE.Vector3, color: number, maxRadius: number) {
    const state = this.runtime();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(origin).setY(0.06); ring.scale.setScalar(0.08); state.scene.add(ring);
    const start = performance.now();
    const animate = () => { if (this.contentDestroyed) { state.scene.remove(ring); return; } const t = Math.min(1, (performance.now() - start) / 450); ring.scale.setScalar(0.08 + t * maxRadius); (ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t); if (t >= 1) state.scene.remove(ring); else requestAnimationFrame(animate); };
    animate();
  }

  private spawnAirStrike(enemy: RuntimeEnemy, delaySeconds: number) {
    const state = this.runtime(); const target = enemy.mesh.position.clone();
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xf0b84b, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.copy(target).setY(0.04); state.scene.add(marker);
    window.setTimeout(() => { if (this.contentDestroyed || !state.enemies.includes(enemy)) { state.scene.remove(marker); return; } state.hitEnemy(enemy, state.character.damage * 1.75, 5.5, true); this.spawnPulse(target, 0xffcb5c, 2.8); state.scene.remove(marker); }, 420 + delaySeconds * 1000);
  }

  private spawnCloud(origin: THREE.Vector3) {
    const state = this.runtime(); const cloud = new THREE.Group();
    for (let i = 0; i < 14; i++) { const puff = new THREE.Mesh(new THREE.SphereGeometry(0.45 + Math.random() * 0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0x759d42, transparent: true, opacity: 0.34, roughness: 1 })); const angle = Math.random() * Math.PI * 2; const radius = Math.random() * 3.2; puff.position.set(Math.cos(angle) * radius, 0.3 + Math.random() * 1.4, Math.sin(angle) * radius); cloud.add(puff); }
    cloud.position.copy(origin); state.scene.add(cloud); const start = performance.now();
    const animate = () => { if (this.contentDestroyed) { state.scene.remove(cloud); return; } const t = (performance.now() - start) / 5200; cloud.rotation.y += 0.007; cloud.traverse((object) => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.34 * (1 - t)); }); if (t >= 1) state.scene.remove(cloud); else requestAnimationFrame(animate); };
    animate();
  }
}
