import * as THREE from 'three';
import { getElementCombatTheme, ROSTER, type CharacterDef } from '../characters';
import { createCharacterModel } from '../characters/model';
import { createGenericFighterModel } from '../../shared/three/minifigure-model';
import { getKeyBindings, type KeyBindings } from '../controls';
import { ArenaHazardManager } from './arena-hazards';
import { ElementVfxSystem } from './element-vfx';
import { buildTournamentFloorDetails } from './arena-floor';

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
  bossColor?: number;
  bossAccent?: number;
  bossElement?: string;
  bossId?: string;
}

export interface GameCallbacks {
  onHud: (state: HudState) => void;
  onMessage: (message: string) => void;
  onGameOver: (score: number, wave: number) => void;
  onVictory?: (score: number, fights: number) => void;
  onCameraModeChange?: (mode: CameraMode) => void;
}

export interface TournamentGameOptions {
  bossRush?: boolean;
}

type AttackAction = 'attack' | 'punch' | 'kick';
type Action = AttackAction | 'jump' | 'grab' | 'special' | 'ultimate';
export type CameraMode = 'classic' | 'overhead';
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
  bossCharacter?: CharacterDef;
  bossSpinTime: number;
  bossSpinHitCooldown: number;
  specialCount: number;
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

interface HealthPickup {
  group: THREE.Group;
  amount: number;
  velocity: THREE.Vector3;
  life: number;
  age: number;
}

