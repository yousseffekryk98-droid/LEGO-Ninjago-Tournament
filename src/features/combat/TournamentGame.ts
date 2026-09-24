import * as THREE from 'three';
import type { CharacterDef } from '../characters';
import { createCharacterModel } from '../characters/model';
import { createGenericFighterModel } from '../../shared/three/minifigure-model';
import { getKeyBindings, type KeyBindings } from '../controls';

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
  bossHealth?: number;
  bossMaxHealth?: number;
}

export interface GameCallbacks {
  onHud: (state: HudState) => void;
  onMessage: (message: string) => void;
  onGameOver: (score: number, wave: number) => void;
}

type AttackAction = 'attack' | 'punch' | 'kick';
type Action = AttackAction | 'jump' | 'grab' | 'special';
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

interface StudPickup {
  group: THREE.Group;
  value: number;
  velocity: THREE.Vector3;
  life: number;
  age: number;
}

const ARENA_RADIUS = 11.25;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class TournamentGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  private cameraBasePosition = new THREE.Vector3(13.4, 12.4, 15.2);
  private cameraShakeTime = 0;
  private cameraShakeStrength = 0;
  private hitStopTime = 0;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private player: THREE.Group;
  private playerShadow: THREE.Mesh;
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private boulders: Boulder[] = [];
  private shockwaves: Shockwave[] = [];
  private studPickups: StudPickup[] = [];
  private spikePositions: THREE.Vector3[] = [];
  private callbacks: GameCallbacks;
  private character: CharacterDef;
  private animationFrame = 0;
  private running = true;
  private paused = false;

  private input = { x: 0, y: 0, block: false };
  private keyboard = new Set<string>();
  private queuedActions = new Set<Action>();
  private bufferedAttackTime = 0;
  private bufferedAttackAction: AttackAction = 'attack';
  private keyBindings: KeyBindings = getKeyBindings();
  private combatMove: 'jab' | 'cross' | 'kick' | 'roundhouse' = 'jab';
  private combatMoveIndex = 0;
  private attackAnimationTime = 0;
  private attackAnimationDuration = 0.28;
  private unlimitedSpecial = false;

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
  private intermission = 1.8;
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

    this.scene.background = new THREE.Color(0x251a22);
    this.scene.fog = new THREE.FogExp2(0x251a22, 0.019);
    this.buildArena();

    this.player = createCharacterModel(character, 1);
    this.player.position.set(0, 0, 2.5);
    this.scene.add(this.player);

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    this.playerShadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), shadowMaterial);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.y = 0.015;
    this.scene.add(this.playerShadow);

    // The original mobile game used a readable diagonal arena view rather than
    // a near top-down camera. Keep the full ring visible while lowering the eye.
    this.camera.position.copy(this.cameraBasePosition);
    this.camera.lookAt(0, 0.85, -0.35);

    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('ninja-controls-updated', this.refreshControls);
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
    const isAttack = action === 'attack' || action === 'punch' || action === 'kick';
    if (isAttack && (this.attackCooldown > 0 || this.spinTime > 0 || this.dodgeTime > 0 || this.frozenTime > 0)) {
      this.bufferedAttackTime = 0.55;
      this.bufferedAttackAction = action;
      return;
    }
    this.queuedActions.add(action);
  }

  setUnlimitedSpecial(enabled: boolean) {
    this.unlimitedSpecial = enabled;
    if (enabled) {
      this.special = 100;
      this.emitHud();
    }
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

  continueRun() {
    if (this.health > 0) return false;
    this.health = this.character.maxHealth;
    this.paused = false;
    this.invulnerable = 2.2;
    this.combo = 0;
    this.special = Math.max(this.special, 35);
    this.frozenTime = 0;
    this.dodgeTime = 0;
    this.spinTime = 0;
    this.stopSpinjitzuVfx();
    this.player.position.set(0, 0, 2.5);
    this.player.rotation.set(0, 0, 0);
    this.clock.getDelta();
    this.emitHud();
    this.callbacks.onMessage('Continue! Back into the tournament.');
    return true;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.stopSpinjitzuVfx();
    for (const pickup of [...this.studPickups]) this.removeStudPickup(pickup);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('ninja-controls-updated', this.refreshControls);
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  private refreshControls = () => {
    this.keyBindings = getKeyBindings();
  };

  private keyDown = (event: KeyboardEvent) => {
    if (Object.values(this.keyBindings).includes(event.code) || ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)) event.preventDefault();
    this.keyboard.add(event.code);
    if (event.repeat) return;
    if (event.code === this.keyBindings.punch) this.action('punch');
    if (event.code === this.keyBindings.kick) this.action('kick');
    if (event.code === this.keyBindings.jump) this.action('jump');
    if (event.code === this.keyBindings.grab) this.action('grab');
    if (event.code === this.keyBindings.special) this.action('special');
    if (event.code === this.keyBindings.dodge) this.dodge(this.input.x, this.input.y);
    if (event.code === this.keyBindings.block) this.input.block = true;
  };

  private keyUp = (event: KeyboardEvent) => {
    this.keyboard.delete(event.code);
    if (event.code === this.keyBindings.block) this.input.block = false;
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
    if (!this.paused) {
      if (this.hitStopTime > 0) this.hitStopTime = Math.max(0, this.hitStopTime - dt);
      else this.update(dt);
    }
    this.updateCameraFeedback(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updateCameraFeedback(dt: number) {
    this.camera.position.copy(this.cameraBasePosition);
    if (this.cameraShakeTime > 0) {
      this.cameraShakeTime = Math.max(0, this.cameraShakeTime - dt);
      const fade = Math.min(1, this.cameraShakeTime / 0.1);
      const strength = this.cameraShakeStrength * fade;
      this.camera.position.x += (Math.random() - 0.5) * strength;
      this.camera.position.y += (Math.random() - 0.5) * strength * 0.55;
      this.camera.position.z += (Math.random() - 0.5) * strength;
    } else {
      this.cameraShakeStrength = 0;
    }
    this.camera.lookAt(0, 0.85, -0.35);
  }

  private addImpactFeedback(strength: number, freezeSeconds: number) {
    this.cameraShakeTime = Math.max(this.cameraShakeTime, 0.075 + strength * 0.025);
    this.cameraShakeStrength = Math.max(this.cameraShakeStrength, 0.12 + strength * 0.12);
    this.hitStopTime = Math.max(this.hitStopTime, freezeSeconds);
  }

  private update(dt: number) {
    this.elapsed += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.bufferedAttackTime = Math.max(0, this.bufferedAttackTime - dt);
    this.attackAnimationTime = Math.max(0, this.attackAnimationTime - dt);
    if (this.unlimitedSpecial && this.spinTime <= 0) this.special = 100;
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
    this.updateStudPickups(dt);
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
    if (this.keyboard.has(this.keyBindings.moveLeft) || this.keyboard.has('ArrowLeft')) x -= 1;
    if (this.keyboard.has(this.keyBindings.moveRight) || this.keyboard.has('ArrowRight')) x += 1;
    if (this.keyboard.has(this.keyBindings.moveUp) || this.keyboard.has('ArrowUp')) z -= 1;
    if (this.keyboard.has(this.keyBindings.moveDown) || this.keyboard.has('ArrowDown')) z += 1;

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
      this.player.rotation.y += dt * 24;
      this.invulnerable = Math.max(this.invulnerable, 0.14);

      if (move.lengthSq() > 0.01) {
        const spinSpeed = this.character.speed * 0.78;
        this.player.position.x += move.x * spinSpeed * dt;
        this.player.position.z += move.y * spinSpeed * dt;
      }

      this.updateSpinjitzuVfx(dt);
      if (this.spinTick <= 0) {
        this.spinTick = 0.12;
        for (const enemy of [...this.enemies]) {
          const distance = enemy.mesh.position.distanceTo(this.player.position);
          if (distance < 3.45) this.hitEnemy(enemy, this.character.damage * 0.82, 5.4, true);
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

    const potentialAura = this.player.getObjectByName('truePotentialAura');
    if (potentialAura) {
      potentialAura.rotation.z += dt * 2.4;
      const pulse = 1 + Math.sin(this.elapsed * 5.2) * 0.08;
      potentialAura.scale.setScalar(pulse);
    }
    const potentialLight = this.player.getObjectByName('truePotentialLight');
    if (potentialLight instanceof THREE.PointLight) {
      potentialLight.intensity = 1.6 + Math.sin(this.elapsed * 6.4) * 0.45;
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
      const queuedAttack: AttackAction | null = this.queuedActions.has('kick')
        ? 'kick'
        : this.queuedActions.has('punch')
          ? 'punch'
          : this.queuedActions.has('attack')
            ? 'attack'
            : null;
      const requestedAttack = queuedAttack ?? (this.bufferedAttackTime > 0 && this.attackCooldown <= 0 ? this.bufferedAttackAction : null);
      if (requestedAttack && this.performAttack(requestedAttack)) this.bufferedAttackTime = 0;
      if (this.queuedActions.has('jump')) this.performJump();
      if (this.queuedActions.has('grab')) this.performGrab();
      if (this.queuedActions.has('special')) this.performSpecial();
    }
    this.queuedActions.clear();
  }

  private performAttack(preferred: AttackAction = 'attack') {
    if (this.attackCooldown > 0 || this.spinTime > 0 || this.dodgeTime > 0) return false;
    if (!this.grounded) {
      this.jumpSlam = true;
      this.jumpVelocity = Math.min(this.jumpVelocity, -10.5);
      this.attackCooldown = 0.65;
      this.attackAnimationDuration = 0.65;
      this.attackAnimationTime = this.attackAnimationDuration;
      this.callbacks.onMessage('Jump slam!');
      return true;
    }

    const moves = [
      { name: 'jab' as const, duration: 0.24, damage: 0.82, range: 2.15, knockback: 2.4 },
      { name: 'cross' as const, duration: 0.28, damage: 1.0, range: 2.25, knockback: 3.2 },
      { name: 'kick' as const, duration: 0.36, damage: 1.18, range: 2.55, knockback: 4.8 },
      { name: 'roundhouse' as const, duration: 0.44, damage: 1.34, range: 2.72, knockback: 6.0 }
    ];
    const sequence = preferred === 'punch'
      ? moves.slice(0, 2)
      : preferred === 'kick'
        ? moves.slice(2)
        : moves;
    const move = sequence[this.combatMoveIndex % sequence.length];
    this.combatMoveIndex = (this.combatMoveIndex + 1) % 4;
    this.combatMove = move.name;
    const styleSpeed = this.character.style === 'speed' ? 0.84 : this.character.style === 'heavy' ? 1.14 : 1;
    this.attackCooldown = move.duration * styleSpeed;
    this.attackAnimationDuration = this.attackCooldown;
    this.attackAnimationTime = this.attackAnimationDuration;

    const forward = new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    let connected = false;
    for (const enemy of [...this.enemies]) {
      const toEnemy = enemy.mesh.position.clone().sub(this.player.position);
      const distance = toEnemy.length();
      if (distance <= move.range + (this.character.style === 'heavy' ? 0.18 : 0) && forward.dot(toEnemy.normalize()) > -0.12) {
        const before = enemy.hp;
        this.hitEnemy(enemy, this.character.damage * move.damage, move.knockback + (this.character.style === 'heavy' ? 1.1 : 0));
        connected ||= enemy.hp < before || !this.enemies.includes(enemy);
      }
    }
    if (!connected) this.combo = Math.max(0, this.combo - 1);
    return true;
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
      .filter((enemy) => enemy.kind !== 'boss' && enemy.mesh.userData.noGrab !== true && enemy.mesh.position.distanceTo(this.player.position) < 1.8)
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
    if ((!this.unlimitedSpecial && this.special < 100) || this.spinTime > 0 || !this.grounded || this.dodgeTime > 0) return;
    this.special = this.unlimitedSpecial ? 100 : 0;
    this.spinTime = 2.1;
    this.spinTick = 0;
    this.startSpinjitzuVfx();
    this.callbacks.onMessage(`${this.character.element} Spinjitzu!`);
  }

  private startSpinjitzuVfx() {
    this.stopSpinjitzuVfx();

    const aura = new THREE.Group();
    aura.name = 'spinjitzuAura';

    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 2.12, 3.05, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: this.character.color,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    funnel.position.y = 1.32;
    funnel.userData.spinRate = -3.5;
    aura.add(funnel);

    for (let band = 0; band < 3; band++) {
      const points: THREE.Vector3[] = [];
      for (let step = 0; step <= 34; step++) {
        const t = step / 34;
        const radius = 0.58 + t * 1.42;
        const angle = t * Math.PI * 5.4 + band * (Math.PI * 2 / 3);
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          0.12 + t * 2.85,
          Math.sin(angle) * radius
        ));
      }
      const spiral = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 54, 0.045, 7, false),
        new THREE.MeshBasicMaterial({
          color: band === 1 ? this.character.accent : this.character.color,
          transparent: true,
          opacity: band === 1 ? 0.86 : 0.68,
          depthWrite: false
        })
      );
      spiral.userData.spinRate = band % 2 ? 5.6 : -4.8;
      aura.add(spiral);
    }

    for (let i = 0; i < 6; i++) {
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
      ring.position.y = 0.26 + i * 0.43;
      ring.userData.spinRate = i % 2 === 0 ? 5.2 : -5.2;
      aura.add(ring);
    }

    for (let i = 0; i < 18; i++) {
      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.34 + (i % 3) * 0.08),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? this.character.color : this.character.accent,
          transparent: true,
          opacity: 0.78,
          depthWrite: false
        })
      );
      const angle = (i / 18) * Math.PI * 2;
      const radius = 0.9 + (i % 5) * 0.2;
      shard.position.set(Math.cos(angle) * radius, 0.22 + (i % 7) * 0.4, Math.sin(angle) * radius);
      shard.rotation.set(angle * 0.35, angle, angle * 0.6);
      shard.userData.spinRate = i % 2 === 0 ? 7.2 : -6.2;
      aura.add(shard);
    }

    const dust = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 2.35, 56),
      new THREE.MeshBasicMaterial({
        color: this.character.accent,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    dust.rotation.x = -Math.PI / 2;
    dust.position.y = 0.05;
    dust.userData.spinRate = 2.5;
    aura.add(dust);

    const glow = new THREE.PointLight(this.character.color, 3.6, 7.5, 2);
    glow.position.y = 1.35;
    aura.add(glow);

    aura.position.copy(this.player.position);
    this.scene.add(aura);
    this.spinAura = aura;
  }

  private updateSpinjitzuVfx(dt: number) {
    if (!this.spinAura) return;
    this.spinAura.position.copy(this.player.position);
    this.spinAura.rotation.y += dt * 10.8;
    const pulse = 1 + Math.sin(this.elapsed * 22) * 0.065;
    this.spinAura.scale.setScalar(pulse);

    this.spinAura.children.forEach((child, index) => {
      const rate = typeof child.userData.spinRate === 'number'
        ? child.userData.spinRate as number
        : (index % 2 === 0 ? 4.5 : -4.5);
      child.rotation.y += dt * rate;
      child.rotation.z += dt * rate * 0.45;
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
    const impactStrength = enemy.kind === 'boss' ? 1.25 : enemy.kind === 'heavy' ? 1.0 : 0.72;
    this.addImpactFeedback(impactStrength, force ? 0.055 : enemy.kind === 'heavy' ? 0.045 : 0.032);
    this.spawnHitSpark(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.25, 0)), enemy.kind === 'boss' ? 0xf2c55c : 0xffe0a0, impactStrength);
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
    this.special = clamp(this.special + (enemy.kind === 'boss' ? 35 : 12), 0, 100);

    const origin = enemy.mesh.position.clone();
    this.scene.remove(enemy.mesh);
    this.spawnBrickBurst(origin, enemy.kind === 'boss' ? 12 : 6);
    this.spawnStudBurst(origin, payout, enemy.kind === 'boss' ? 12 : enemy.kind === 'heavy' ? 7 : 5);
    if (enemy.kind === 'boss') this.callbacks.onMessage(`${enemy.bossName ?? 'Boss'} defeated! Collect the dropped studs.`);
  }

  private damagePlayer(amount: number) {
    if (this.invulnerable > 0 || this.spinTime > 0 || this.dodgeTime > 0) return;
    const blocked = this.input.block;
    const actual = blocked ? amount * 0.28 : amount;
    this.addImpactFeedback(blocked ? 0.45 : 1.05, blocked ? 0.018 : 0.052);
    this.spawnHitSpark(this.player.position.clone().add(new THREE.Vector3(0, 1.1, 0)), blocked ? 0x9fd5ff : 0xff684f, blocked ? 0.55 : 1.0);
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
    const enemyArchetype = kind === 'ranged' ? 'nindroid' : 'villain';
    const enemyWeapon = kind === 'heavy' ? 'scythe' : kind === 'ranged' ? 'staff' : 'katana';
    const mesh = createGenericFighterModel(colors[kind][0], colors[kind][1], scale, enemyArchetype, enemyWeapon);
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
    const side = Math.random() < 0.5 ? -1 : 1;
    const dragon = new THREE.Group();
    dragon.name = 'titaniumDragonEvent';

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xdcecf0,
      roughness: 0.32,
      metalness: 0.18,
      clearcoat: 0.45,
      clearcoatRoughness: 0.24
    });
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd9ff,
      emissive: 0x194f68,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.12,
      clearcoat: 0.55
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x42515b, roughness: 0.58, metalness: 0.22 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 2.2, 5, 12), bodyMat);
    body.rotation.z = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.58, 0.72), bodyMat);
    head.position.x = 1.65;
    const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 8), iceMat);
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.x = 2.28;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.0, 8), darkMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -2.05;
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 2.5), iceMat);
    leftWing.position.set(-0.15, 0.28, 1.35);
    leftWing.rotation.x = 0.34;
    const rightWing = leftWing.clone();
    rightWing.position.z = -1.35;
    rightWing.rotation.x = -0.34;
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), iceMat);
    leftEye.position.set(2.03, 0.13, 0.3);
    const rightEye = leftEye.clone();
    rightEye.position.z = -0.3;
    dragon.add(body, head, muzzle, tail, leftWing, rightWing, leftEye, rightEye);
    dragon.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });

    const startX = side * 17;
    const endX = -side * 17;
    dragon.position.set(startX, 5.4, -5.5 + Math.random() * 11);
    dragon.rotation.y = side > 0 ? Math.PI : 0;
    this.scene.add(dragon);
    this.callbacks.onMessage('Titanium Dragon incoming — watch for the freezing ice ball!');

    const started = this.elapsed;
    let fired = false;
    const animate = () => {
      if (!this.running) { this.scene.remove(dragon); return; }
      const t = clamp((this.elapsed - started) / 2.55, 0, 1);
      dragon.position.x = THREE.MathUtils.lerp(startX, endX, t);
      dragon.position.y = 5.4 + Math.sin(t * Math.PI) * 1.1;
      leftWing.rotation.x = 0.34 + Math.sin(this.elapsed * 12) * 0.26;
      rightWing.rotation.x = -0.34 - Math.sin(this.elapsed * 12) * 0.26;

      if (!fired && t >= 0.36) {
        fired = true;
        const origin = dragon.position.clone().add(new THREE.Vector3(side > 0 ? -1.6 : 1.6, -0.35, 0));
        const aim = this.player.position.clone().setY(0.75).sub(origin).normalize();
        this.spawnEnemyProjectile(origin, aim.multiplyScalar(8.8), 0.35, 0x84dbff, 'freeze');
      }

      if (t >= 1) this.scene.remove(dragon);
      else requestAnimationFrame(animate);
    };
    animate();
  }

  private spawnCondraiCrusherEvent() {
    if (this.enemies.length >= 13) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const crusher = new THREE.Group();
    crusher.name = 'condraiCrusherEvent';

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x742c43, roughness: 0.66, metalness: 0.12 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.72, metalness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xb68a32, roughness: 0.42, metalness: 0.48 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.25, 2.45), bodyMat);
    body.position.y = 0.95;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.25, 2.0), darkMat);
    cab.position.set(side > 0 ? -1.25 : 1.25, 1.65, 0);
    const ram = new THREE.Mesh(new THREE.ConeGeometry(0.64, 1.8, 8), goldMat);
    ram.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    ram.position.set(side > 0 ? -3.0 : 3.0, 0.95, 0);
    crusher.add(body, cab, ram);

    const wheels: THREE.Mesh[] = [];
    for (const x of [-1.55, 1.55]) {
      for (const z of [-1.15, 1.15]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.42, 14), darkMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.55, z);
        wheels.push(wheel);
        crusher.add(wheel);
      }
    }
    crusher.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });

    const startX = side * 17;
    const stopX = side * 9.2;
    crusher.position.set(startX, 0, -1.8 + Math.random() * 3.6);
    crusher.rotation.y = side > 0 ? 0 : Math.PI;
    this.scene.add(crusher);
    this.callbacks.onMessage('Condrai Crusher incoming — reinforcements on board!');

    const started = this.elapsed;
    let deployed = false;
    const animate = () => {
      if (!this.running) { this.scene.remove(crusher); return; }
      const elapsed = this.elapsed - started;
      const approach = clamp(elapsed / 1.15, 0, 1);
      const retreat = clamp((elapsed - 2.15) / 1.15, 0, 1);
      crusher.position.x = elapsed < 2.15
        ? THREE.MathUtils.lerp(startX, stopX, approach)
        : THREE.MathUtils.lerp(stopX, startX, retreat);
      for (const wheel of wheels) wheel.rotation.z += 0.22;

      if (!deployed && elapsed >= 1.25) {
        deployed = true;
        const count = Math.min(3, 13 - this.enemies.length);
        for (let i = 0; i < count; i++) {
          const spawnX = side * 8.5;
          const spawnZ = crusher.position.z + (i - 1) * 1.5;
          const enemy = this.createEnemy(i === 2 ? 'heavy' : 'melee', spawnX, spawnZ);
          enemy.mesh.userData.faction = 'anacondrai';
          this.enemies.push(enemy);
        }
        this.callbacks.onMessage('Condrai Crusher deployed Anacondrai reinforcements!');
      }

      if (elapsed >= 3.3) this.scene.remove(crusher);
      else requestAnimationFrame(animate);
    };
    animate();
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

  protected spawnStudBurst(origin: THREE.Vector3, totalValue: number, amount: number) {
    const safeAmount = Math.max(1, amount);
    const baseValue = Math.floor(totalValue / safeAmount);
    let remainder = totalValue - baseValue * safeAmount;

    for (let i = 0; i < safeAmount; i++) {
      const value = baseValue + (remainder-- > 0 ? 1 : 0);
      const group = new THREE.Group();
      group.name = 'studPickup';

      const gold = new THREE.MeshStandardMaterial({
        color: 0xf2c94c,
        emissive: 0x5b3a00,
        emissiveIntensity: 0.34,
        metalness: 0.72,
        roughness: 0.24
      });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 18), gold);
      base.rotation.x = Math.PI / 2;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.09, 16), gold);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = 0.085;
      base.castShadow = true;
      cap.castShadow = true;
      group.add(base, cap);

      const angle = (i / safeAmount) * Math.PI * 2 + Math.random() * 0.45;
      const speed = 1.6 + Math.random() * 2.4;
      group.position.copy(origin).add(new THREE.Vector3(0, 0.55 + Math.random() * 0.35, 0));
      group.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(group);

      this.studPickups.push({
        group,
        value,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 3.2 + Math.random() * 2.2, Math.sin(angle) * speed),
        life: 12,
        age: 0
      });
    }
  }

  private updateStudPickups(dt: number) {
    for (const pickup of [...this.studPickups]) {
      pickup.life -= dt;
      pickup.age += dt;
      pickup.velocity.y -= 8.5 * dt;
      pickup.group.position.addScaledVector(pickup.velocity, dt);

      if (pickup.group.position.y < 0.2) {
        pickup.group.position.y = 0.2;
        if (pickup.velocity.y < 0) pickup.velocity.y *= -0.42;
        pickup.velocity.x *= Math.pow(0.18, dt);
        pickup.velocity.z *= Math.pow(0.18, dt);
      }

      pickup.group.rotation.y += dt * 8.5;
      pickup.group.rotation.x += dt * 3.2;

      const toPlayer = this.player.position.clone().add(new THREE.Vector3(0, 0.7, 0)).sub(pickup.group.position);
      const distance = toPlayer.length();
      if (pickup.age > 0.3 && distance < 5.25) {
        const magnetSpeed = 4.6 + (5.25 - distance) * 3.4;
        pickup.group.position.addScaledVector(toPlayer.normalize(), magnetSpeed * dt);
      }

      if (distance < 0.72) {
        this.studs += pickup.value;
        this.removeStudPickup(pickup);
        continue;
      }

      if (pickup.life <= 0) this.removeStudPickup(pickup);
    }
  }

  private removeStudPickup(pickup: StudPickup) {
    const index = this.studPickups.indexOf(pickup);
    if (index >= 0) this.studPickups.splice(index, 1);
    this.scene.remove(pickup.group);
    pickup.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }

  private spawnHitSpark(origin: THREE.Vector3, color: number, strength: number) {
    const pieces: Array<{ mesh: THREE.Mesh; velocity: THREE.Vector3 }> = [];
    const amount = Math.max(4, Math.round(5 + strength * 4));
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });

    for (let i = 0; i < amount; i++) {
      const mesh = new THREE.Mesh(
        i % 3 === 0 ? new THREE.SphereGeometry(0.055, 6, 5) : new THREE.BoxGeometry(0.045, 0.045, 0.24 + Math.random() * 0.18),
        material.clone()
      );
      mesh.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.45));
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(mesh);
      pieces.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 6, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 6)
      });
    }

    const started = performance.now();
    let last = started;
    const animate = (now: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (now - last) / 1000));
      last = now;
      const t = Math.min(1, (now - started) / 280);
      for (const piece of pieces) {
        piece.velocity.y -= 12 * dt;
        piece.mesh.position.addScaledVector(piece.velocity, dt);
        piece.mesh.rotation.x += dt * 12;
        piece.mesh.rotation.z += dt * 9;
        (piece.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
      }
      if (!this.running || t >= 1) {
        for (const piece of pieces) {
          this.scene.remove(piece.mesh);
          piece.mesh.geometry.dispose();
          (piece.mesh.material as THREE.Material).dispose();
        }
        return;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  private spawnBrickBurst(origin: THREE.Vector3, amount: number) {
    const pieces: Array<{ mesh: THREE.Mesh; velocity: THREE.Vector3 }> = [];
    for (let i = 0; i < amount; i++) {
      const geometry: THREE.BufferGeometry = i % 5 === 0
        ? new THREE.CylinderGeometry(0.18, 0.18, 0.28, 10)
        : i % 5 === 1
          ? new THREE.BoxGeometry(0.28, 0.48, 0.24)
          : new THREE.BoxGeometry(0.18 + Math.random() * 0.18, 0.18, 0.18 + Math.random() * 0.25);
      const piece = new THREE.Mesh(
        geometry,
        new THREE.MeshPhysicalMaterial({
          color: i % 3 === 0 ? 0xd7aa3b : i % 3 === 1 ? 0x6e7178 : 0x7b2631,
          metalness: 0.04,
          roughness: 0.42,
          clearcoat: 0.42,
          clearcoatRoughness: 0.3
        })
      );
      piece.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.5 + Math.random(), (Math.random() - 0.5) * 1.2));
      piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      piece.castShadow = true;
      this.scene.add(piece);
      pieces.push({
        mesh: piece,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 5.5, 2.5 + Math.random() * 4.5, (Math.random() - 0.5) * 5.5)
      });
    }

    const started = performance.now();
    let last = started;
    const animate = (now: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (now - last) / 1000));
      last = now;
      const elapsed = (now - started) / 1000;
      for (const piece of pieces) {
        piece.velocity.y -= 12.5 * dt;
        piece.mesh.position.addScaledVector(piece.velocity, dt);
        if (piece.mesh.position.y < 0.16) {
          piece.mesh.position.y = 0.16;
          piece.velocity.y = Math.abs(piece.velocity.y) * 0.36;
          piece.velocity.x *= 0.72;
          piece.velocity.z *= 0.72;
        }
        piece.mesh.rotation.x += dt * 8;
        piece.mesh.rotation.z += dt * 10;
      }
      if (!this.running || elapsed >= 1.15) {
        for (const piece of pieces) {
          this.scene.remove(piece.mesh);
          piece.mesh.geometry.dispose();
          (piece.mesh.material as THREE.Material).dispose();
        }
        return;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
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
    key.shadow.bias = -0.00045;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x798dba, 1.25);
    rim.position.set(10, 8, -12);
    this.scene.add(rim);

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
    this.buildCenterSigil();

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

    this.buildArenaGate();
    this.buildSerpentPillar(-8.9, -8.4, 0.28);
    this.buildSerpentPillar(8.9, -8.4, -0.28);
    this.buildSerpentPillar(-9.7, 7.6, 0.2);
    this.buildSerpentPillar(9.7, 7.6, -0.2);

    this.buildGong(-10.7, 0);
    this.buildGong(10.7, 0);
    this.buildSpikeTrap(-4.4, -4.2);
    this.buildSpikeTrap(4.6, 4.0);

    for (const z of [-6.2, 6.2]) {
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x5b3420, roughness: 0.8 }));
      brazier.position.set(0, 0.4, z);
      brazier.castShadow = true;
      this.scene.add(brazier);
      const flameMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.62, 10),
        new THREE.MeshBasicMaterial({ color: 0xffa43b, transparent: true, opacity: 0.9 })
      );
      flameMesh.position.set(0, 1.2, z);
      this.scene.add(flameMesh);

      const flame = new THREE.PointLight(0xff7a2d, 4.8, 8.5, 2);
      flame.position.set(0, 1.5, z);
      this.scene.add(flame);
    }

    this.buildTournamentBackdrop();
  }

  private buildTournamentBackdrop() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x353238, roughness: 0.96 });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x242328, roughness: 0.98 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x4b2a20, roughness: 0.86 });
    const red = new THREE.MeshStandardMaterial({ color: 0x78252e, roughness: 0.72 });
    const purple = new THREE.MeshStandardMaterial({ color: 0x563365, roughness: 0.76 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xb8892e, roughness: 0.38, metalness: 0.48 });

    // Low stepped spectator terraces outside the playable ring.
    for (const side of [-1, 1] as const) {
      for (let level = 0; level < 3; level++) {
        const stand = new THREE.Mesh(
          new THREE.BoxGeometry(4.8 + level * 0.55, 0.55 + level * 0.16, 8.0),
          level % 2 ? darkStone : stone
        );
        stand.position.set(side * (14.1 + level * 0.45), 0.25 + level * 0.48, 0.6);
        stand.castShadow = true;
        stand.receiveShadow = true;
        this.scene.add(stand);
      }
    }

    // Abstract minifigure-sized crowd silhouettes: cheap geometry, strong depth.
    const crowdMaterial = new THREE.MeshStandardMaterial({ color: 0x18171b, roughness: 1 });
    for (const side of [-1, 1] as const) {
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 9; i++) {
          const spectator = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.26), crowdMaterial);
          body.position.y = 0.37;
          const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10), crowdMaterial);
          head.position.y = 0.72;
          spectator.add(body, head);
          spectator.position.set(
            side * (12.5 + row * 0.62),
            1.0 + row * 0.55,
            -4.4 + i * 1.08 + (row % 2) * 0.35
          );
          spectator.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          this.scene.add(spectator);
        }
      }
    }

    // Tournament banners echo the red/purple/gold architecture in reference footage.
    const bannerPoints: Array<[number, number, number, THREE.Material]> = [
      [-11.7, 4.0, -6.4, red],
      [11.7, 4.0, -6.4, purple],
      [-12.2, 4.1, 5.8, purple],
      [12.2, 4.1, 5.8, red]
    ];
    for (const [x, y, z, bannerMaterial] of bannerPoints) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.8, 10), timber);
      pole.position.set(x, y - 0.2, z);
      const banner = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.8, 0.08), bannerMaterial);
      banner.position.set(x, y, z);
      const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.65, 10), gold);
      topBar.rotation.z = Math.PI / 2;
      topBar.position.set(x, y + 1.45, z);
      const medallion = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.065, 8, 24), gold);
      medallion.position.set(x, y + 0.25, z + 0.08);
      for (const object of [pole, banner, topBar, medallion]) {
        object.castShadow = true;
        this.scene.add(object);
      }
    }

    // Chen's elevated viewing throne above the far gate.
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.42, 2.4), darkStone);
    balcony.position.set(0, 6.55, -12.25);
    balcony.castShadow = true;
    balcony.receiveShadow = true;
    this.scene.add(balcony);
    for (const x of [-2.25, -1.5, 1.5, 2.25]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.0, 10), gold);
      rail.position.set(x, 7.02, -11.42);
      rail.castShadow = true;
      this.scene.add(rail);
    }
    const throneBack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.05, 0.38), red);
    throneBack.position.set(0, 7.45, -12.12);
    const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.35, 1.05), gold);
    throneSeat.position.set(0, 6.76, -11.78);
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.09, 8, 28), gold);
    crest.position.set(0, 8.08, -11.88);
    for (const object of [throneBack, throneSeat, crest]) {
      object.castShadow = true;
      this.scene.add(object);
    }

    const chen = createGenericFighterModel(0x7b2631, 0xd3a84c, 0.78, 'villain', 'staff');
    chen.name = 'chenThroneSpectator';
    chen.position.set(0, 6.92, -11.52);
    chen.rotation.y = 0;
    this.scene.add(chen);

    for (const side of [-1, 1] as const) {
      const guard = createGenericFighterModel(0x342535, 0xb8892e, 0.7, 'villain', 'katana');
      guard.name = side < 0 ? 'chenGuardLeft' : 'chenGuardRight';
      guard.position.set(side * 1.65, 6.84, -11.62);
      guard.rotation.y = 0;
      this.scene.add(guard);
    }

    // More readable stone slab seams across the arena, without textures.
    const seam = new THREE.MeshBasicMaterial({
      color: 0x25282d,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });
    for (let ringIndex = 0; ringIndex < 4; ringIndex++) {
      const radius = 5.8 + ringIndex * 1.55;
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.055, 72), seam);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.072;
      this.scene.add(ring);
    }
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const seamBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 5.0), seam);
      seamBar.position.set(Math.cos(angle) * 7.6, 0.074, Math.sin(angle) * 7.6);
      seamBar.rotation.y = -angle;
      this.scene.add(seamBar);
    }
  }

  private buildCenterSigil() {
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0x24292f,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    for (const [innerRadius, outerRadius] of [[2.05, 2.18], [3.35, 3.49], [5.05, 5.17]] as const) {
      const circle = new THREE.Mesh(new THREE.RingGeometry(innerRadius, outerRadius, 64), lineMaterial);
      circle.rotation.x = -Math.PI / 2;
      circle.position.y = 0.065;
      this.scene.add(circle);
    }

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 2.45), lineMaterial);
      mark.position.set(Math.cos(angle) * 4.05, 0.067, Math.sin(angle) * 4.05);
      mark.rotation.y = -angle;
      this.scene.add(mark);
    }

    const crest = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 1.42, 6, 1, Math.PI / 6),
      new THREE.MeshBasicMaterial({
        color: 0x6d5030,
        transparent: true,
        opacity: 0.56,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    crest.rotation.x = -Math.PI / 2;
    crest.rotation.z = Math.PI / 6;
    crest.position.y = 0.071;
    this.scene.add(crest);
  }

  private buildArenaGate() {
    const stone = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.94 });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x292c31, roughness: 0.97 });
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x661e24, roughness: 0.72, metalness: 0.06 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xb8872c, roughness: 0.38, metalness: 0.52 });

    const z = -12.45;
    const leftTower = new THREE.Mesh(new THREE.BoxGeometry(2.3, 5.4, 2.1), stone);
    leftTower.position.set(-4.05, 2.4, z);
    const rightTower = leftTower.clone();
    rightTower.position.x = 4.05;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.3, 1.2, 2.25), darkStone);
    lintel.position.set(0, 5.0, z);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.38, 3.0), stone);
    roof.position.set(0, 5.78, z);
    roof.rotation.z = 0.015;

    for (const mesh of [leftTower, rightTower, lintel, roof]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(3.45, 4.3, 0.28), doorMaterial);
      door.position.set(side * 1.76, 2.12, z + 1.18);
      door.castShadow = true;
      door.receiveShadow = true;
      this.scene.add(door);

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 10), gold);
          stud.rotation.x = Math.PI / 2;
          stud.position.set(side * (0.72 + col * 0.55), 0.75 + row * 0.88, z + 1.36);
          this.scene.add(stud);
        }
      }
    }

    const crestRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.12, 10, 32), gold);
    crestRing.position.set(0, 5.0, z + 1.25);
    this.scene.add(crestRing);
    const crestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 18), doorMaterial);
    crestCore.rotation.x = Math.PI / 2;
    crestCore.position.set(0, 5.0, z + 1.25);
    this.scene.add(crestCore);
  }

  private buildSerpentPillar(x: number, z: number, lean: number) {
    const stone = new THREE.MeshStandardMaterial({ color: 0x35383e, roughness: 0.92 });
    const serpent = new THREE.MeshStandardMaterial({
      color: 0x612846,
      roughness: 0.58,
      metalness: 0.05
    });
    const gold = new THREE.MeshStandardMaterial({ color: 0xa97928, roughness: 0.38, metalness: 0.45 });

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 5.5, 14), stone);
    pillar.position.set(x, 2.45, z);
    pillar.rotation.z = lean * 0.12;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.scene.add(pillar);

    for (let i = 0; i < 5; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.81, 0.14, 8, 28), serpent);
      coil.position.set(x, 0.8 + i * 0.88, z);
      coil.rotation.x = Math.PI / 2 + lean;
      coil.rotation.z = i * 0.5;
      coil.castShadow = true;
      this.scene.add(coil);
    }

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 14), gold);
    crown.position.set(x, 5.25, z);
    crown.castShadow = true;
    this.scene.add(crown);
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
      bossName: boss?.bossName,
      bossHealth: boss ? Math.max(0, boss.hp) : undefined,
      bossMaxHealth: boss?.maxHp
    });
  }
}
