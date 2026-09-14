import * as THREE from 'three';
import type { CharacterDef } from './roster';

export type DojoAction = 'attack' | 'jump' | 'grab' | 'special';
export type DojoStep = 'move' | 'attack' | 'jump' | 'block' | 'grab' | 'dodge' | 'special' | 'complete';

export interface DojoCallbacks {
  onStep: (step: DojoStep, title: string, instruction: string, progress: number) => void;
  onMeter: (value: number) => void;
  onComplete: () => void;
}

const STEP_ORDER: DojoStep[] = ['move', 'attack', 'jump', 'block', 'grab', 'dodge', 'special', 'complete'];

export class DojoGame {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(47, 1, 0.1, 70);
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private player: THREE.Group;
  private dummy: THREE.Group;
  private shadow: THREE.Mesh;
  private frame = 0;
  private running = true;
  private keyboard = new Set<string>();
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

    this.scene.background = new THREE.Color(0x18212a);
    this.scene.fog = new THREE.FogExp2(0x18212a, 0.032);
    this.buildDojo();
    this.player = this.createFighter(character.color, character.accent, 1);
    this.player.position.set(-3.5, 0, 2.8);
    this.scene.add(this.player);
    this.dummy = this.createFighter(0x553946, 0xcda85d, 0.96);
    this.dummy.position.set(2.8, 0, -1.8);
    this.dummy.rotation.y = Math.PI;
    this.scene.add(this.dummy);

    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.scene.add(this.shadow);