const ARENA_RADIUS = 43.5;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class TournamentGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 230);
  private cameraBasePosition = new THREE.Vector3(21.5, 18.2, 24.0);
  private cameraTarget = new THREE.Vector3(0, 0.85, -0.35);
  private cameraMode: CameraMode = 'classic';
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
  private healthPickups: HealthPickup[] = [];
  private hazards!: ArenaHazardManager;
  private elementVfx!: ElementVfxSystem;
  private callbacks: GameCallbacks;
  private character: CharacterDef;
  private bossRush: boolean;
  private victorySent = false;
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
  private spinImpactVfxCooldown = 0;
  private spinAura: THREE.Group | null = null;
  private dodgeTime = 0;
  private dodgeDirection = new THREE.Vector3();
  private frozenTime = 0;
  private pitFallActive = false;
  private intermission = 1.8;
  private hudTimer = 0;
  private eventTimer = 7;
  private elapsed = 0;
  private lastDamageAt = -999;

  constructor(private host: HTMLElement, character: CharacterDef, callbacks: GameCallbacks, options: TournamentGameOptions = {}) {
    this.character = character;
    this.callbacks = callbacks;
    this.bossRush = Boolean(options.bossRush);
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
    this.scene.fog = new THREE.FogExp2(0x251a22, 0.0135);
    this.buildArena();
    this.hazards = new ArenaHazardManager(this.scene);
    this.elementVfx = new ElementVfxSystem(this.scene);

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
    this.camera.lookAt(this.cameraTarget);

    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('ninja-controls-updated', this.refreshControls);
    this.resize();
    this.callbacks.onMessage(this.bossRush ? 'Elemental Master Gauntlet! Defeat every challenger.' : 'Tournament begins! Survive the waves.');
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

  toggleCameraView() {
    this.cameraMode = this.cameraMode === 'classic' ? 'overhead' : 'classic';
    this.callbacks.onMessage(this.cameraMode === 'overhead' ? 'Overhead tactical view' : 'Classic tournament view');
    this.callbacks.onCameraModeChange?.(this.cameraMode);
    return this.cameraMode;
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
    this.pitFallActive = false;
    this.hazards.reset();
    this.player.position.set(0, 0, 2.5);
    this.player.rotation.set(0, 0, 0);
    this.player.scale.setScalar(1);
    this.playerShadow.visible = true;
    this.clock.getDelta();
    this.emitHud();
    this.callbacks.onMessage('Continue! Back into the tournament.');
    return true;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.stopSpinjitzuVfx();
    this.hazards.destroy();
    this.elementVfx.destroy();
    for (const pickup of [...this.studPickups]) this.removeStudPickup(pickup);
    for (const pickup of [...this.healthPickups]) this.removeHealthPickup(pickup);
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
    if (event.code === this.keyBindings.ultimate) this.action('ultimate');
    if (event.code === this.keyBindings.dodge) this.dodge(this.input.x, this.input.y);
    if (event.code === this.keyBindings.block) this.input.block = true;
    if (event.code === 'KeyV') {
      event.preventDefault();
      this.toggleCameraView();
    }
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
    // Both views follow the player over the full expanded arena.
    const desiredTarget = new THREE.Vector3(this.player.position.x, 0.85, this.player.position.z - 0.35);
    const followAlpha = dt <= 0 ? 1 : 1 - Math.exp(-dt * 6.5);
    this.cameraTarget.lerp(desiredTarget, followAlpha);

    const desiredPosition = this.cameraMode === 'overhead'
      ? this.cameraTarget.clone().add(new THREE.Vector3(0.01, 46, 0.01))
      : this.cameraTarget.clone().add(this.cameraBasePosition);
    const cameraAlpha = dt <= 0 ? 1 : 1 - Math.exp(-dt * 8.0);
    this.camera.position.lerp(desiredPosition, cameraAlpha);
    this.camera.up.set(0, this.cameraMode === 'overhead' ? 0 : 1, this.cameraMode === 'overhead' ? -1 : 0);

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
    this.camera.lookAt(this.cameraTarget);
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
    this.hudTimer -= dt;
    this.intermission -= dt;
    this.eventTimer -= dt;

    this.elementVfx.update(dt);
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateBoulders(dt);
    this.updateShockwaves(dt);
    this.updateStudPickups(dt);
    this.updateHealthPickups(dt);
    this.updateArenaHazards(dt);

    if (this.enemies.length === 0 && this.intermission <= 0) {
      const bossRushTarget = ROSTER.filter((fighter) => fighter.id !== this.character.id).length;
      if (this.bossRush && this.wave >= bossRushTarget) {
        if (!this.victorySent) {
          this.victorySent = true;
          this.paused = true;
          this.callbacks.onMessage('GAUNTLET COMPLETE — ALL ELEMENTAL MASTERS DEFEATED!');
          this.callbacks.onVictory?.(this.studs, this.wave);
        }
      } else {
        this.spawnWave();
        this.intermission = 1.4;
      }
    }

    if (!this.bossRush && this.wave >= 2 && this.eventTimer <= 0 && this.enemies.length > 0) {
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
      this.spinImpactVfxCooldown = Math.max(0, this.spinImpactVfxCooldown - dt);
      this.player.rotation.y += dt * 31;
      this.invulnerable = Math.max(this.invulnerable, 0.16);

      if (move.lengthSq() > 0.01) {
        const spinSpeed = this.character.speed * 0.92;
        this.player.position.x += move.x * spinSpeed * dt;
        this.player.position.z += move.y * spinSpeed * dt;
      }

      this.updateSpinjitzuVfx(dt);

      // The cyclone now has a readable suction zone before the damaging core.
      // This makes Spinjitzu feel like a moving tornado instead of a circular melee hitbox.
      for (const enemy of this.enemies) {
        const pull = this.player.position.clone().sub(enemy.mesh.position).setY(0);
        const distance = pull.length();
        if (distance > 1.1 && distance < 7.2) {
          const strength = (7.2 - distance) * 1.05 * dt;
          enemy.knock.add(pull.normalize().multiplyScalar(strength));
        }
      }

      if (this.spinTick <= 0) {
        this.spinTick = 0.11;
        const theme = getElementCombatTheme(this.character.element);
        for (const enemy of [...this.enemies]) {
          const distance = enemy.mesh.position.distanceTo(this.player.position);
          if (distance < 3.75) {
            this.hitEnemy(enemy, this.character.damage * 0.92, 6.2, true);
            if (this.spinImpactVfxCooldown <= 0) {
              this.elementVfx.spawnImpact(theme, enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.45, 0)));
              this.spinImpactVfxCooldown = 0.16;
            }
          }
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
    if (preferred === 'kick') this.performElementalKick(forward);
    if (!connected) this.combo = Math.max(0, this.combo - 1);
    return true;
  }

  private performElementalKick(forward: THREE.Vector3) {
    const theme = getElementCombatTheme(this.character.element);
    const origin = this.player.position.clone().addScaledVector(forward, 1.45).setY(0.05);
    this.elementVfx.spawnKick(theme, origin, forward);
    this.spawnHitSpark(origin.clone().setY(0.85), theme.accent, 0.9);

    const targets = [...this.enemies]
      .filter((enemy) => {
        const offset = enemy.mesh.position.clone().sub(this.player.position).setY(0);
        const distance = offset.length();
        if (distance > 3.7 || distance < 0.001) return false;
        return forward.dot(offset.normalize()) > -0.2;
      })
      .sort((a, b) => a.mesh.position.distanceTo(this.player.position) - b.mesh.position.distanceTo(this.player.position));

    const bonusHit = (enemy: Enemy, multiplier: number, knockback: number) => {
      if (!this.enemies.includes(enemy)) return;
      enemy.hp -= Math.max(1, this.character.damage * multiplier);
      enemy.hitFlash = Math.max(enemy.hitFlash, 0.12);
      const impactOrigin = enemy.mesh.position.clone().add(new THREE.Vector3(0, 0.62, 0));
      this.spawnHitSpark(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.05, 0)), theme.color, 0.72);
      this.elementVfx.spawnImpact(theme, impactOrigin);
      if (knockback > 0) {
        const direction = enemy.mesh.position.clone().sub(this.player.position).setY(0).normalize();
        enemy.knock.add(direction.multiplyScalar(knockback));
      }
      if (enemy.hp <= 0) this.defeatEnemy(enemy);
    };

    if (theme.effect === 'fire') targets.slice(0, 2).forEach((enemy) => bonusHit(enemy, 0.2, 2.2));
    else if (theme.effect === 'ice') targets.slice(0, 2).forEach((enemy) => {
      enemy.mesh.userData.elementFreeze = Math.max(Number(enemy.mesh.userData.elementFreeze ?? 0), 0.9);
      bonusHit(enemy, 0.08, 1.2);
    });
    else if (theme.effect === 'lightning') targets.slice(0, 3).forEach((enemy) => bonusHit(enemy, 0.16, 2.8));
    else if (theme.effect === 'earth' || theme.effect === 'metal') targets.slice(0, 2).forEach((enemy) => bonusHit(enemy, 0.11, 8.5));
    else if (theme.effect === 'water' || theme.effect === 'wind') targets.slice(0, 2).forEach((enemy) => bonusHit(enemy, 0.08, 9.5));
    else if (theme.effect === 'poison') targets.slice(0, 2).forEach((enemy) => bonusHit(enemy, 0.22, 1.5));
    else if (theme.effect === 'energy' || theme.effect === 'light') targets.slice(0, 3).forEach((enemy) => bonusHit(enemy, 0.14, 4.8));
    else if (theme.effect === 'mind' || theme.effect === 'shadow') targets.slice(0, 2).forEach((enemy) => bonusHit(enemy, 0.13, 3.4));
    else targets.slice(0, 2).forEach((enemy) => bonusHit(enemy, 0.1, 4.2));
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
    this.spinTime = 2.75;
    this.spinTick = 0;
    this.spinImpactVfxCooldown = 0;
    this.elementVfx.spawnSpinjitzuBurst(getElementCombatTheme(this.character.element), this.player.position.clone());
    this.startSpinjitzuVfx();
    this.callbacks.onMessage(`${this.character.element} Spinjitzu!`);
  }

  private startSpinjitzuVfx() {
    this.stopSpinjitzuVfx();

    const aura = new THREE.Group();
    aura.name = 'spinjitzuAura';
    aura.userData.startedAt = this.elapsed;
    const theme = getElementCombatTheme(this.character.element);

    const additive = (color: number, opacity: number) => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    // Dense lower body: the legacy effect reads like a compact spinning cone,
    // not a hollow transparent cylinder.
    const lowerCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 3.0, 2.45, 56, 1, true),
      additive(theme.color, 0.28)
    );
    lowerCore.name = 'spinjitzuLowerCore';
    lowerCore.position.y = 1.05;
    lowerCore.userData.spinRate = -6.2;
    aura.add(lowerCore);

    const brightCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 2.05, 2.7, 44, 1, true),
      additive(theme.accent, 0.2)
    );
    brightCore.name = 'spinjitzuBrightCore';
    brightCore.position.y = 1.18;
    brightCore.userData.spinRate = 8.4;
    aura.add(brightCore);

    const upperVeil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 2.45, 3.75, 52, 1, true),
      additive(theme.color, 0.15)
    );
    upperVeil.name = 'spinjitzuOuterWind';
    upperVeil.position.y = 1.72;
    upperVeil.userData.spinRate = -3.4;
    upperVeil.userData.verticalPulse = true;
    aura.add(upperVeil);

    // Six helical energy ribbons, slightly biased toward the lower half so the
    // silhouette resembles the original mobile game's compact cyclone.
    for (let band = 0; band < 6; band++) {
      const points: THREE.Vector3[] = [];
      for (let step = 0; step <= 48; step++) {
        const t = step / 48;
        const radius = 0.58 + Math.pow(t, 0.72) * 2.25;
        const angle = t * Math.PI * 6.8 + band * (Math.PI * 2 / 6);
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          0.12 + t * 3.38,
          Math.sin(angle) * radius
        ));
      }
      const spiral = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 76, 0.05 + (band % 3) * 0.008, 7, false),
        additive(band % 2 === 0 ? theme.color : theme.accent, band === 1 || band === 4 ? 0.88 : 0.68)
      );
      spiral.name = `spinjitzuRibbon${band}`;
      spiral.userData.spinRate = band % 2 ? 7.8 : -6.9;
      aura.add(spiral);
    }

    // Fast, flat wind rings near the floor provide the bright "disc" seen in
    // the legacy reference and make the damage radius visually honest.
    for (let i = 0; i < 7; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.15 + i * 0.34, 0.055 + i * 0.004, 8, 52),
        additive(i % 2 === 0 ? theme.accent : theme.color, 0.76 - i * 0.07)
      );
      ring.name = `spinjitzuBaseRing${i}`;
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = i * 0.22;
      ring.position.y = 0.12 + i * 0.19;
      ring.userData.spinRate = i % 2 === 0 ? 9.2 : -8.1;
      aura.add(ring);
    }

    // Curved wind streaks make the cyclone feel fast even when the camera is
    // following the player at the arena edge.
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const streak = new THREE.Mesh(
        new THREE.TorusGeometry(2.55 + (i % 3) * 0.22, 0.022, 6, 38, Math.PI * (0.28 + (i % 4) * 0.05)),
        additive(i % 3 === 0 ? theme.accent : theme.color, 0.4 + (i % 4) * 0.06)
      );
      streak.name = `spinjitzuWindStreak${i}`;
      streak.rotation.x = Math.PI / 2;
      streak.rotation.z = angle;
      streak.position.y = 0.18 + (i % 5) * 0.48;
      streak.userData.spinRate = 10.5 + (i % 4);
      streak.userData.phase = angle;
      aura.add(streak);
    }

    // Element-colored debris/particles remain inside the visible shell.
    for (let i = 0; i < 34; i++) {
      const shard = new THREE.Mesh(
        i % 4 === 0
          ? new THREE.IcosahedronGeometry(0.075 + (i % 4) * 0.014, 0)
          : new THREE.BoxGeometry(0.055, 0.075, 0.24 + (i % 5) * 0.055),
        additive(i % 2 === 0 ? theme.color : theme.accent, 0.78)
      );
      shard.name = `spinjitzuParticle${i}`;
      shard.userData.orbitRadius = 0.8 + (i % 8) * 0.31;
      shard.userData.orbitSpeed = (i % 2 === 0 ? 1 : -1) * (6.4 + (i % 5) * 0.7);
      shard.userData.orbitAngle = (i / 34) * Math.PI * 2;
      shard.userData.baseY = 0.16 + (i % 11) * 0.28;
      shard.userData.bobSpeed = 9 + (i % 7);
      shard.position.set(
        Math.cos(shard.userData.orbitAngle) * shard.userData.orbitRadius,
        shard.userData.baseY,
        Math.sin(shard.userData.orbitAngle) * shard.userData.orbitRadius
      );
      aura.add(shard);
    }

    const floorDust = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 3.7, 72),
      additive(theme.accent, 0.2)
    );
    floorDust.name = 'spinjitzuFloorDust';
    floorDust.rotation.x = -Math.PI / 2;
    floorDust.position.y = 0.045;
    floorDust.userData.spinRate = 4.4;
    aura.add(floorDust);

    const activationWave = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 1.02, 64),
      additive(theme.accent, 0.82)
    );
    activationWave.name = 'spinjitzuActivationWave';
    activationWave.rotation.x = -Math.PI / 2;
    activationWave.position.y = 0.065;
    activationWave.scale.setScalar(0.18);
    activationWave.userData.expandRing = true;
    activationWave.userData.baseOpacity = 0.82;
    aura.add(activationWave);

    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(2.18, 0.065, 8, 54),
      additive(theme.color, 0.48)
    );
    crown.name = 'spinjitzuCrown';
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 3.46;
    crown.userData.spinRate = -8.2;
    aura.add(crown);

    const glow = new THREE.PointLight(theme.color, Math.max(3.2, theme.lightIntensity * 1.85), 10.8, 2);
    glow.name = 'spinjitzuLight';
    glow.position.y = 1.35;
    aura.add(glow);

    aura.position.copy(this.player.position);
    this.scene.add(aura);
    this.spinAura = aura;
  }

  private updateSpinjitzuVfx(dt: number) {
    if (!this.spinAura) return;
    this.spinAura.position.copy(this.player.position);
    this.spinAura.rotation.y += dt * 14.6;
    const pulse = 1 + Math.sin(this.elapsed * 26) * 0.045;
    this.spinAura.scale.setScalar(pulse);

    const activationT = clamp((2.75 - this.spinTime) / 0.42, 0, 1);
    this.spinAura.children.forEach((child, index) => {
      const orbitRadius = Number(child.userData.orbitRadius ?? 0);
      if (orbitRadius > 0) {
        const angle = Number(child.userData.orbitAngle ?? 0) + this.elapsed * Number(child.userData.orbitSpeed ?? 6);
        const baseY = Number(child.userData.baseY ?? 0.5);
        const bobSpeed = Number(child.userData.bobSpeed ?? 9);
        child.position.set(
          Math.cos(angle) * orbitRadius,
          baseY + Math.sin(this.elapsed * bobSpeed + index) * 0.12,
          Math.sin(angle) * orbitRadius
        );
        child.rotation.x += dt * 10;
        child.rotation.z += dt * 13;
        return;
      }

      if (child.userData.expandRing && child instanceof THREE.Mesh) {
        child.scale.setScalar(0.18 + activationT * 5.6);
        const material = child.material as THREE.MeshBasicMaterial;
        material.opacity = Number(child.userData.baseOpacity ?? 0.82) * (1 - activationT);
        return;
      }

      if (child.userData.verticalPulse) {
        child.scale.y = 0.97 + Math.sin(this.elapsed * 17) * 0.06;
      }

      const phase = Number(child.userData.phase ?? 0);
      if (child.name.startsWith('spinjitzuWindStreak')) {
        child.position.y += Math.sin(this.elapsed * 9 + phase) * dt * 0.18;
      }

      const rate = typeof child.userData.spinRate === 'number'
        ? child.userData.spinRate as number
        : (index % 2 === 0 ? 5.2 : -5.2);
      child.rotation.y += dt * rate;
      child.rotation.z += dt * rate * 0.48;
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
    const healChance = enemy.kind === 'boss' ? 1 : enemy.kind === 'heavy' ? 0.28 : enemy.kind === 'ranged' ? 0.18 : 0.2;
    if (Math.random() < healChance) {
      const healAmount = enemy.kind === 'boss' || Math.random() < 0.34 ? 1 : 0.5;
      this.spawnHealthPickup(origin, healAmount);
    }
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
      enemy.bossSpinHitCooldown = Math.max(0, enemy.bossSpinHitCooldown - dt);
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

      const elementalFreeze = Number(enemy.mesh.userData.elementFreeze ?? 0);
      if (elementalFreeze > 0) {
        enemy.mesh.userData.elementFreeze = Math.max(0, elementalFreeze - dt);
        enemy.mesh.rotation.z = Math.sin(this.elapsed * 18) * 0.035;
        continue;
      }
      enemy.mesh.rotation.z *= Math.pow(0.02, dt);

      if (enemy.bossSpinTime > 0) {
        enemy.bossSpinTime = Math.max(0, enemy.bossSpinTime - dt);
        const toPlayer = playerPos.clone().sub(enemy.mesh.position).setY(0);
        const distance = toPlayer.length();
        const warmup = Number(enemy.mesh.userData.bossSpinWarmupUntil ?? 0) > this.elapsed;
        enemy.mesh.rotation.y += dt * (warmup ? 12 : 29);
        if (!warmup && distance > 0.55) enemy.mesh.position.addScaledVector(toPlayer.normalize(), enemy.speed * 1.48 * dt);

        const aura = enemy.mesh.getObjectByName('bossSpinjitzuAura') as THREE.Group | undefined;
        if (aura) {
          aura.visible = true;
          aura.rotation.y += dt * (warmup ? 6 : 13);
          const pulse = warmup
            ? 0.72 + Math.sin(this.elapsed * 22) * 0.08
            : 1 + Math.sin(this.elapsed * 26) * 0.065;
          aura.scale.setScalar(pulse);

          const warning = aura.getObjectByName('bossSpinWarning');
          if (warning instanceof THREE.Mesh && warning.material instanceof THREE.MeshBasicMaterial) {
            warning.scale.setScalar(warmup ? 1 + Math.sin(this.elapsed * 18) * 0.08 : 1.18);
            warning.material.opacity = warmup ? 0.62 : 0.16;
          }

          aura.children.forEach((child, index) => {
            const orbitRadius = Number(child.userData.orbitRadius ?? 0);
            if (orbitRadius > 0) {
              const angle = Number(child.userData.orbitAngle ?? 0) + this.elapsed * (6.5 + (index % 4));
              const baseY = Number(child.userData.baseY ?? 0.5);
              child.position.set(
                Math.cos(angle) * orbitRadius,
                baseY + Math.sin(this.elapsed * 10 + index) * 0.11,
                Math.sin(angle) * orbitRadius
              );
              child.rotation.x += dt * 9;
              child.rotation.z += dt * 11;
            } else if (child.name.startsWith('bossSpinRing') || child.name.startsWith('bossSpinRibbon')) {
              child.rotation.z += dt * (index % 2 ? 6.6 : -6.2);
            }
          });
        }

        if (!warmup && distance < 3.25 && enemy.bossSpinHitCooldown <= 0) {
          this.damagePlayer(enemy.damage * 0.78);
          enemy.bossSpinHitCooldown = 0.32;
        }

        if (enemy.bossSpinTime <= 0 && aura) aura.visible = false;
        const spinPlanar = new THREE.Vector2(enemy.mesh.position.x, enemy.mesh.position.z);
        if (spinPlanar.length() > ARENA_RADIUS + 0.25) {
          spinPlanar.setLength(ARENA_RADIUS + 0.25);
          enemy.mesh.position.x = spinPlanar.x;
          enemy.mesh.position.z = spinPlanar.y;
        }
        continue;
      }

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

      if (Math.abs(enemy.mesh.position.x) > 41.8 && Math.abs(enemy.mesh.position.z) < 2.8 && enemy.knock.length() > 1.5) {
        this.defeatEnemy(enemy);
        this.callbacks.onMessage('GONG KO! Instant arena knockout.');
      }
    }
  }

  private performBossSpecial(enemy: Enemy) {
    const name = enemy.bossName ?? '';
    enemy.specialCount += 1;
    enemy.specialCooldown = 5 + Math.random() * 2.5;
    const toPlayer = this.player.position.clone().sub(enemy.mesh.position).setY(0);

    if (enemy.bossCharacter && (enemy.bossCharacter.special === 'spinjitzu' || enemy.specialCount % 3 === 0)) {
      this.startBossSpinjitzu(enemy);
      return;
    }

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

    const element = enemy.bossCharacter?.element ?? '';
    const theme = getElementCombatTheme(element);
    const origin = enemy.mesh.position.clone().add(new THREE.Vector3(0, 1.05, 0));

    if (/Ice/i.test(element) && toPlayer.lengthSq() > 0.01) {
      for (let i = -1; i <= 1; i++) {
        const direction = toPlayer.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.12).multiplyScalar(8.5);
        this.spawnEnemyProjectile(origin, direction, enemy.damage * 0.58, theme.color, 'freeze');
      }
      this.callbacks.onMessage(`${name}: ICE SHURIKEN!`);
      return;
    }

    if (/Smoke|Shadow|Form/i.test(element)) {
      const side = enemy.specialCount % 2 === 0 ? 1 : -1;
      const offset = new THREE.Vector3(
        Math.sin(this.player.rotation.y + side * Math.PI / 2),
        0,
        Math.cos(this.player.rotation.y + side * Math.PI / 2)
      ).multiplyScalar(2.7);
      enemy.mesh.position.copy(this.player.position).add(offset);
      enemy.hiddenTime = 1.15;
      this.setEnemyOpacity(enemy, 0.24);
      enemy.attackCooldown = 0.18;
      this.callbacks.onMessage(`${name}: ${element.toUpperCase()} STEP!`);
      return;
    }

    if (/Speed/i.test(element) && toPlayer.lengthSq() > 0.01) {
      enemy.knock.add(toPlayer.normalize().multiplyScalar(15));
      enemy.attackCooldown = 0.08;
      this.callbacks.onMessage(`${name}: SPEED CHARGE!`);
      return;
    }

    if (/Water/i.test(element)) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const direction = new THREE.Vector3(Math.cos(angle), 0.05, Math.sin(angle)).multiplyScalar(7.3);
        this.spawnEnemyProjectile(origin, direction, enemy.damage * 0.48, theme.color);
      }
      this.spawnShockwave(enemy.mesh.position, 6.8, 0.72);
      this.callbacks.onMessage(`${name}: TIDAL BURST!`);
      return;
    }

    if (/Poison|Venomari|Serpentine|Anacondrai|Constrictai|Hypnobrai/i.test(element) && toPlayer.lengthSq() > 0.01) {
      for (let i = -2; i <= 2; i++) {
        const direction = toPlayer.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.14).multiplyScalar(7.7);
        this.spawnEnemyProjectile(origin, direction, enemy.damage * 0.5, theme.color);
      }
      if (enemy.specialCount % 2 === 0) enemy.knock.add(toPlayer.clone().normalize().multiplyScalar(8.5));
      this.callbacks.onMessage(`${name}: SERPENT VENOM!`);
      return;
    }

    if (/Creation|Staff of Elements/i.test(element)) {
      this.spawnShockwave(enemy.mesh.position, 8.7, 1.15);
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + this.elapsed * 0.2;
        const direction = new THREE.Vector3(Math.cos(angle), 0.05, Math.sin(angle)).multiplyScalar(8.1);
        this.spawnEnemyProjectile(origin, direction, enemy.damage * 0.48, theme.color);
      }
      this.callbacks.onMessage(`${name}: CREATION SURGE!`);
      return;
    }

    if (/Nindroid|Samurai/i.test(element) && toPlayer.lengthSq() > 0.01) {
      for (let i = -2; i <= 2; i++) {
        const direction = toPlayer.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.09).multiplyScalar(9.4);
        this.spawnEnemyProjectile(origin, direction, enemy.damage * 0.46, theme.color);
      }
      this.callbacks.onMessage(`${name}: WEAPON VOLLEY!`);
      return;
    }

    if (/Earth|Metal/i.test(element)) {
      this.spawnShockwave(enemy.mesh.position, 8.4, 1.36);
      enemy.knock.y = 0;
      this.callbacks.onMessage(`${name}: ${element.toUpperCase()} TREMOR!`);
      return;
    }

    if (/Fire|Lightning|Energy|Amber|Mind|Light|Dark Magic|Brown Power/i.test(element) && toPlayer.lengthSq() > 0.01) {
      for (let i = -1; i <= 1; i++) {
        const direction = toPlayer.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.18).multiplyScalar(8.8);
        this.spawnEnemyProjectile(origin, direction, enemy.damage * 0.62, theme.color);
      }
      this.callbacks.onMessage(`${name}: ${element.toUpperCase()} BURST!`);
      return;
    }

    this.spawnShockwave(enemy.mesh.position, 6.5, 1.0);
    this.callbacks.onMessage(`${name}: ELEMENTAL STRIKE!`);
  }

  private startBossSpinjitzu(enemy: Enemy) {
    enemy.bossSpinTime = 2.55;
    enemy.bossSpinHitCooldown = 0;
    enemy.specialCooldown = 6.0 + Math.random() * 2.2;
    enemy.mesh.userData.bossSpinWarmupUntil = this.elapsed + 0.48;

    let aura = enemy.mesh.getObjectByName('bossSpinjitzuAura') as THREE.Group | undefined;
    if (!aura) {
      aura = new THREE.Group();
      aura.name = 'bossSpinjitzuAura';
      const color = enemy.bossCharacter?.color ?? 0xd7a841;
      const accent = enemy.bossCharacter?.accent ?? color;
      const addMat = (tone: number, opacity: number) => new THREE.MeshBasicMaterial({
        color: tone,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });

      const lower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 2.4, 2.55, 40, 1, true),
        addMat(color, 0.25)
      );
      lower.name = 'bossSpinLowerCore';
      lower.position.y = 1.05;
      aura.add(lower);

      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 1.9, 3.1, 36, 1, true),
        addMat(accent, 0.15)
      );
      upper.name = 'bossSpinOuterWind';
      upper.position.y = 1.42;
      aura.add(upper);

      for (let band = 0; band < 4; band++) {
        const points: THREE.Vector3[] = [];
        for (let step = 0; step <= 34; step++) {
          const t = step / 34;
          const radius = 0.55 + Math.pow(t, 0.78) * 1.65;
          const angle = t * Math.PI * 5.7 + band * (Math.PI * 2 / 4);
          points.push(new THREE.Vector3(Math.cos(angle) * radius, 0.18 + t * 2.8, Math.sin(angle) * radius));
        }
        const ribbon = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 52, 0.055, 7, false),
          addMat(band % 2 === 0 ? color : accent, 0.72)
        );
        ribbon.name = `bossSpinRibbon${band}`;
        aura.add(ribbon);
      }

      for (let i = 0; i < 6; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.82 + i * 0.24, 0.055, 8, 42),
          addMat(i % 2 === 0 ? color : accent, 0.76 - i * 0.08)
        );
        ring.name = `bossSpinRing${i}`;
        ring.position.y = 0.26 + i * 0.3;
        ring.rotation.x = Math.PI / 2;
        ring.rotation.z = i * 0.36;
        aura.add(ring);
      }

      const warning = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 2.75, 60),
        addMat(accent, 0.58)
      );
      warning.name = 'bossSpinWarning';
      warning.rotation.x = -Math.PI / 2;
      warning.position.y = 0.04;
      aura.add(warning);

      for (let i = 0; i < 18; i++) {
        const shard = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.075, 0.2 + (i % 4) * 0.06),
          addMat(i % 2 === 0 ? color : accent, 0.7)
        );
        const angle = i / 18 * Math.PI * 2;
        const radius = 0.7 + (i % 5) * 0.27;
        shard.name = `bossSpinParticle${i}`;
        shard.userData.orbitAngle = angle;
        shard.userData.orbitRadius = radius;
        shard.userData.baseY = 0.28 + (i % 7) * 0.32;
        shard.position.set(Math.cos(angle) * radius, shard.userData.baseY, Math.sin(angle) * radius);
        aura.add(shard);
      }

      const light = new THREE.PointLight(color, 3.4, 7.5, 2);
      light.name = 'bossSpinLight';
      light.position.y = 1.2;
      aura.add(light);
      enemy.mesh.add(aura);
    }

    aura.visible = true;
    const warning = aura.getObjectByName('bossSpinWarning') as THREE.Mesh | undefined;
    if (warning?.material instanceof THREE.MeshBasicMaterial) warning.material.opacity = 0.58;
    this.callbacks.onMessage(`${enemy.bossName ?? 'Elemental Master'} is charging Spinjitzu!`);
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
      if (projectile.life <= 0 || projectile.mesh.position.length() > 64) {
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(this.projectiles.indexOf(projectile), 1);
      }
    }
  }

  private spawnWave() {
    this.wave += 1;
    const isBossWave = this.bossRush || this.wave % 5 === 0;
    if (isBossWave) {
      // The legacy tournament repeatedly pits the player against named Elemental Masters.
      // Boss Rush turns every round into the next roster fighter, while normal Tournament
      // keeps regular enemy waves between challengers.
      const bossPool = ROSTER.filter((fighter) => fighter.id !== this.character.id);
      const bossRound = this.bossRush ? this.wave - 1 : Math.floor(this.wave / 5) - 1;
      const bossCharacter = bossPool[((bossRound % bossPool.length) + bossPool.length) % bossPool.length];
      this.enemies.push(this.createEnemy('boss', 0, -22.0, bossCharacter.name, bossCharacter));
      this.callbacks.onMessage(this.bossRush
        ? `CHALLENGER ${((bossRound % bossPool.length) + bossPool.length) % bossPool.length + 1}/${bossPool.length}: ${bossCharacter.name}`
        : `ELEMENTAL MASTER: ${bossCharacter.name}`);
    } else {
      const count = Math.min(14, 2 + this.wave);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35;
        const radius = 16 + Math.random() * 19.0;
        const roll = Math.random();
        const kind: EnemyKind = this.wave < 2 ? 'melee' : roll > 0.78 ? 'ranged' : roll > 0.56 ? 'heavy' : 'melee';
        this.enemies.push(this.createEnemy(kind, Math.cos(angle) * radius, Math.sin(angle) * radius));
      }
      this.callbacks.onMessage(`Wave ${this.wave}`);
    }
    this.emitHud();
  }

  private createEnemy(kind: EnemyKind, x: number, z: number, bossName?: string, bossCharacter?: CharacterDef): Enemy {
    const colors: Record<EnemyKind, [number, number]> = {
      melee: [0x5a263d, 0xc59645],
      heavy: [0x353a3f, 0xc4483b],
      ranged: [0x283b6a, 0xd6bd4d],
      boss: [0x7a261f, 0xd7a841]
    };
    const scale = kind === 'boss' ? 1.32 : kind === 'heavy' ? 1.14 : 1;
    let mesh: THREE.Group;

    if (kind === 'boss' && bossCharacter) {
      mesh = createCharacterModel(bossCharacter, scale);
      mesh.userData.bossElement = bossCharacter.element;
    } else {
      const family = this.wave <= 2 ? 0 : this.wave % 4;
      if (family === 0) {
        const serpentPrimary = kind === 'ranged' ? 0x46663a : kind === 'heavy' ? 0x5e365f : 0x6c435f;
        const serpentAccent = kind === 'ranged' ? 0xd6ca55 : 0xd0a34a;
        mesh = createGenericFighterModel(
          serpentPrimary,
          serpentAccent,
          scale,
          'serpentine',
          kind === 'ranged' ? 'staff' : kind === 'heavy' ? 'spear' : 'katana'
        );
        mesh.userData.enemyFamily = 'Serpentine';
      } else if (family === 2) {
        mesh = createGenericFighterModel(colors[kind][0], colors[kind][1], scale, 'nindroid', kind === 'heavy' ? 'scythe' : 'staff');
        mesh.userData.enemyFamily = 'Nindroid';
      } else if (family === 3) {
        mesh = createGenericFighterModel(0xd9d6ca, kind === 'heavy' ? 0x5d6871 : 0x846e55, scale, 'skeleton', kind === 'heavy' ? 'scythe' : 'katana');
        mesh.userData.enemyFamily = 'Skulkin';
      } else {
        const enemyWeapon = kind === 'heavy' ? 'scythe' : kind === 'ranged' ? 'staff' : 'katana';
        mesh = createGenericFighterModel(colors[kind][0], colors[kind][1], scale, 'villain', enemyWeapon);
        mesh.userData.enemyFamily = 'Cultist';
      }
    }

    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const waveScale = 1 + this.wave * 0.065;
    const bossBaseHp = bossCharacter ? 190 + bossCharacter.maxHealth * 20 : 230;
    const maxHp = (kind === 'boss' ? bossBaseHp : kind === 'heavy' ? 75 : 42) * waveScale;
    return {
      mesh,
      kind,
      hp: maxHp,
      maxHp,
      speed: (kind === 'heavy' ? 2.1 : kind === 'ranged' ? 2.6 : kind === 'boss' ? Math.max(2.5, (bossCharacter?.speed ?? 5.5) * 0.48) : 3.0) + Math.min(1.2, this.wave * 0.035),
      damage: kind === 'boss' ? Math.max(1.05, (bossCharacter?.damage ?? 22) / 19) : kind === 'heavy' ? 0.82 : 0.58,
      attackCooldown: 0.5 + Math.random(),
      specialCooldown: kind === 'boss' ? 3.5 + Math.random() * 1.8 : 999,
      hiddenTime: 0,
      knock: new THREE.Vector3(),
      bossName,
      bossCharacter,
      bossSpinTime: 0,
      bossSpinHitCooldown: 0,
      specialCount: 0,
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

  private updateArenaHazards(dt: number) {
    const targets = [
      {
        id: 'player',
        position: this.player.position,
        grounded: this.grounded && this.player.position.y <= 0.08
      },
      ...this.enemies.map((enemy) => ({
        id: enemy.mesh.uuid,
        position: enemy.mesh.position,
        grounded: enemy.mesh.position.y <= 0.08
      }))
    ];

    const frame = this.hazards.update(dt, this.wave, targets);
    for (const announcement of frame.announcements) this.callbacks.onMessage(announcement);

    for (const impact of frame.impacts) {
      if (impact.targetId === 'player') {
        if (impact.lethal) this.triggerPitFall();
        else this.damagePlayer(0.72);
        continue;
      }

      const enemy = this.enemies.find((candidate) => candidate.mesh.uuid === impact.targetId);
      if (!enemy) continue;
      if (impact.lethal) {
        this.defeatEnemy(enemy);
        this.callbacks.onMessage('Arena pit KO! An enemy fell through the floor.');
      } else {
        this.hitEnemy(enemy, 42 + this.wave * 1.8, 4.2, true);
      }
    }
  }

  private triggerPitFall() {
    if (this.pitFallActive || this.health <= 0) return;
    this.pitFallActive = true;
    this.health = 0;
    this.combo = 0;
    this.special = 0;
    this.spinTime = 0;
    this.stopSpinjitzuVfx();
    this.input.block = false;
    this.paused = true;
    this.playerShadow.visible = false;
    this.callbacks.onMessage('THE FLOOR COLLAPSED! You fell into the arena pit.');
    this.emitHud();

    const startedAt = performance.now();
    const startY = this.player.position.y;
    const animateFall = (now: number) => {
      if (!this.running || !this.pitFallActive) return;
      const t = Math.min(1, (now - startedAt) / 720);
      const eased = t * t;
      this.player.position.y = THREE.MathUtils.lerp(startY, -5.6, eased);
      this.player.rotation.x += 0.055;
      this.player.rotation.z += 0.075;
      this.player.scale.setScalar(1 - t * 0.28);
      if (t < 1) requestAnimationFrame(animateFall);
      else this.callbacks.onGameOver(this.studs, this.wave);
    };
    requestAnimationFrame(animateFall);
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

  private spawnHealthPickup(origin: THREE.Vector3, amount: number) {
    const group = new THREE.Group();
    group.name = amount >= 1 ? 'fullHeartPickup' : 'halfHeartPickup';
    const material = new THREE.MeshStandardMaterial({
      color: amount >= 1 ? 0xe83f52 : 0xff7187,
      emissive: amount >= 1 ? 0x5a101a : 0x6b1726,
      emissiveIntensity: 0.58,
      roughness: 0.3,
      metalness: 0.02
    });
    const left = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), material);
    const right = left.clone();
    left.position.set(-0.14, 0.09, 0);
    right.position.set(0.14, 0.09, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.285, 0.46, 12), material);
    tip.rotation.z = Math.PI;
    tip.position.y = -0.14;
    group.add(left, right, tip);
    group.scale.setScalar(amount >= 1 ? 1 : 0.8);
    group.position.copy(origin).add(new THREE.Vector3(0, 0.9, 0));
    group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
    this.scene.add(group);
    this.healthPickups.push({
      group,
      amount,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2.8, 3.2 + Math.random() * 1.8, (Math.random() - 0.5) * 2.8),
      life: 14,
      age: 0
    });
  }

  private updateHealthPickups(dt: number) {
    for (const pickup of [...this.healthPickups]) {
      pickup.life -= dt;
      pickup.age += dt;
      pickup.velocity.y -= 8.7 * dt;
      pickup.group.position.addScaledVector(pickup.velocity, dt);
      if (pickup.group.position.y < 0.42) {
        pickup.group.position.y = 0.42;
        if (pickup.velocity.y < 0) pickup.velocity.y *= -0.34;
        pickup.velocity.x *= Math.pow(0.2, dt);
        pickup.velocity.z *= Math.pow(0.2, dt);
      }

      pickup.group.rotation.y += dt * 3.8;
      const toPlayer = this.player.position.clone().add(new THREE.Vector3(0, 0.75, 0)).sub(pickup.group.position);
      const distance = toPlayer.length();
      if (this.health < this.character.maxHealth && pickup.age > 0.25 && distance < 5.2) {
        pickup.group.position.addScaledVector(toPlayer.normalize(), (5.5 + (5.2 - distance) * 2.6) * dt);
      }

      if (this.health < this.character.maxHealth && distance < 0.78) {
        this.health = Math.min(this.character.maxHealth, Math.round((this.health + pickup.amount) * 2) / 2);
        this.callbacks.onMessage(pickup.amount >= 1 ? 'HEART collected! Health +1' : 'HALF HEART collected! Health +½');
        this.emitHud();
        this.removeHealthPickup(pickup);
        continue;
      }

      if (pickup.life <= 0) this.removeHealthPickup(pickup);
    }
  }

  private removeHealthPickup(pickup: HealthPickup) {
    const index = this.healthPickups.indexOf(pickup);
    if (index >= 0) this.healthPickups.splice(index, 1);
    this.scene.remove(pickup.group);
    pickup.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
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
    key.shadow.camera.left = -54;
    key.shadow.camera.right = 54;
    key.shadow.camera.top = 54;
    key.shadow.camera.bottom = -54;
    key.shadow.bias = -0.00045;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x798dba, 1.25);
    rim.position.set(10, 8, -12);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(46.8, 46.8, 0.55, 144),
      new THREE.MeshStandardMaterial({ color: 0x505b66, roughness: 0.9, metalness: 0.015 })
    );
    floor.receiveShadow = true;
    floor.position.y = -0.3;
    this.scene.add(floor);

    const inner = new THREE.Mesh(
      new THREE.CylinderGeometry(41.2, 41.2, 0.04, 144),
      new THREE.MeshStandardMaterial({ color: 0x66727d, roughness: 0.86 })
    );
    inner.position.y = 0.01;
    inner.receiveShadow = true;
    this.scene.add(inner);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(40.2, 41.0, 144),
      new THREE.MeshBasicMaterial({ color: 0x252a30, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.scene.add(ring);
    buildTournamentFloorDetails(this.scene);

    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = i % 2 ? 42.0 : 44.0;
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
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      if (Math.abs(Math.cos(angle)) > 0.9 && Math.abs(Math.sin(angle)) < 0.32) continue;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.5 + Math.random() * 1.1, 0.65), wallMaterial);
      wall.position.set(Math.cos(angle) * 47.6, 1.1, Math.sin(angle) * 47.6);
      wall.rotation.y = -angle + Math.PI / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
    }

    this.buildArenaGate();
    this.buildSerpentPillar(-41.0, -37.2, 0.28);
    this.buildSerpentPillar(41.0, -37.2, -0.28);
    this.buildSerpentPillar(-41.8, 35.8, 0.2);
    this.buildSerpentPillar(41.8, 35.8, -0.2);

    this.buildGong(-43.0, 0);
    this.buildGong(43.0, 0);

    for (const z of [-22.0, -10.5, 10.5, 22.0]) {
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

  private buildLegacyFloorMarkings() {
    const darkInk = new THREE.MeshBasicMaterial({
      color: 0x2d3339,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const fineInk = new THREE.MeshBasicMaterial({
      color: 0x343b42,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Concentric tournament rings, based on the cool grey engraved floor seen in legacy footage.
    for (const radius of [6.2, 10.4, 15.2, 21.4, 28.4, 34.8, 39.4]) {
      const circle = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.12, 96), radius > 17 ? darkInk : fineInk);
      circle.rotation.x = -Math.PI / 2;
      circle.position.y = 0.078;
      this.scene.add(circle);
    }

    // Stone slab seams clipped to the circular floor instead of a square grid.
    const floorRadius = 39.8;
    for (let step = -13; step <= 13; step++) {
      const offset = step * 2.85;
      const halfLength = Math.sqrt(Math.max(0, floorRadius * floorRadius - offset * offset));
      const horizontal = new THREE.Mesh(new THREE.BoxGeometry(halfLength * 2, 0.014, 0.055), fineInk);
      horizontal.position.set(0, 0.079, offset);
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.014, halfLength * 2), fineInk);
      vertical.position.set(offset, 0.079, 0);
      this.scene.add(horizontal, vertical);
    }

    // Repeated dark glyph blocks create the strong maze-like ring language of Chen's arena.
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const radius = i % 2 === 0 ? 30.2 : 33.8;
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(i % 3 === 0 ? 1.65 : 1.05, 0.018, 0.26), darkInk);
      glyph.position.set(Math.cos(angle) * radius, 0.084, Math.sin(angle) * radius);
      glyph.rotation.y = -angle + (i % 4 === 0 ? 0.62 : -0.18);
      this.scene.add(glyph);
    }

    // A clean-room paired serpent motif gives the centre a recognizable tournament emblem.
    const makeSerpent = (mirror: number) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(mirror * 1.2, 0.092, -4.5),
        new THREE.Vector3(mirror * 3.4, 0.092, -2.4),
        new THREE.Vector3(mirror * 2.1, 0.092, 0.1),
        new THREE.Vector3(mirror * 4.3, 0.092, 2.3),
        new THREE.Vector3(mirror * 1.6, 0.092, 4.7)
      ]);
      const serpent = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.12, 8, false), darkInk);
      this.scene.add(serpent);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 6), darkInk);
      head.rotation.x = Math.PI / 2;
      head.rotation.z = mirror > 0 ? -0.48 : 0.48;
      head.position.set(mirror * 1.72, 0.1, 5.05);
      this.scene.add(head);
    };
    makeSerpent(-1);
    makeSerpent(1);
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
        stand.position.set(side * (45.4 + level * 0.62), 0.25 + level * 0.48, 0.6);
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
            side * (43.6 + row * 0.78),
            1.0 + row * 0.55,
            -7.4 + i * 1.82 + (row % 2) * 0.45
          );
          spectator.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          this.scene.add(spectator);
        }
      }
    }

    // Tournament banners echo the red/purple/gold architecture in reference footage.
    const bannerPoints: Array<[number, number, number, THREE.Material]> = [
      [-43.0, 4.0, -23.0, red],
      [43.0, 4.0, -23.0, purple],
      [-43.2, 4.1, 22.6, purple],
      [43.2, 4.1, 22.6, red]
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
    balcony.position.set(0, 6.55, -45.65);
    balcony.castShadow = true;
    balcony.receiveShadow = true;
    this.scene.add(balcony);
    for (const x of [-2.25, -1.5, 1.5, 2.25]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 1.0, 10), gold);
      rail.position.set(x, 7.02, -44.82);
      rail.castShadow = true;
      this.scene.add(rail);
    }
    const throneBack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.05, 0.38), red);
    throneBack.position.set(0, 7.45, -45.52);
    const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.35, 1.05), gold);
    throneSeat.position.set(0, 6.76, -45.18);
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.09, 8, 28), gold);
    crest.position.set(0, 8.08, -45.28);
    for (const object of [throneBack, throneSeat, crest]) {
      object.castShadow = true;
      this.scene.add(object);
    }

    const chen = createGenericFighterModel(0x7b2631, 0xd3a84c, 0.78, 'villain', 'staff');
    chen.name = 'chenThroneSpectator';
    chen.position.set(0, 6.92, -44.92);
    chen.rotation.y = 0;
    this.scene.add(chen);

    for (const side of [-1, 1] as const) {
      const guard = createGenericFighterModel(0x342535, 0xb8892e, 0.7, 'villain', 'katana');
      guard.name = side < 0 ? 'chenGuardLeft' : 'chenGuardRight';
      guard.position.set(side * 1.65, 6.84, -45.02);
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

    const z = -45.95;
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
      health: Math.round(this.health * 2) / 2,
      maxHealth: this.character.maxHealth,
      studs: this.studs,
      combo: this.combo,
      multiplier: this.getMultiplier(),
      special: this.special,
      wave: this.wave,
      enemies: this.enemies.length,
      bossName: boss?.bossName,
      bossHealth: boss ? Math.max(0, boss.hp) : undefined,
      bossMaxHealth: boss?.maxHp,
      bossColor: boss?.bossCharacter?.color,
      bossAccent: boss?.bossCharacter?.accent,
      bossElement: boss?.bossCharacter?.element,
      bossId: boss?.bossCharacter?.id
    });
  }
}
