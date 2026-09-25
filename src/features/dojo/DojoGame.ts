import * as THREE from 'three';
import { getElementCombatTheme, type CharacterDef } from '../characters';
import { createCharacterModel } from '../characters/model';
import { createGenericFighterModel } from '../../shared/three/minifigure-model';
import { formatKeyLabel, getKeyBindings, type KeyBindings } from '../controls';

export type DojoAction = 'attack' | 'punch' | 'kick' | 'jump' | 'grab' | 'special';
export type DojoStep = 'move' | 'attack' | 'jump' | 'block' | 'grab' | 'dodge' | 'special' | 'complete';

export interface DojoCallbacks {
  onStep: (step: DojoStep, title: string, instruction: string, progress: number) => void;
  onMeter: (value: number) => void;
  onComplete: () => void;
}

const STEP_ORDER: DojoStep[] = ['move', 'attack', 'jump', 'block', 'grab', 'dodge', 'special', 'complete'];
const FIXED_STEP = 1 / 60;
const MAX_CATCHUP_SECONDS = 0.25;
const MAX_ACTION_RECONCILE_SECONDS = 1.25;
const MAX_INPUT_RECONCILE_SECONDS = 2.5;

export class DojoGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(47, 1, 0.1, 70);
  private renderer: THREE.WebGLRenderer;
  private player: THREE.Group;
  private dummy: THREE.Group;
  private shadow: THREE.Mesh;
  private frame = 0;
  private simulationTimer = 0;
  private lastSimulationAt = performance.now();
  private simulationDebt = 0;
  private running = true;
  private keyboard = new Set<string>();
  private keyBindings: KeyBindings = getKeyBindings();
  private heldStartedAt = new Map<string, number>();
  private heldIntegrated = new Map<string, number>();
  private input = { x: 0, y: 0, block: false };
  private stepIndex = 0;
  private moveDistance = 0;
  private attackHits = 0;
  private blockTime = 0;
  private meter = 0;
  private jumpVelocity = 0;
  private grounded = true;
  private dodgeTime = 0;
  private dodgeDirection = new THREE.Vector3();
  private specialTime = 0;
  private specialTick = 0;
  private actionCooldown = 0;
  private attackBufferTime = 0;
  private bufferedAttackKind: 'attack' | 'punch' | 'kick' = 'attack';
  private attackAnimationTime = 0;
  private attackAnimationDuration = 0.28;
  private attackMove: 'jab' | 'cross' | 'kick' = 'jab';
  private attackMoveIndex = 0;
  private visualElapsed = 0;
  private dummyFlash = 0;
  private completeSent = false;

  constructor(private host: HTMLElement, private character: CharacterDef, private callbacks: DojoCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x241a1d);
    this.scene.fog = new THREE.FogExp2(0x241a1d, 0.022);
    this.buildDojo();
    this.player = createCharacterModel(character, 1);
    this.player.position.set(-3.5, 0, 2.8);
    this.scene.add(this.player);
    this.dummy = createGenericFighterModel(0x553946, 0xcda85d, 0.96, 'villain', 'katana');
    this.dummy.position.set(2.8, 0, -1.8);
    this.dummy.rotation.y = Math.PI;
    this.scene.add(this.dummy);

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.scene.add(this.shadow);

    this.camera.position.set(12.2, 10.8, 14.1);
    this.camera.lookAt(0, 0.8, -0.25);
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('ninja-controls-updated', this.refreshControls);
    this.resize();
    this.announceStep();

    // Simulation is deliberately decoupled from rendering. On low-end devices,
    // WebGL can temporarily render far below 60 FPS; controls and tutorial progress
    // must still advance according to elapsed time rather than rendered frames.
    this.lastSimulationAt = performance.now();
    this.simulationTimer = window.setInterval(() => this.simulationTick(), 1000 / 60);
    this.loop();
  }

  setMove(x: number, y: number) {
    this.input.x = Math.max(-1, Math.min(1, x));
    this.input.y = Math.max(-1, Math.min(1, y));
  }

  setBlock(active: boolean) {
    this.simulationTick(MAX_ACTION_RECONCILE_SECONDS);
    this.input.block = active;
  }

  action(action: DojoAction) {
    // A WebGL render can monopolize the main thread on software/low-end GPUs.
    // Reconcile real elapsed simulation time before evaluating cooldown-gated actions.
    this.simulationTick(MAX_ACTION_RECONCILE_SECONDS);
    if (action === 'attack' || action === 'punch' || action === 'kick') this.attack(action);
    if (action === 'jump') this.jump();
    if (action === 'grab') this.grab();
    if (action === 'special') this.special();
  }

  dodge(x = 0, y = 0) {
    this.simulationTick(MAX_ACTION_RECONCILE_SECONDS);
    if (!this.grounded || this.dodgeTime > 0) return;
    const dir = new THREE.Vector3(x, 0, y);
    if (dir.lengthSq() < 0.04) dir.set(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    else dir.normalize();
    this.dodgeDirection.copy(dir);
    this.player.rotation.y = Math.atan2(dir.x, dir.z);
    this.dodgeTime = 0.3;
    if (this.currentStep() === 'dodge') this.advance();
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    window.clearInterval(this.simulationTimer);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('ninja-controls-updated', this.refreshControls);
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  private currentStep() {
    return STEP_ORDER[this.stepIndex];
  }

  private refreshControls = () => {
    this.keyBindings = getKeyBindings();
  };

  private isTimedKey(code: string) {
    return code === this.keyBindings.moveLeft
      || code === this.keyBindings.moveRight
      || code === this.keyBindings.moveUp
      || code === this.keyBindings.moveDown
      || ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(code)
      || code === this.keyBindings.block;
  }

  private keyDown = (event: KeyboardEvent) => {
    if (Object.values(this.keyBindings).includes(event.code) || ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)) event.preventDefault();
    this.simulationTick(MAX_ACTION_RECONCILE_SECONDS);
    this.keyboard.add(event.code);
    if (!event.repeat && this.isTimedKey(event.code)) {
      this.heldStartedAt.set(event.code, performance.now());
      this.heldIntegrated.set(event.code, 0);
    }
    if (event.repeat) return;
    if (event.code === this.keyBindings.punch) this.attack('punch');
    if (event.code === this.keyBindings.kick) this.attack('kick');
    if (event.code === this.keyBindings.jump) this.jump();
    if (event.code === this.keyBindings.grab) this.grab();
    if (event.code === this.keyBindings.special) this.special();
    if (event.code === this.keyBindings.dodge) this.dodge(this.input.x, this.input.y);
    if (event.code === this.keyBindings.block) this.input.block = true;
  };

  private keyUp = (event: KeyboardEvent) => {
    this.simulationTick(MAX_ACTION_RECONCILE_SECONDS);
    this.reconcileHeldInput(event.code);
    this.keyboard.delete(event.code);
    this.heldStartedAt.delete(event.code);
    this.heldIntegrated.delete(event.code);
    if (event.code === this.keyBindings.block) this.input.block = false;
  };

  private resize = () => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private simulationTick = (maxCatchup = MAX_CATCHUP_SECONDS) => {
    if (!this.running) return;
    const now = performance.now();
    const elapsed = Math.max(0, (now - this.lastSimulationAt) / 1000);
    this.lastSimulationAt = now;

    // Never keep an old catch-up backlog. A long WebGL/main-thread stall used to
    // replay movement and tutorial input after the player had already released it.
    this.simulationDebt = Math.min(maxCatchup, this.simulationDebt + elapsed);
    let remaining = this.simulationDebt;
    this.simulationDebt = 0;
    while (remaining > 0.0001) {
      const step = Math.min(FIXED_STEP, remaining);
      this.update(step);
      remaining -= step;
    }
  };

  private loop = () => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.loop);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.visualElapsed += dt;
    this.actionCooldown = Math.max(0, this.actionCooldown - dt);
    this.attackBufferTime = Math.max(0, this.attackBufferTime - dt);
    this.attackAnimationTime = Math.max(0, this.attackAnimationTime - dt);
    if (this.attackBufferTime > 0 && this.actionCooldown <= 0 && this.specialTime <= 0) {
      this.attackBufferTime = 0;
      this.attack(this.bufferedAttackKind);
    }
    this.dummyFlash = Math.max(0, this.dummyFlash - dt);
    this.markHeldIntegrated(dt);
    this.dummy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      material.emissive?.setHex(this.dummyFlash > 0 ? 0x774014 : 0x000000);
    });

    let x = this.input.x;
    let y = this.input.y;
    if (this.keyboard.has(this.keyBindings.moveLeft) || this.keyboard.has('ArrowLeft')) x -= 1;
    if (this.keyboard.has(this.keyBindings.moveRight) || this.keyboard.has('ArrowRight')) x += 1;
    if (this.keyboard.has(this.keyBindings.moveUp) || this.keyboard.has('ArrowUp')) y -= 1;
    if (this.keyboard.has(this.keyBindings.moveDown) || this.keyboard.has('ArrowDown')) y += 1;
    const move = new THREE.Vector2(x, y);
    if (move.lengthSq() > 1) move.normalize();

    if (this.dodgeTime > 0) {
      this.dodgeTime -= dt;
      this.player.position.addScaledVector(this.dodgeDirection, 11.5 * dt);
      this.player.rotation.z = Math.sin((0.3 - this.dodgeTime) * 17) * 0.22;
    } else if (this.specialTime > 0) {
      this.specialTime -= dt;
      this.specialTick -= dt;
      this.player.rotation.y += dt * 18;
      if (this.specialTick <= 0) {
        this.specialTick = 0.13;
        if (this.player.position.distanceTo(this.dummy.position) < 3.4) this.flashDummy();
      }
    } else if (move.lengthSq() > 0.01) {
      this.movePlayer(move.x, move.y, dt);
    }

    this.clampPlayerToDojo();

    if (!this.grounded) {
      this.jumpVelocity -= 19 * dt;
      this.player.position.y += this.jumpVelocity * dt;
      if (this.player.position.y <= 0) {
        this.player.position.y = 0;
        this.jumpVelocity = 0;
        this.grounded = true;
      }
    }

    if (this.input.block && this.currentStep() === 'block') this.advanceBlock(dt);

    this.shadow.position.x = this.player.position.x;
    this.shadow.position.z = this.player.position.z;
    this.shadow.scale.setScalar(Math.max(0.6, 1 - this.player.position.y * 0.07));
    this.updatePlayerPose(move);
  }

  private markHeldIntegrated(dt: number) {
    for (const code of this.keyboard) {
      if (!this.heldIntegrated.has(code)) continue;
      this.heldIntegrated.set(code, (this.heldIntegrated.get(code) ?? 0) + dt);
    }
  }

  private reconcileHeldInput(code: string) {
    const startedAt = this.heldStartedAt.get(code);
    if (startedAt === undefined) return;
    const wallSeconds = Math.min(MAX_INPUT_RECONCILE_SECONDS, Math.max(0, (performance.now() - startedAt) / 1000));
    const integrated = this.heldIntegrated.get(code) ?? 0;
    const missing = Math.max(0, wallSeconds - integrated);
    if (missing <= 0.001) return;

    const direction = this.keyDirection(code);
    if (direction) {
      this.movePlayer(direction.x, direction.y, missing);
      this.clampPlayerToDojo();
      this.shadow.position.x = this.player.position.x;
      this.shadow.position.z = this.player.position.z;
      return;
    }

    if (code === this.keyBindings.block && this.currentStep() === 'block') {
      this.advanceBlock(missing);
    }
  }

  private keyDirection(code: string) {
    if (code === this.keyBindings.moveLeft || code === 'ArrowLeft') return { x: -1, y: 0 };
    if (code === this.keyBindings.moveRight || code === 'ArrowRight') return { x: 1, y: 0 };
    if (code === this.keyBindings.moveUp || code === 'ArrowUp') return { x: 0, y: -1 };
    if (code === this.keyBindings.moveDown || code === 'ArrowDown') return { x: 0, y: 1 };
    return null;
  }

  private movePlayer(x: number, y: number, dt: number) {
    if (this.dodgeTime > 0 || this.specialTime > 0) return;
    const move = new THREE.Vector2(x, y);
    if (move.lengthSq() > 1) move.normalize();
    if (move.lengthSq() <= 0.01) return;

    const before = this.player.position.clone();
    this.player.position.x += move.x * this.character.speed * dt;
    this.player.position.z += move.y * this.character.speed * dt;
    this.player.rotation.y = Math.atan2(move.x, move.y);
    this.player.rotation.z *= Math.pow(0.01, Math.min(dt, 0.25));

    if (this.currentStep() === 'move') {
      this.moveDistance += before.distanceTo(this.player.position);
      this.callbacks.onStep('move', 'Movement', `Use the joystick/controller or ${formatKeyLabel(this.keyBindings.moveUp)}, ${formatKeyLabel(this.keyBindings.moveLeft)}, ${formatKeyLabel(this.keyBindings.moveDown)}, ${formatKeyLabel(this.keyBindings.moveRight)}.`, Math.min(1, this.moveDistance / 4.5));
      if (this.moveDistance >= 4.5) this.advance();
    }
  }

  private clampPlayerToDojo() {
    const radius = Math.hypot(this.player.position.x, this.player.position.z);
    if (radius <= 11.0) return;
    const scale = 11.0 / radius;
    this.player.position.x *= scale;
    this.player.position.z *= scale;
  }

  private advanceBlock(dt: number) {
    if (this.currentStep() !== 'block') return;
    this.blockTime += dt;
    this.callbacks.onStep('block', 'Block', `Hold the shield button, controller LB, or ${formatKeyLabel(this.keyBindings.block)} until the guard meter fills.`, Math.min(1, this.blockTime / 1.25));
    if (this.blockTime >= 1.25) this.advance();
  }

  private attack(kind: 'attack' | 'punch' | 'kick' = 'attack') {
    if (this.specialTime > 0) return;
    if (this.actionCooldown > 0) {
      this.attackBufferTime = 0.45;
      this.bufferedAttackKind = kind;
      return;
    }

    const moves = [
      { name: 'jab' as const, duration: 0.26 },
      { name: 'cross' as const, duration: 0.29 },
      { name: 'kick' as const, duration: 0.38 }
    ];
    const sequence = kind === 'punch' ? moves.slice(0, 2) : kind === 'kick' ? moves.slice(2) : moves;
    const move = sequence[this.attackMoveIndex % sequence.length];
    this.attackMoveIndex = (this.attackMoveIndex + 1) % 3;
    this.attackMove = move.name;
    this.actionCooldown = move.duration;
    this.attackAnimationDuration = move.duration;
    this.attackAnimationTime = move.duration;
    if (kind === 'kick') this.spawnElementKickFx();
    let distance = this.player.position.distanceTo(this.dummy.position);

    // Tutorial-only close-range assist: on a real device a player naturally
    // corrects the final half-step toward the dummy. With keyboard input (and
    // especially after a low-FPS catch-up) that final step can land just outside
    // the old 2.55-unit hit radius, making correct attacks appear unresponsive.
    // A nearby strike now faces the dummy and takes a short lunge, while attacks
    // from genuinely far away still miss and require movement.
    if (this.currentStep() === 'attack' && distance > 2.55 && distance <= 3.8) {
      const towardDummy = this.dummy.position.clone().sub(this.player.position).setY(0);
      if (towardDummy.lengthSq() > 0.001) {
        towardDummy.normalize();
        this.player.rotation.y = Math.atan2(towardDummy.x, towardDummy.z);
        this.player.position.addScaledVector(towardDummy, Math.min(0.9, Math.max(0, distance - 2.35)));
        this.clampPlayerToDojo();
        distance = this.player.position.distanceTo(this.dummy.position);
      }
    }

    if (distance <= 2.7) {
      this.flashDummy();
      this.meter = Math.min(100, this.meter + 25);
      this.callbacks.onMeter(this.meter);
      if (this.currentStep() === 'attack') {
        this.attackHits += 1;
        this.callbacks.onStep('attack', 'Attack', 'Move close to the training dummy and land three attacks.', Math.min(1, this.attackHits / 3));
        if (this.attackHits >= 3) this.advance();
      }
    }
  }

  private spawnElementKickFx() {
    const theme = getElementCombatTheme(this.character.element);
    const forward = new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.9, 36),
      new THREE.MeshBasicMaterial({ color: theme.color, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(this.player.position).addScaledVector(forward, 1.25).setY(0.06);
    ring.scale.setScalar(0.2);
    this.scene.add(ring);
    const started = performance.now();
    const animate = () => {
      if (!this.running) { this.scene.remove(ring); return; }
      const t = Math.min(1, (performance.now() - started) / 300);
      ring.scale.setScalar(0.2 + t * 2.5);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.82 * (1 - t);
      ring.rotation.z += 0.09;
      if (t >= 1) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      } else requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }


  private updatePlayerPose(move: THREE.Vector2) {
    const leftArm = this.player.getObjectByName('leftArm');
    const rightArm = this.player.getObjectByName('rightArm');
    const leftLeg = this.player.getObjectByName('leftLeg');
    const rightLeg = this.player.getObjectByName('rightLeg');
    const torso = this.player.getObjectByName('torso');

    const moving = Math.min(1, move.length());
    const walk = Math.sin(this.visualElapsed * 11) * 0.42 * moving;
    const progress = this.attackAnimationTime > 0
      ? THREE.MathUtils.clamp(1 - this.attackAnimationTime / this.attackAnimationDuration, 0, 1)
      : 0;
    const pulse = progress > 0 ? Math.sin(Math.PI * progress) : 0;

    if (leftLeg && rightLeg) {
      leftLeg.rotation.x = walk;
      rightLeg.rotation.x = -walk;
      leftLeg.rotation.z = 0;
      rightLeg.rotation.z = 0;
      if (!this.grounded) {
        leftLeg.rotation.x = -0.28;
        rightLeg.rotation.x = 0.34;
      } else if (pulse > 0 && this.attackMove === 'kick') {
        rightLeg.rotation.x = -1.35 * pulse;
        rightLeg.rotation.z = 0.18 * pulse;
        leftLeg.rotation.x = 0.16 * pulse;
      }
    }

    if (leftArm && rightArm) {
      leftArm.rotation.x = -walk * 0.8;
      rightArm.rotation.x = walk * 0.8;
      leftArm.rotation.z = -0.22;
      rightArm.rotation.z = 0.22;

      if (this.input.block) {
        leftArm.rotation.x = -1.05;
        rightArm.rotation.x = -1.05;
        leftArm.rotation.z = -0.56;
        rightArm.rotation.z = 0.56;
      } else if (pulse > 0 && this.attackMove === 'jab') {
        rightArm.rotation.x = -1.5 * pulse;
        rightArm.rotation.z = 0.22 + 0.38 * pulse;
        leftArm.rotation.x = -0.65 * pulse;
        leftArm.rotation.z = -0.48;
      } else if (pulse > 0 && this.attackMove === 'cross') {
        leftArm.rotation.x = -1.5 * pulse;
        leftArm.rotation.z = -0.22 - 0.38 * pulse;
        rightArm.rotation.x = -0.62 * pulse;
        rightArm.rotation.z = 0.48;
      } else if (pulse > 0 && this.attackMove === 'kick') {
        leftArm.rotation.x = -0.78 * pulse;
        rightArm.rotation.x = -0.78 * pulse;
        leftArm.rotation.z = -0.48;
        rightArm.rotation.z = 0.48;
      } else if (!this.grounded) {
        leftArm.rotation.x = -0.7;
        rightArm.rotation.x = -0.7;
      }
    }

    if (torso) {
      torso.rotation.y = this.attackMove === 'cross' ? pulse * 0.3 : pulse * -0.18;
      torso.rotation.z = this.attackMove === 'kick' ? pulse * 0.1 : 0;
    }
  }

  private jump() {
    if (!this.grounded || this.specialTime > 0) return;
    this.grounded = false;
    this.jumpVelocity = 7.2;
    if (this.currentStep() === 'jump') this.advance();
  }

  private grab() {
    if (this.actionCooldown > 0 || this.player.position.distanceTo(this.dummy.position) > 2.1) return;
    this.actionCooldown = 0.7;
    const direction = this.dummy.position.clone().sub(this.player.position).setY(0).normalize();
    this.dummy.position.addScaledVector(direction, 2.2);
    this.flashDummy();
    if (this.currentStep() === 'grab') this.advance();
  }

  private special() {
    if (this.currentStep() !== 'special' || this.meter < 100 || this.specialTime > 0) return;
    this.meter = 0;
    this.callbacks.onMeter(0);
    this.specialTime = 1.5;
    this.specialTick = 0;
    this.advance();
  }

  private flashDummy() {
    this.dummyFlash = 0.14;
    this.dummy.rotation.z = (Math.random() - 0.5) * 0.24;
    window.setTimeout(() => { if (this.running) this.dummy.rotation.z = 0; }, 120);
  }

  private advance() {
    this.stepIndex = Math.min(STEP_ORDER.length - 1, this.stepIndex + 1);
    if (this.currentStep() === 'special') {
      this.meter = 100;
      this.callbacks.onMeter(100);
    }
    this.announceStep();
    if (this.currentStep() === 'complete' && !this.completeSent) {
      this.completeSent = true;
      window.setTimeout(() => { if (this.running) this.callbacks.onComplete(); }, 800);
    }
  }

  private announceStep() {
    const step = this.currentStep();
    const copy: Record<DojoStep, [string, string]> = {
      move: ['Movement', `Use the joystick/controller or ${formatKeyLabel(this.keyBindings.moveUp)}, ${formatKeyLabel(this.keyBindings.moveLeft)}, ${formatKeyLabel(this.keyBindings.moveDown)}, ${formatKeyLabel(this.keyBindings.moveRight)}.`],
      attack: ['Attack', `Move close and land three strikes. Punch: ${formatKeyLabel(this.keyBindings.punch)} · Kick: ${formatKeyLabel(this.keyBindings.kick)}.`],
      jump: ['Jump', `Press jump, controller RB, or ${formatKeyLabel(this.keyBindings.jump)}.`],
      block: ['Block', `Hold shield, controller LB, or ${formatKeyLabel(this.keyBindings.block)}.`],
      grab: ['Grab & Throw', `Move close and press grab / controller X / ${formatKeyLabel(this.keyBindings.grab)}.`],
      dodge: ['Dodge', `Swipe, controller B, or ${formatKeyLabel(this.keyBindings.dodge)}.`],
      special: ['Spinjitzu / Special', `Meter full: spiral button, controller Y, or ${formatKeyLabel(this.keyBindings.special)}.`],
      complete: ['Training Complete', 'You have learned the core tournament controls.']
    };
    this.callbacks.onStep(step, copy[step][0], copy[step][1], step === 'complete' ? 1 : 0);
  }

  private buildDojo() {
    this.scene.add(new THREE.HemisphereLight(0xc4d8ff, 0x2f211a, 1.45));
    const sun = new THREE.DirectionalLight(0xffd9a0, 3.0);
    sun.position.set(-6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -13;
    sun.shadow.camera.right = 13;
    sun.shadow.camera.top = 13;
    sun.shadow.camera.bottom = -13;
    this.scene.add(sun);

    const wood = new THREE.MeshPhysicalMaterial({ color: 0x72472d, roughness: 0.62, clearcoat: 0.18, clearcoatRoughness: 0.42 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x38251f, roughness: 0.84 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x4c4844, roughness: 0.94 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xcdbd9f, roughness: 0.82 });
    const red = new THREE.MeshStandardMaterial({ color: 0x7e2930, roughness: 0.72 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xb88a31, roughness: 0.4, metalness: 0.42 });

    const floor = new THREE.Mesh(new THREE.CylinderGeometry(12.4, 12.4, 0.38, 72), stone);
    floor.position.y = -0.22;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Wooden sparring deck in the middle.
    for (let row = -8; row <= 8; row++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.08, 0.78), row % 2 ? wood : darkWood);
      plank.position.set(0, 0.025, row * 0.8);
      plank.receiveShadow = true;
      this.scene.add(plank);
    }
    const deckBorder = new THREE.Mesh(
      new THREE.RingGeometry(8.25, 8.52, 72),
      new THREE.MeshBasicMaterial({ color: 0xa77b2d, transparent: true, opacity: 0.74, side: THREE.DoubleSide, depthWrite: false })
    );
    deckBorder.rotation.x = -Math.PI / 2;
    deckBorder.position.y = 0.09;
    this.scene.add(deckBorder);

    // Timber-and-plaster dojo perimeter.
    for (let i = 0; i < 14; i++) {
      const angle = i / 14 * Math.PI * 2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.65, 0.46), i % 2 ? cream : darkWood);
      wall.position.set(Math.cos(angle) * 13.65, 1.2, Math.sin(angle) * 13.65);
      wall.rotation.y = -angle + Math.PI / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, 0.52), wood);
      beam.position.set(Math.cos(angle) * 13.5, 2.48, Math.sin(angle) * 13.5);
      beam.rotation.y = -angle + Math.PI / 2;
      beam.castShadow = true;
      this.scene.add(beam);
    }

    // Four corner lantern posts and warm light pools.
    for (const pos of [[-8.1,-7.2],[8.1,-7.2],[-8.1,7.2],[8.1,7.2]] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.24,3.1,10), wood);
      post.position.set(pos[0],1.55,pos[1]);
      post.castShadow = true;
      this.scene.add(post);

      const lanternFrame = new THREE.Mesh(new THREE.BoxGeometry(0.54,0.7,0.54), darkWood);
      lanternFrame.position.set(pos[0],2.7,pos[1]);
      const lanternGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.38,0.54,0.38),
        new THREE.MeshBasicMaterial({ color:0xffbd65, transparent:true, opacity:0.78 })
      );
      lanternGlow.position.copy(lanternFrame.position);
      this.scene.add(lanternFrame,lanternGlow);
      const lamp = new THREE.PointLight(0xff9f4e,3.0,6,2);
      lamp.position.set(pos[0],2.65,pos[1]);
      this.scene.add(lamp);
    }

    // Hanging tournament-era banners.
    for (const side of [-1,1] as const) {
      const banner = new THREE.Mesh(new THREE.BoxGeometry(1.45,2.7,0.08), side < 0 ? red : new THREE.MeshStandardMaterial({color:0x563568,roughness:0.72}));
      banner.position.set(side * 9.7,3.25,-8.3);
      banner.rotation.y = side * -0.08;
      const medallion = new THREE.Mesh(new THREE.TorusGeometry(0.28,0.06,8,24),gold);
      medallion.position.set(side * 9.7,3.35,-8.23);
      this.scene.add(banner,medallion);
    }

    // Weapon racks and practice bags make the room read as a training space.
    for (const side of [-1,1] as const) {
      const rack = new THREE.Group();
      const uprightA = new THREE.Mesh(new THREE.BoxGeometry(0.14,1.8,0.14),wood);
      const uprightB = uprightA.clone();
      uprightA.position.x=-0.65; uprightB.position.x=0.65;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.55,0.14,0.14),wood);
      bar.position.y=0.55;
      rack.add(uprightA,uprightB,bar);
      for(let i=0;i<3;i++){
        const staff=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,1.85,8),i===1?gold:darkWood);
        staff.position.set(-0.45+i*0.45,0.5,0.05);
        staff.rotation.z=-0.1+i*0.1;
        rack.add(staff);
      }
      rack.position.set(side*9.25,0.9,5.7);
      rack.rotation.y=side>0?-Math.PI/2:Math.PI/2;
      rack.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=true;});
      this.scene.add(rack);
    }

    for(const [x,z] of [[-9.0,-1.9],[9.0,1.9]] as const){
      const bagGroup=new THREE.Group();
      const post=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,2.4,8),wood);
      post.position.y=1.2;
      const bag=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.43,1.05,14),red);
      bag.position.set(0.48,1.45,0);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.1,0.12),wood);
      arm.position.set(0.24,2.25,0);
      bagGroup.add(post,bag,arm);
      bagGroup.position.set(x,0,z);
      bagGroup.rotation.y=x>0?Math.PI:0;
      bagGroup.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=true;});
      this.scene.add(bagGroup);
    }

    // Sensei platform at the far side, visually echoing the tutorial screenshots.
    const platform=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.35,2.3),darkWood);
    platform.position.set(0,0.18,-9.65);
    const mat=new THREE.Mesh(new THREE.BoxGeometry(3.35,0.08,1.55),red);
    mat.position.set(0,0.39,-9.55);
    this.scene.add(platform,mat);
  }


}