    this.camera.position.set(11, 13, 12);
    this.camera.lookAt(0, 0.7, 0);
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    this.resize();
    this.announceStep();
    this.loop();
  }

  setMove(x: number, y: number) {
    this.input.x = Math.max(-1, Math.min(1, x));
    this.input.y = Math.max(-1, Math.min(1, y));
  }

  setBlock(active: boolean) {
    this.input.block = active;
  }

  action(action: DojoAction) {
    if (action === 'attack') this.attack();
    if (action === 'jump') this.jump();
    if (action === 'grab') this.grab();
    if (action === 'special') this.special();
  }

  dodge(x = 0, y = 0) {
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
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  private currentStep() {
    return STEP_ORDER[this.stepIndex];
  }

  private keyDown = (event: KeyboardEvent) => {
    this.keyboard.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'KeyJ') this.attack();
    if (event.code === 'KeyK') this.jump();
    if (event.code === 'KeyL') this.grab();
    if (event.code === 'KeyE') this.special();
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
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.04);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.actionCooldown = Math.max(0, this.actionCooldown - dt);
    this.dummyFlash = Math.max(0, this.dummyFlash - dt);
    this.dummy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      material.emissive?.setHex(this.dummyFlash > 0 ? 0x774014 : 0x000000);
    });

    let x = this.input.x;
    let y = this.input.y;
    if (this.keyboard.has('KeyA') || this.keyboard.has('ArrowLeft')) x -= 1;
    if (this.keyboard.has('KeyD') || this.keyboard.has('ArrowRight')) x += 1;
    if (this.keyboard.has('KeyW') || this.keyboard.has('ArrowUp')) y -= 1;
    if (this.keyboard.has('KeyS') || this.keyboard.has('ArrowDown')) y += 1;
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
      const before = this.player.position.clone();
      this.player.position.x += move.x * this.character.speed * dt;
      this.player.position.z += move.y * this.character.speed * dt;
      this.player.rotation.y = Math.atan2(move.x, move.y);
      this.player.rotation.z *= Math.pow(0.01, dt);
      if (this.currentStep() === 'move') {
        this.moveDistance += before.distanceTo(this.player.position);
        this.callbacks.onStep('move', 'Movement', 'Use the joystick or WASD / arrow keys. Move around the dojo.', Math.min(1, this.moveDistance / 4.5));
        if (this.moveDistance >= 4.5) this.advance();
      }
    }

    const radius = Math.hypot(this.player.position.x, this.player.position.z);
    if (radius > 8.5) {
      const scale = 8.5 / radius;
      this.player.position.x *= scale;
      this.player.position.z *= scale;
    }

    if (!this.grounded) {
      this.jumpVelocity -= 19 * dt;
      this.player.position.y += this.jumpVelocity * dt;
      if (this.player.position.y <= 0) {
        this.player.position.y = 0;
        this.jumpVelocity = 0;
        this.grounded = true;
      }
    }

    if (this.input.block && this.currentStep() === 'block') {
      this.blockTime += dt;
      this.callbacks.onStep('block', 'Block', 'Hold the shield button or Shift until the guard meter fills.', Math.min(1, this.blockTime / 1.25));
      if (this.blockTime >= 1.25) this.advance();
    }

    this.shadow.position.x = this.player.position.x;
    this.shadow.position.z = this.player.position.z;
    this.shadow.scale.setScalar(Math.max(0.6, 1 - this.player.position.y * 0.07));
  }

  private attack() {
    if (this.actionCooldown > 0 || this.specialTime > 0) return;
    this.actionCooldown = 0.28;
    const distance = this.player.position.distanceTo(this.dummy.position);
    if (distance <= 2.55) {
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
      move: ['Movement', 'Use the joystick or WASD / arrow keys. Move around the dojo.'],
      attack: ['Attack', 'Move close to the training dummy and land three attacks.'],
      jump: ['Jump', 'Press the jump button or K.'],
      block: ['Block', 'Hold the shield button or Shift until the guard meter fills.'],
      grab: ['Grab & Throw', 'Move close to the dummy and press grab / L.'],
      dodge: ['Dodge', 'Swipe across the dojo or press Q to evade.'],
      special: ['Special', 'Your meter is full. Activate your special with the spiral button or E.'],
      complete: ['Training Complete', 'You have learned the core tournament controls.']
    };
    this.callbacks.onStep(step, copy[step][0], copy[step][1], step === 'complete' ? 1 : 0);
  }

  private buildDojo() {
    this.scene.add(new THREE.HemisphereLight(0xbdd9ff, 0x30261f, 1.6));
    const sun = new THREE.DirectionalLight(0xffdfac, 3.1);
    sun.position.set(-6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const floor = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 0.38, 48), new THREE.MeshStandardMaterial({ color: 0x5b554d, roughness: 0.93 }));
    floor.position.y = -0.22;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const mat = new THREE.MeshStandardMaterial({ color: 0x443831, roughness: 0.92 });
    for (let i = 0; i < 14; i++) {
      const angle = i / 14 * Math.PI * 2;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.4, 0.42), mat);
      wall.position.set(Math.cos(angle) * 10.5, 1.1, Math.sin(angle) * 10.5);
      wall.rotation.y = -angle + Math.PI / 2;
      wall.castShadow = true;
      this.scene.add(wall);
    }
    for (const pos of [[-5.8,-5.2],[5.8,-5.2],[-5.8,5.2],[5.8,5.2]] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.24,2.8,8), new THREE.MeshStandardMaterial({ color:0x7b3f28, roughness:.8 }));
      post.position.set(pos[0],1.4,pos[1]);
      post.castShadow = true;
      this.scene.add(post);
      const lamp = new THREE.PointLight(0xff9f4e,2.7,5,2);
      lamp.position.set(pos[0],2.3,pos[1]);
      this.scene.add(lamp);
    }
  }

  private createFighter(primary: number, accent: number, scale: number) {
    const group = new THREE.Group();
    const p = new THREE.MeshStandardMaterial({ color: primary, roughness: 0.62 });
    const a = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.54 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c64f, roughness: 0.58 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.72 });
    const meshes = [
      [new THREE.BoxGeometry(.86,.92,.48), p, [0,1.28,0]],
      [new THREE.BoxGeometry(.92,.16,.52), a, [0,.88,0]],
      [new THREE.CylinderGeometry(.34,.34,.48,16), skin, [0,2,0]],
      [new THREE.BoxGeometry(.72,.24,.5), p, [0,2.03,.02]],
      [new THREE.BoxGeometry(.73,.12,.52), dark, [0,2.1,.01]],
      [new THREE.BoxGeometry(.32,.72,.42), p, [-.23,.45,0]],
      [new THREE.BoxGeometry(.32,.72,.42), p, [.23,.45,0]],
      [new THREE.BoxGeometry(.22,.72,.24), p, [-.58,1.3,0]],
      [new THREE.BoxGeometry(.22,.72,.24), p, [.58,1.3,0]]
    ] as const;
    for (const [geometry, material, position] of meshes) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    group.scale.setScalar(scale);
    return group;
  }
}
