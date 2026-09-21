import * as THREE from 'three';
import type { CharacterDef } from './roster';

export interface HudState {
  health: number;
  maxHealth: number;
  studs: number;
  combo: number;
  multiplier: number;
  special: number;
  wave: number;
  enemies: number;
  bossName?: string;
}

export interface GameCallbacks {
  onHud: (state: HudState) => void;
  onMessage: (message: string) => void;
  onGameOver: (score: number, wave: number) => void;
}

type Action = 'attack' | 'jump' | 'grab' | 'special';
type EnemyKind = 'melee' | 'heavy' | 'ranged' | 'boss';
type ProjectileEffect = 'damage' | 'freeze';

interface Enemy {
  mesh: THREE.Group;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  specialCooldown: number;
  hiddenTime: number;
  knock: THREE.Vector3;
  bossName?: string;
  hitFlash: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
  effect: ProjectileEffect;
}

interface Boulder {
  marker: THREE.Mesh;
  rock: THREE.Mesh;
  delay: number;
  velocity: number;
  active: boolean;
}

interface Shockwave {
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  radius: number;
  speed: number;
  life: number;
  hit: boolean;
  damage: number;
}

const ARENA_RADIUS = 11.25;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class TournamentGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private player: THREE.Group;
  private playerShadow: THREE.Mesh;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private boulders: Boulder[] = [];
  private shockwaves: Shockwave[] = [];
  private spikePositions: THREE.Vector3[] = [];
  private callbacks: GameCallbacks;
  private character: CharacterDef;
  private animationFrame = 0;
  private running = true;
  private paused = false;

  private input = { x: 0, y: 0, block: false };
  private keyboard = new Set<string>();
  private queuedActions = new Set<Action>();

  private health: number;
  private studs = 0;
  private combo = 0;
  private special = 0;
  private wave = 0;
  private attackCooldown = 0;
  private invulnerable = 0;
  private jumpVelocity = 0;
  private grounded = true;
  private jumpSlam = false;
  private spinTime = 0;
  private spinTick = 0;
  private spinAura: THREE.Group | null = null;
  private dodgeTime = 0;
  private dodgeDirection = new THREE.Vector3();
  private frozenTime = 0;
  private spikeCooldown = 0;
  private intermission = 0.35;
  private hudTimer = 0;
  private eventTimer = 7;
  private elapsed = 0;
  private lastDamageAt = -999;

  constructor(private host: HTMLElement, character: CharacterDef, callbacks: GameCallbacks) {
    this.character = character;
    this.callbacks = callbacks;
    this.health = character.maxHealth;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x151520);
    this.scene.fog = new THREE.FogExp2(0x151520, 0.024);
    this.buildArena();

    this.player = this.createFighter(character.color, character.accent, 1);
    this.player.position.set(0, 0, 2.5);
    this.scene.add(this.player);

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    this.playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), shadowMaterial);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.y = 0.015;
    this.scene.add(this.playerShadow);

    this.camera.position.set(12.5, 15.5, 12.5);
    this.camera.lookAt(0, 0.7, 0);

    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    this.resize();
    this.callbacks.onMessage('Tournament begins! Survive the waves.');
    this.emitHud();
    this.loop();
  }

  setMove(x: number, y: number) {
    this.input.x = clamp(x, -1, 1);
    this.input.y = clamp(y, -1, 1);
  }

  setBlock(active: boolean) {
    this.input.block = active;
  }

  action(action: Action) {
    this.queuedActions.add(action);
  }

  dodge(x = 0, y = 0) {
    if (!this.grounded || this.spinTime > 0 || this.dodgeTime > 0 || this.frozenTime > 0) return;
    const direction = new THREE.Vector3(x, 0, y);
    if (direction.lengthSq() < 0.04) {
      direction.set(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    } else {
      direction.normalize();
    }
    this.dodgeDirection.copy(direction);
    this.player.rotation.y = Math.atan2(direction.x, direction.z);
    this.dodgeTime = 0.28;
    this.invulnerable = Math.max(this.invulnerable, 0.38);
    this.input.block = false;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.clock.getDelta();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.stopSpinjitzuVfx();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  private keyDown = (event: KeyboardEvent) => {
    this.keyboard.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'KeyJ') this.action('attack');
    if (event.code === 'KeyK') this.action('jump');
    if (event.code === 'KeyL') this.action('grab');
    if (event.code === 'KeyE') this.action('special');
    if (event.code === 'KeyQ') this.dodge(this.input.x, this.input.y);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.input.block = true;
  };

  private keyUp = (event: KeyboardEvent) => {
    this.keyboard.delete(event.code);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.input.block = false;
  };

  private resize = () => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private loop = () => {
    if (!this.running) return;
    this.animationFrame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.04);
    if (!this.paused) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.elapsed += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.frozenTime = Math.max(0, this.frozenTime - dt);
    this.spikeCooldown = Math.max(0, this.spikeCooldown - dt);
    this.hudTimer -= dt;
    this.intermission -= dt;
    this.eventTimer -= dt;

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateBoulders(dt);
    this.updateShockwaves(dt);
    this.updateSpikeHazards();

    if (this.enemies.length === 0 && this.intermission <= 0) {
      this.spawnWave();
      this.intermission = 1.4;
    }

    if (this.wave >= 2 && this.eventTimer <= 0 && this.enemies.length > 0) {
      this.triggerArenaEvent();
      this.eventTimer = Math.max(7.5, 14 - this.wave * 0.22) + Math.random() * 3;
    }

    if (this.combo > 0 && this.elapsed - this.lastDamageAt > 5.5 && this.attackCooldown <= 0) {
      if (Math.random() < dt * 0.35) this.combo = Math.max(0, this.combo - 1);
    }

    if (this.hudTimer <= 0) {
      this.emitHud();
      this.hudTimer = 0.08;
    }
  }

  private updatePlayer(dt: number) {
    let x = this.input.x;
    let z = this.input.y;
    if (this.keyboard.has('KeyA') || this.keyboard.has('ArrowLeft')) x -= 1;
    if (this.keyboard.has('KeyD') || this.keyboard.has('ArrowRight')) x += 1;
    if (this.keyboard.has('KeyW') || this.keyboard.has('ArrowUp')) z -= 1;
    if (this.keyboard.has('KeyS') || this.keyboard.has('ArrowDown')) z += 1;

    const move = new THREE.Vector2(x, z);
    if (move.lengthSq() > 1) move.normalize();

    if (this.frozenTime > 0) {
      this.player.rotation.z = Math.sin(this.elapsed * 20) * 0.03;
    } else if (this.dodgeTime > 0) {
      this.dodgeTime -= dt;
      this.player.position.addScaledVector(this.dodgeDirection, 12.5 * dt);
      this.player.rotation.z = Math.sin((0.28 - this.dodgeTime) * 18) * 0.22;
      this.invulnerable = Math.max(this.invulnerable, 0.12);
    } else if (this.spinTime > 0) {
      this.spinTime = Math.max(0, this.spinTime - dt);
      this.spinTick -= dt;
      this.player.rotation.y += dt * 18;
      this.invulnerable = Math.max(this.invulnerable, 0.12);
      this.updateSpinjitzuVfx(dt);
      if (this.spinTick <= 0) {
        this.spinTick = 0.16;
        for (const enemy of [...this.enemies]) {
          const distance = enemy.mesh.position.distanceTo(this.player.position);
          if (distance < 3.25) this.hitEnemy(enemy, this.character.damage * 0.9, 4.5, true);
        }
      }
      if (this.spinTime <= 0) this.stopSpinjitzuVfx();
    } else if (move.lengthSq() > 0.01) {
      const speed = this.character.speed * (this.input.block ? 0.5 : 1);
      this.player.position.x += move.x * speed * dt;
      this.player.position.z += move.y * speed * dt;
      this.player.rotation.y = Math.atan2(move.x, move.y);
      this.player.rotation.z = 0;
    } else {
      this.player.rotation.z *= Math.pow(0.02, dt);
    }

    const planar = new THREE.Vector2(this.player.position.x, this.player.position.z);
    if (planar.length() > ARENA_RADIUS) {
      planar.setLength(ARENA_RADIUS);
      this.player.position.x = planar.x;
      this.player.position.z = planar.y;
    }

    if (!this.grounded || this.jumpVelocity !== 0) {
      this.jumpVelocity -= 19 * dt;
      this.player.position.y += this.jumpVelocity * dt;
      if (this.player.position.y <= 0) {
        this.player.position.y = 0;
        this.jumpVelocity = 0;
        this.grounded = true;
        if (this.jumpSlam) this.landJumpSlam();
      }
    }

    this.playerShadow.position.x = this.player.position.x;
    this.playerShadow.position.z = this.player.position.z;
    (this.playerShadow.material as THREE.MeshBasicMaterial).opacity = clamp(0.3 - this.player.position.y * 0.05, 0.08, 0.3);

    if (this.frozenTime <= 0) {
      if (this.queuedActions.has('attack')) this.performAttack();
      if (this.queuedActions.has('jump')) this.performJump();
      if (this.queuedActions.has('grab')) this.performGrab();
      if (this.queuedActions.has('special')) this.performSpecial();
    }
    this.queuedActions.clear();
  }

  private performAttack() {
    if (this.attackCooldown > 0 || this.spinTime > 0 || this.dodgeTime > 0) return;
    if (!this.grounded) {
      this.jumpSlam = true;
      this.jumpVelocity = Math.min(this.jumpVelocity, -10.5);
      this.attackCooldown = 0.65;
      this.callbacks.onMessage('Jump slam!');
      return;
    }

    this.attackCooldown = this.character.style === 'speed' ? 0.24 : this.character.style === 'heavy' ? 0.48 : 0.34;
    const forward = new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    let connected = false;
    for (const enemy of [...this.enemies]) {
      const toEnemy = enemy.mesh.position.clone().sub(this.player.position);
      const distance = toEnemy.length();
      if (distance <= (this.character.style === 'heavy' ? 2.55 : 2.15) && forward.dot(toEnemy.normalize()) > -0.05) {
        const before = enemy.hp;
        this.hitEnemy(enemy, this.character.damage, this.character.style === 'heavy' ? 5.5 : 3.4);
        connected ||= enemy.hp < before || !this.enemies.includes(enemy);
      }
    }
    if (!connected) this.combo = Math.max(0, this.combo - 1);
  }

  private performJump() {
    if (!this.grounded || this.spinTime > 0 || this.dodgeTime > 0) return;
    this.grounded = false;
    this.jumpSlam = false;
    this.jumpVelocity = 7.2;
  }

  private landJumpSlam() {
    this.jumpSlam = false;
    this.invulnerable = Math.max(this.invulnerable, 0.22);
    const ring = this.makeRing(0xd6b044, 0.78);
    ring.position.copy(this.player.position).setY(0.04);
    ring.scale.setScalar(0.2);
    this.scene.add(ring);
    const started = this.elapsed;
    const animate = () => {
      if (!this.running || this.elapsed - started > 0.38) {
        this.scene.remove(ring);
        return;
      }
      const t = (this.elapsed - started) / 0.38;
      ring.scale.setScalar(0.2 + t * 3.8);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.78 * (1 - t);
      requestAnimationFrame(animate);
    };
    animate();

    for (const enemy of [...this.enemies]) {
      if (enemy.mesh.position.distanceTo(this.player.position) < 3.2) {
        enemy.hiddenTime = 0;
        this.setEnemyOpacity(enemy, 1);
        this.hitEnemy(enemy, this.character.damage * 1.35, 6.2, true);
      }
    }
  }

  private performGrab() {
    if (this.attackCooldown > 0 || this.spinTime > 0 || this.dodgeTime > 0 || !this.grounded) return;
    const candidates = this.enemies
      .filter((enemy) => enemy.kind !== 'boss' && enemy.mesh.position.distanceTo(this.player.position) < 1.8)
      .sort((a, b) => a.mesh.position.distanceTo(this.player.position) - b.mesh.position.distanceTo(this.player.position));
    const target = candidates[0];
    if (!target) return;
    this.attackCooldown = 0.65;
    const direction = target.mesh.position.clone().sub(this.player.position).setY(0).normalize();
    target.knock.copy(direction.multiplyScalar(11));
    this.hitEnemy(target, 8, 0);
    this.callbacks.onMessage('Throw! Aim enemies at the arena gongs.');
  }

  private performSpecial() {
    if (this.special < 100 || this.spinTime > 0 || !this.grounded || this.dodgeTime > 0) return;
    this.special = 0;
    this.spinTime = 1.65;
    this.spinTick = 0;
    this.startSpinjitzuVfx();
    this.callbacks.onMessage(`${this.character.element} Spinjitzu!`);
  }

  private startSpinjitzuVfx() {
    this.stopSpinjitzuVfx();

    const aura = new THREE.Group();
    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 1.95, 2.85, 36, 1, true),
      new THREE.MeshBasicMaterial({
        color: this.character.color,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    funnel.position.y = 1.25;
    aura.add(funnel);

    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.82 + i * 0.23, 0.045 + i * 0.006, 8, 44),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? this.character.accent : this.character.color,
          transparent: true,
          opacity: 0.72 - i * 0.08,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = i * 0.37;
      ring.position.y = 0.32 + i * 0.48;
      aura.add(ring);
    }

    for (let i = 0; i < 12; i++) {
      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.34 + (i % 3) * 0.08),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? this.character.color : this.character.accent,
          transparent: true,
          opacity: 0.78,
          depthWrite: false
        })
      );
      const angle = (i / 12) * Math.PI * 2;
      const radius = 1.05 + (i % 4) * 0.18;
      shard.position.set(Math.cos(angle) * radius, 0.35 + (i % 5) * 0.48, Math.sin(angle) * radius);
      shard.rotation.set(angle * 0.35, angle, angle * 0.6);
      aura.add(shard);
    }

    aura.position.copy(this.player.position);
    this.scene.add(aura);
    this.spinAura = aura;
  }

  private updateSpinjitzuVfx(dt: number) {
    if (!this.spinAura) return;
    this.spinAura.position.copy(this.player.position);
    this.spinAura.rotation.y += dt * 9.5;
    const pulse = 1 + Math.sin(this.elapsed * 20) * 0.055;
    this.spinAura.scale.setScalar(pulse);

    this.spinAura.children.forEach((child, index) => {
      if (index === 0) {
        child.rotation.y -= dt * 3.5;
        return;
      }
      child.rotation.z += dt * (index % 2 === 0 ? 4.5 : -4.5);
    });
  }

  private stopSpinjitzuVfx() {
    if (!this.spinAura) return;
    const aura = this.spinAura;
    this.spinAura = null;
    this.scene.remove(aura);
    aura.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }

  private hitEnemy(enemy: Enemy, damage: number, knockback: number, force = false) {
    if (enemy.bossName === 'Mr. Pale' && enemy.hiddenTime > 0 && !force) return;
    enemy.hp -= damage;
    enemy.hitFlash = 0.09;
    this.combo += 1;
    this.special = clamp(this.special + 7.5, 0, 100);
    if (knockback > 0) {
      const direction = enemy.mesh.position.clone().sub(this.player.position).setY(0).normalize();
      enemy.knock.add(direction.multiplyScalar(knockback));
    }
    if (enemy.hp <= 0) this.defeatEnemy(enemy);
  }

  private defeatEnemy(enemy: Enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index < 0) return;
    this.enemies.splice(index, 1);
    const multiplier = this.getMultiplier();
    const payout = (enemy.kind === 'boss' ? 500 : enemy.kind === 'heavy' ? 80 : enemy.kind === 'ranged' ? 60 : 45) * multiplier;
    this.studs += payout;
    this.special = clamp(this.special + (enemy.kind === 'boss' ? 35 : 12), 0, 100);

    const origin = enemy.mesh.position.clone();
    this.scene.remove(enemy.mesh);
    this.spawnBrickBurst(origin, enemy.kind === 'boss' ? 12 : 6);
    if (enemy.kind === 'boss') this.callbacks.onMessage(`${enemy.bossName ?? 'Boss'} defeated! +${payout.toLocaleString()} studs`);
  }

  private damagePlayer(amount: number) {
    if (this.invulnerable > 0 || this.spinTime > 0 || this.dodgeTime > 0) return;
    const blocked = this.input.block;
    const actual = blocked ? amount * 0.28 : amount;
    this.health = Math.max(0, this.health - actual);
    this.invulnerable = blocked ? 0.25 : 0.7;
    this.combo = 0;
    this.lastDamageAt = this.elapsed;
    if (!blocked) this.callbacks.onMessage('Hit! Your combo multiplier reset.');
    if (this.health <= 0) {
      this.paused = true;
      this.emitHud();
      setTimeout(() => this.callbacks.onGameOver(this.studs, this.wave), 500);
    }
  }

  private updateEnemies(dt: number) {
    const playerPos = this.player.position;
    for (const enemy of [...this.enemies]) {
      enemy.attackCooldown -= dt;
      enemy.specialCooldown -= dt;
      enemy.hitFlash -= dt;
      if (enemy.hiddenTime > 0) {
        enemy.hiddenTime -= dt;
        if (enemy.hiddenTime <= 0) this.setEnemyOpacity(enemy, 1);
      }

      enemy.mesh.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const material = object.material as THREE.MeshStandardMaterial;
        if (!material.emissive) return;
        material.emissive.setHex(enemy.hitFlash > 0 ? 0x67241d : 0x000000);
      });

      if (enemy.kind === 'boss' && enemy.specialCooldown <= 0) {
        this.performBossSpecial(enemy);
      }

      if (enemy.knock.lengthSq() > 0.02) {
        enemy.mesh.position.addScaledVector(enemy.knock, dt);
        enemy.knock.multiplyScalar(Math.pow(0.045, dt));
      } else {
        enemy.knock.set(0, 0, 0);
        const toPlayer = playerPos.clone().sub(enemy.mesh.position).setY(0);
        const distance = toPlayer.length();
        if (distance > 0.001) enemy.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        const hiddenSpeedBoost = enemy.hiddenTime > 0 ? 1.35 : 1;

        if (enemy.kind === 'ranged') {
          if (distance > 6) enemy.mesh.position.addScaledVector(toPlayer.normalize(), enemy.speed * hiddenSpeedBoost * dt);
          else if (distance < 4) enemy.mesh.position.addScaledVector(toPlayer.normalize(), -enemy.speed * 0.55 * dt);
          else if (enemy.attackCooldown <= 0) {
            this.fireProjectile(enemy);
            enemy.attackCooldown = 1.65 + Math.random() * 0.45;
          }
        } else if (distance > 1.45) {
          enemy.mesh.position.addScaledVector(toPlayer.normalize(), enemy.speed * hiddenSpeedBoost * dt);
        } else if (enemy.attackCooldown <= 0) {
          this.damagePlayer(enemy.damage);
          enemy.attackCooldown = enemy.kind === 'heavy' || enemy.kind === 'boss' ? 1.25 : 0.8;
        }
      }

      const planar = new THREE.Vector2(enemy.mesh.position.x, enemy.mesh.position.z);
      if (planar.length() > ARENA_RADIUS + 0.25) {
        planar.setLength(ARENA_RADIUS + 0.25);
        enemy.mesh.position.x = planar.x;
        enemy.mesh.position.z = planar.y;
      }

      if (Math.abs(enemy.mesh.position.x) > 9.35 && Math.abs(enemy.mesh.position.z) < 1.75 && enemy.knock.length() > 1.5) {
        this.defeatEnemy(enemy);
        this.callbacks.onMessage('GONG KO! Instant arena knockout.');
      }
    }
  }

  private performBossSpecial(enemy: Enemy) {
    const name = enemy.bossName ?? '';
    enemy.specialCooldown = 5 + Math.random() * 2.5;
    const toPlayer = this.player.position.clone().sub(enemy.mesh.position).setY(0);

    if (name === 'Karlof') {
      this.spawnShockwave(enemy.mesh.position, 7.6, 1.35);
      this.callbacks.onMessage('Karlof: METAL TREMOR! Jump or dodge the ring.');
      return;
    }

    if (name === 'Ash') {
      const behind = new THREE.Vector3(-Math.sin(this.player.rotation.y), 0, -Math.cos(this.player.rotation.y)).multiplyScalar(2.1);
      enemy.mesh.position.copy(this.player.position).add(behind);
      enemy.attackCooldown = 0.25;
      this.callbacks.onMessage('Ash vanished into smoke!');
      return;
    }

    if (name === 'Mr. Pale') {
      enemy.hiddenTime = 2.2;
      this.setEnemyOpacity(enemy, 0.12);
      this.callbacks.onMessage('Mr. Pale is invisible — jump slam reveals him!');
      return;
    }

    if (name === 'Neuro') {
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        this.spawnEnemyProjectile(enemy.mesh.position, new THREE.Vector3(Math.cos(angle), 0.04, Math.sin(angle)).multiplyScalar(6.7), enemy.damage * 0.72, 0x7a5ce5);
      }
      this.callbacks.onMessage('Neuro: MIND BURST!');
      return;
    }

    if (name === 'Griffin Turner') {
      if (toPlayer.lengthSq() > 0.01) enemy.knock.add(toPlayer.normalize().multiplyScalar(12));
      enemy.attackCooldown = 0.15;
      this.callbacks.onMessage('Griffin Turner: SPEED CHARGE!');
      return;
    }

    if (name === 'Master Chen') {
      const support = Math.min(2, Math.max(0, 12 - this.enemies.length));
      for (let i = 0; i < support; i++) {
        const angle = Math.random() * Math.PI * 2;
        this.enemies.push(this.createEnemy(i % 2 ? 'ranged' : 'melee', Math.cos(angle) * 8.8, Math.sin(angle) * 8.8));
      }
      this.callbacks.onMessage('Master Chen calls reinforcements!');
      return;
    }

    if (name === 'Ronin') {
      this.spawnEnemyProjectile(enemy.mesh.position, toPlayer.normalize().multiplyScalar(10), 1.05, 0xd6a24d);
      this.callbacks.onMessage('Ronin: AIR STRIKE!');
      return;
    }

    this.spawnShockwave(enemy.mesh.position, 6.5, 1.0);
  }

  private setEnemyOpacity(enemy: Enemy, opacity: number) {
    enemy.mesh.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      material.transparent = opacity < 1;
      material.opacity = opacity;
      material.depthWrite = opacity >= 1;
    });
  }

  private fireProjectile(enemy: Enemy) {
    const origin = enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0));
    const velocity = this.player.position.clone().add(new THREE.Vector3(0, 0.7, 0)).sub(origin).normalize().multiplyScalar(8.2);
    this.spawnEnemyProjectile(origin, velocity, enemy.damage * 0.8, 0xe2552f);
  }

  private spawnEnemyProjectile(origin: THREE.Vector3, velocity: THREE.Vector3, damage: number, color: number, effect: ProjectileEffect = 'damage') {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(effect === 'freeze' ? 0.42 : 0.19, 14, 10),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: effect === 'freeze' ? 1.7 : 1.1, roughness: 0.42 })
    );
    mesh.position.copy(origin);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.projectiles.push({ mesh, velocity, life: 4, damage, effect });
  }

  private updateProjectiles(dt: number) {
    for (const projectile of [...this.projectiles]) {
      projectile.life -= dt;
      projectile.mesh.position.addScaledVector(projectile.velocity, dt);
      if (projectile.mesh.position.distanceTo(this.player.position.clone().add(new THREE.Vector3(0, 0.8, 0))) < (projectile.effect === 'freeze' ? 0.95 : 0.75)) {
        this.damagePlayer(projectile.damage);
        if (projectile.effect === 'freeze' && this.invulnerable <= 0.7) {
          this.frozenTime = Math.max(this.frozenTime, 1.15);
          this.callbacks.onMessage('Frozen! Break free and keep moving.');
        }
        projectile.life = 0;
      }
      if (projectile.life <= 0 || projectile.mesh.position.length() > 32) {
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
      }
    }
  }

  private spawnWave() {
    this.wave += 1;
    const isBossWave = this.wave % 5 === 0;
    if (isBossWave) {
      const bosses = ['Karlof', 'Ash', 'Mr. Pale', 'Neuro', 'Griffin Turner', 'Master Chen', 'Ronin'];
      const bossName = bosses[Math.floor((this.wave / 5 - 1) % bosses.length)];
      this.enemies.push(this.createEnemy('boss', 0, -7.2, bossName));
      const supportCount = Math.min(4, Math.floor(this.wave / 5));
      for (let i = 0; i < supportCount; i++) {
        const angle = (i / Math.max(1, supportCount)) * Math.PI * 2;
        this.enemies.push(this.createEnemy(i % 2 ? 'ranged' : 'melee', Math.cos(angle) * 7.8, Math.sin(angle) * 7.8));
      }
      this.callbacks.onMessage(`BOSS WAVE ${this.wave}: ${bossName}`);
    } else {
      const count = Math.min(12, 2 + this.wave);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
        const radius = 7.3 + Math.random() * 2.4;
        const roll = Math.random();
        const kind: EnemyKind = this.wave < 2 ? 'melee' : roll > 0.78 ? 'ranged' : roll > 0.56 ? 'heavy' : 'melee';
        this.enemies.push(this.createEnemy(kind, Math.cos(angle) * radius, Math.sin(angle) * radius));
      }
      this.callbacks.onMessage(`Wave ${this.wave}`);
    }
    this.emitHud();
  }

  private createEnemy(kind: EnemyKind, x: number, z: number, bossName?: string): Enemy {
    const colors: Record<EnemyKind, [number, number]> = {
      melee: [0x4b262c, 0x899097],
      heavy: [0x30353b, 0xb84d36],
      ranged: [0x27365b, 0xd3aa58],
      boss: [0x7a261f, 0xd7a841]
    };
    const scale = kind === 'boss' ? 1.28 : kind === 'heavy' ? 1.12 : 1;
    const mesh = this.createFighter(colors[kind][0], colors[kind][1], scale);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const waveScale = 1 + this.wave * 0.065;
    const maxHp = (kind === 'boss' ? 230 : kind === 'heavy' ? 75 : 42) * waveScale;
    return {
      mesh,
      kind,
      hp: maxHp,
      maxHp,
      speed: (kind === 'heavy' ? 2.1 : kind === 'ranged' ? 2.6 : kind === 'boss' ? 2.45 : 3.0) + Math.min(1.2, this.wave * 0.035),
      damage: kind === 'boss' ? 1.15 : kind === 'heavy' ? 0.82 : 0.58,
      attackCooldown: 0.5 + Math.random(),
      specialCooldown: kind === 'boss' ? 3.8 + Math.random() * 2 : 999,
      hiddenTime: 0,
      knock: new THREE.Vector3(),
      bossName,
      hitFlash: 0
    };
  }

  private triggerArenaEvent() {
    const roll = Math.random();
    if (roll < 0.48) this.spawnBoulderEvent();
    else if (roll < 0.78) this.spawnTitaniumDragonEvent();
    else this.spawnCondraiCrusherEvent();
  }

  private spawnBoulderEvent() {
    const count = Math.min(4, 1 + Math.floor(this.wave / 4));
    for (let i = 0; i < count; i++) {
      const target = this.player.position.clone();
      target.x += (Math.random() - 0.5) * 5;
      target.z += (Math.random() - 0.5) * 5;
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(0.65, 1.05, 32),
        new THREE.MeshBasicMaterial({ color: 0xe84b3c, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(target.x, 0.025, target.z);
      this.scene.add(marker);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: 0x3f3f43, roughness: 0.92 }));
      rock.position.set(target.x, 12 + i * 1.5, target.z);
      rock.castShadow = true;
      this.scene.add(rock);
      this.boulders.push({ marker, rock, delay: 1.15 + i * 0.15, velocity: 0, active: false });
    }
    this.callbacks.onMessage('Boulder Basher! Move away from the red targets.');
  }

  private spawnTitaniumDragonEvent() {
    const angle = Math.random() * Math.PI * 2;
    const start = new THREE.Vector3(Math.cos(angle) * 13.5, 1.0, Math.sin(angle) * 13.5);
    const aim = this.player.position.clone().setY(0.75).sub(start).normalize();
    this.spawnEnemyProjectile(start, aim.multiplyScalar(8.5), 0.35, 0x84dbff, 'freeze');
    this.callbacks.onMessage('Titanium Dragon! Dodge the freezing ice ball.');
  }

  private spawnCondraiCrusherEvent() {
    if (this.enemies.length >= 13) return;
    const count = Math.min(3, 13 - this.enemies.length);
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      this.enemies.push(this.createEnemy(i === 2 ? 'heavy' : 'melee', side * 9.4, (i - 1) * 2.6));
    }
    this.callbacks.onMessage('Condrai Crusher incoming — reinforcements deployed!');
  }

  private updateBoulders(dt: number) {
    for (const boulder of [...this.boulders]) {
      boulder.delay -= dt;
      const markerMaterial = boulder.marker.material as THREE.MeshBasicMaterial;
      markerMaterial.opacity = 0.45 + Math.sin(this.elapsed * 12) * 0.25;
      if (boulder.delay <= 0) boulder.active = true;
      if (boulder.active) {
        boulder.velocity += 26 * dt;
        boulder.rock.position.y -= boulder.velocity * dt;
        boulder.rock.rotation.x += dt * 4;
        boulder.rock.rotation.z += dt * 2.5;
        if (boulder.rock.position.y <= 0.7) {
          if (boulder.rock.position.distanceTo(this.player.position) < 1.65) this.damagePlayer(1.35);
          for (const enemy of [...this.enemies]) {
            if (boulder.rock.position.distanceTo(enemy.mesh.position) < 1.7) this.hitEnemy(enemy, 55, 6, true);
          }
          this.scene.remove(boulder.marker, boulder.rock);
          this.boulders.splice(this.boulders.indexOf(boulder), 1);
        }
      }
    }
  }

  private spawnShockwave(origin: THREE.Vector3, speed: number, damage: number) {
    const mesh = this.makeRing(0xd3a94d, 0.78);
    mesh.position.copy(origin).setY(0.05);
    mesh.scale.setScalar(0.1);
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, origin: origin.clone(), radius: 0.1, speed, life: 1.25, hit: false, damage });
  }

  private updateShockwaves(dt: number) {
    for (const wave of [...this.shockwaves]) {
      wave.life -= dt;
      wave.radius += wave.speed * dt;
      wave.mesh.scale.setScalar(wave.radius);
      const material = wave.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = clamp(wave.life, 0, 0.78);
      const playerDistance = new THREE.Vector2(this.player.position.x - wave.origin.x, this.player.position.z - wave.origin.z).length();
      if (!wave.hit && this.player.position.y < 0.42 && Math.abs(playerDistance - wave.radius) < 0.55) {
        wave.hit = true;
        this.damagePlayer(wave.damage);
      }
      if (wave.life <= 0) {
        this.scene.remove(wave.mesh);
        this.shockwaves.splice(this.shockwaves.indexOf(wave), 1);
      }
    }
  }

  private updateSpikeHazards() {
    if (this.spikeCooldown > 0 || !this.grounded) return;
    for (const spike of this.spikePositions) {
      if (spike.distanceTo(this.player.position) < 0.95) {
        this.spikeCooldown = 1.15;
        this.damagePlayer(0.55);
        break;
      }
    }
  }

  private spawnBrickBurst(origin: THREE.Vector3, amount: number) {
    for (let i = 0; i < amount; i++) {
      const piece = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 + Math.random() * 0.18, 0.18, 0.18 + Math.random() * 0.25),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd7aa3b : 0x6e7178, metalness: 0.05, roughness: 0.75 })
      );
      piece.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.2 + Math.random(), (Math.random() - 0.5) * 1.2));
      piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(piece);
      const start = this.elapsed;
      const cleanup = () => {
        if (!this.running || this.elapsed - start > 0.75) {
          this.scene.remove(piece);
          return;
        }
        piece.position.y += 0.015;
        piece.rotation.x += 0.08;
        requestAnimationFrame(cleanup);
      };
      cleanup();
    }
  }

  private buildArena() {
    const hemi = new THREE.HemisphereLight(0xb9d7ff, 0x241c18, 1.45);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffe1b5, 3.2);
    key.position.set(-8, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -15;
    key.shadow.camera.right = 15;
    key.shadow.camera.top = 15;
    key.shadow.camera.bottom = -15;
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(12.4, 12.4, 0.55, 64),
      new THREE.MeshStandardMaterial({ color: 0x4d535b, roughness: 0.93, metalness: 0.02 })
    );
    floor.receiveShadow = true;
    floor.position.y = -0.3;
    this.scene.add(floor);

    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(8.3, 8.3, 0.04, 64),
      new THREE.MeshStandardMaterial({ color: 0x3f464d, roughness: 0.88 })
    );
    inner.position.y = 0.01;
    inner.receiveShadow = true;
    this.scene.add(inner);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7.9, 8.2, 64),
      new THREE.MeshBasicMaterial({ color: 0x242b31, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.scene.add(ring);

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = i % 2 ? 9.7 : 10.4;
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.08, 1.25),
        new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x555c63 : 0x474e55, roughness: 0.95 })
      );
      tile.position.set(Math.cos(angle) * radius, 0.04, Math.sin(angle) * radius);
      tile.rotation.y = -angle;
      tile.receiveShadow = true;
      this.scene.add(tile);
    }

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x34383e, roughness: 0.96 });
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      if (Math.abs(Math.cos(angle)) > 0.9 && Math.abs(Math.sin(angle)) < 0.32) continue;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.5 + Math.random() * 1.1, 0.65), wallMaterial);
      wall.position.set(Math.cos(angle) * 13.2, 1.1, Math.sin(angle) * 13.2);
      wall.rotation.y = -angle + Math.PI / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    }

    this.buildGong(-10.7, 0);
    this.buildGong(10.7, 0);
    this.buildSpikeTrap(-4.4, -4.2);
    this.buildSpikeTrap(4.6, 4.0);

    for (const z of [-6.2, 6.2]) {
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x5b3420, roughness: 0.8 }));
      brazier.position.set(0, 0.4, z);
      brazier.castShadow = true;
      this.scene.add(brazier);
      const flame = new THREE.PointLight(0xff7a2d, 4, 7, 2);
      flame.position.set(0, 1.5, z);
      this.scene.add(flame);
    }
  }

  private buildGong(x: number, z: number) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 0.84 });
    const gongMat = new THREE.MeshStandardMaterial({ color: 0xb38431, roughness: 0.35, metalness: 0.55 });
    for (const dx of [-0.9, 0.9]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), frameMat);
      post.position.set(x + (x < 0 ? dx : -dx), 1.7, z + dx * 0.04);
      post.castShadow = true;
      this.scene.add(post);
    }
    const gong = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 32), gongMat);
    gong.rotation.z = Math.PI / 2;
    gong.position.set(x, 1.75, z);
    gong.castShadow = true;
    this.scene.add(gong);
  }

  private buildSpikeTrap(x: number, z: number) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x292d31, roughness: 0.9 }));
    base.position.set(x, 0.045, z);
    base.receiveShadow = true;
    this.scene.add(base);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52, 8), new THREE.MeshStandardMaterial({ color: 0x85898d, metalness: 0.45, roughness: 0.42 }));
      spike.position.set(x + Math.cos(angle) * 0.5, 0.28, z + Math.sin(angle) * 0.5);
      spike.castShadow = true;
      this.scene.add(spike);
    }
    this.spikePositions.push(new THREE.Vector3(x, 0, z));
  }

  private makeRing(color: number, opacity: number) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  private createFighter(primary: number, accent: number, scale: number) {
    const group = new THREE.Group();
    const primaryMat = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.62 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.54 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf2c64f, roughness: 0.58 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.72 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.92, 0.48), primaryMat);
    torso.position.y = 1.28;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.16, 0.52), accentMat);
    belt.position.y = 0.88;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.48, 16), skinMat);
    head.position.y = 2.0;
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.5), primaryMat);
    mask.position.set(0, 2.03, 0.02);
    const eyeBand = new THREE.Mesh(new THREE.BoxGeometry(0.73, 0.12, 0.52), darkMat);
    eyeBand.position.set(0, 2.1, 0.01);
    const legGeo = new THREE.BoxGeometry(0.32, 0.72, 0.42);
    const armGeo = new THREE.BoxGeometry(0.22, 0.72, 0.24);
    const leftLeg = new THREE.Mesh(legGeo, primaryMat);
    const rightLeg = new THREE.Mesh(legGeo, primaryMat);
    leftLeg.position.set(-0.23, 0.45, 0);
    rightLeg.position.set(0.23, 0.45, 0);
    const leftArm = new THREE.Mesh(armGeo, primaryMat);
    const rightArm = new THREE.Mesh(armGeo, primaryMat);
    leftArm.position.set(-0.58, 1.3, 0);
    rightArm.position.set(0.58, 1.3, 0);
    leftArm.rotation.z = -0.22;
    rightArm.rotation.z = 0.22;
    const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.35, 0.12), accentMat);
    weapon.position.set(0.79, 1.35, 0.18);
    weapon.rotation.z = -0.45;
    weapon.rotation.x = 0.15;

    for (const mesh of [torso, belt, head, mask, eyeBand, leftLeg, rightLeg, leftArm, rightArm, weapon]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    group.scale.setScalar(scale);
    return group;
  }

  private getMultiplier() {
    if (this.combo < 5) return 1;
    if (this.combo < 12) return 2;
    if (this.combo < 25) return 4;
    if (this.combo < 45) return 8;
    if (this.combo < 70) return 16;
    if (this.combo < 100) return 32;
    return 100;
  }

  private emitHud() {
    const boss = this.enemies.find((enemy) => enemy.kind === 'boss');
    this.callbacks.onHud({
      health: Math.ceil(this.health),
      maxHealth: this.character.maxHealth,
      studs: this.studs,
      combo: this.combo,
      multiplier: this.getMultiplier(),
      special: this.special,
      wave: this.wave,
      enemies: this.enemies.length,
      bossName: boss?.bossName
    });
  }
}
