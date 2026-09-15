import * as THREE from 'three';

export type GraphicsPreference = 'auto' | 'safe' | 'balanced' | 'high';
type ResolvedMode = 'safe' | 'balanced' | 'high';

interface GraphicsProfile {
  mode: ResolvedMode;
  label: string;
  pixelRatio: number;
  maxFps: number;
  shadows: boolean;
  antialias: boolean;
  powerPreference: WebGLPowerPreference;
  sceneDress: 'lite' | 'full';
}

const PREF_KEY = 'ninja-tournament-graphics-v1';
const RECOVERY_KEY = 'ninja-tournament-gpu-recovery-v1';
const RENDER_GUARD_KEY = 'ninja-tournament-render-guard-v1';
const STABLE_TIMER_MS = 18000;

// Read this once. An accelerated render sets the guard for the *next* launch;
// it must not force the current healthy render back to Safe immediately.
const RECOVERY_AT_BOOT = localStorage.getItem(RECOVERY_KEY) === '1' || localStorage.getItem(RENDER_GUARD_KEY) === 'armed';

const SAFE: GraphicsProfile = {
  mode: 'safe',
  label: 'Safe',
  pixelRatio: 1,
  maxFps: 30,
  shadows: false,
  antialias: false,
  powerPreference: 'low-power',
  sceneDress: 'lite'
};

const BALANCED: GraphicsProfile = {
  mode: 'balanced',
  label: 'Balanced',
  pixelRatio: 1.35,
  maxFps: 60,
  shadows: true,
  antialias: true,
  powerPreference: 'default',
  sceneDress: 'full'
};

const HIGH: GraphicsProfile = {
  mode: 'high',
  label: 'High',
  pixelRatio: 2,
  maxFps: 60,
  shadows: true,
  antialias: true,
  powerPreference: 'high-performance',
  sceneDress: 'full'
};

function readPreference(): GraphicsPreference {
  const value = localStorage.getItem(PREF_KEY);
  return value === 'safe' || value === 'balanced' || value === 'high' || value === 'auto' ? value : 'auto';
}

export function getGraphicsProfile(): GraphicsProfile {
  if (RECOVERY_AT_BOOT) return SAFE;
  const preference = readPreference();
  if (preference === 'balanced') return BALANCED;
  if (preference === 'high') return HIGH;
  // Auto and a fresh install deliberately start Safe. This is conservative by
  // design: the user can prove the machine stable before opting into more GPU load.
  return SAFE;
}

function setPreference(preference: GraphicsPreference) {
  localStorage.setItem(PREF_KEY, preference);
  localStorage.removeItem(RECOVERY_KEY);
  localStorage.removeItem(RENDER_GUARD_KEY);
}

function markGpuRecovery() {
  localStorage.setItem(RECOVERY_KEY, '1');
  localStorage.setItem(RENDER_GUARD_KEY, 'armed');
  document.documentElement.dataset.gpuRecovery = 'true';
}

function armRenderGuard(profile: GraphicsProfile) {
  if (profile.mode !== 'safe') localStorage.setItem(RENDER_GUARD_KEY, 'armed');
}

function clearRenderGuard() {
  localStorage.removeItem(RENDER_GUARD_KEY);
}

const frameTimes = new WeakMap<THREE.WebGLRenderer, number>();
const stableSince = new WeakMap<THREE.WebGLRenderer, number>();

// THREE requests its WebGL context inside the renderer constructor. Intercepting
// this one browser API lets Safe mode neutralize antialiasing and the game's old
// high-performance GPU request before the context is created.
type LooseCanvasGetContext = (this: HTMLCanvasElement, type: string, attributes?: any) => any;
const canvasPrototype = HTMLCanvasElement.prototype as unknown as { getContext: LooseCanvasGetContext };
const originalGetContext = canvasPrototype.getContext;

canvasPrototype.getContext = function patchedGetContext(
  this: HTMLCanvasElement,
  type: string,
  attributes?: any
): any {
  const profile = getGraphicsProfile();
  const isWebGl = type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl';
  if (!isWebGl) return originalGetContext.call(this, type, attributes);

  armRenderGuard(profile);
  if (!this.dataset.gpuGuardWired) {
    this.dataset.gpuGuardWired = 'true';
    this.addEventListener('webglcontextlost', (event: Event) => {
      event.preventDefault();
      markGpuRecovery();
    });
  }

  const baseAttributes = attributes && typeof attributes === 'object' ? attributes : {};
  const guardedAttributes: WebGLContextAttributes = {
    ...baseAttributes,
    antialias: profile.antialias,
    powerPreference: profile.powerPreference,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false
  };
  return originalGetContext.call(this, type, guardedAttributes);
};

const rendererPrototype = THREE.WebGLRenderer.prototype as unknown as {
  setPixelRatio: (value: number) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
};
const originalSetPixelRatio = rendererPrototype.setPixelRatio;
const originalRender = rendererPrototype.render;

rendererPrototype.setPixelRatio = function guardedPixelRatio(this: THREE.WebGLRenderer, value: number) {
  const profile = getGraphicsProfile();
  originalSetPixelRatio.call(this, Math.min(value, profile.pixelRatio));
};

rendererPrototype.render = function guardedRender(this: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const profile = getGraphicsProfile();
  if (this.shadowMap.enabled !== profile.shadows) this.shadowMap.enabled = profile.shadows;

  const now = performance.now();
  const minimumFrameTime = 1000 / profile.maxFps;
  const last = frameTimes.get(this) ?? 0;
  if (last > 0 && now - last < minimumFrameTime - 1) return;
  frameTimes.set(this, now);

  if (!scene.userData.cleanRoomTempleDress) enhanceScene(scene, profile);
  enhanceFighters(scene, profile);

  if (!stableSince.has(this)) stableSince.set(this, now);
  const stableAt = stableSince.get(this) ?? now;
  if (profile.mode !== 'safe' && now - stableAt >= STABLE_TIMER_MS) clearRenderGuard();

  originalRender.call(this, scene, camera);
};

function material(color: number, roughness = 0.72, metalness = 0.03) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addTempleGate(parent: THREE.Group, x: number, z: number, rotation: number, lite: boolean) {
  const red = material(0x751f1d, 0.68);
  const dark = material(0x1c1718, 0.82);
  const gold = material(0xd1a13a, 0.4, 0.42);
  const gate = new THREE.Group();
  gate.position.set(x, 0, z);
  gate.rotation.y = rotation;

  for (const sx of [-1.45, 1.45]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.9, 0.34), red);
    post.position.set(sx, 1.95, 0);
    gate.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.38, 0.52), dark);
  beam.position.y = 3.65;
  gate.add(beam);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.22, 0.72), red);
  crown.position.y = 4.04;
  gate.add(crown);
  if (!lite) {
    const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20), gold);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(0, 3.65, -0.34);
    gate.add(medallion);
  }
  gate.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = !lite;
      node.receiveShadow = !lite;
    }
  });
  parent.add(gate);
}

function addBanner(parent: THREE.Group, angle: number, lite: boolean) {
  const radius = 11.6;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.9, 8), material(0x241b19, 0.85));
  pole.position.set(x, 1.45, z);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 1.55),
    new THREE.MeshStandardMaterial({
      color: 0x8f211f,
      side: THREE.DoubleSide,
      roughness: 0.74,
      emissive: lite ? 0x000000 : 0x170302
    })
  );
  banner.position.set(x, 2.15, z);
  banner.rotation.y = -angle + Math.PI / 2;
  parent.add(pole, banner);
}

function enhanceScene(scene: THREE.Scene, profile: GraphicsProfile) {
  scene.userData.cleanRoomTempleDress = true;
  const dress = new THREE.Group();
  dress.name = 'clean-room-temple-dress';
  const lite = profile.sceneDress === 'lite';

  const emblem = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 3.38, lite ? 32 : 64),
    new THREE.MeshBasicMaterial({
      color: 0xc9972d,
      transparent: true,
      opacity: lite ? 0.24 : 0.38,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.y = 0.055;
  dress.add(emblem);

  addTempleGate(dress, 0, -14.2, 0, lite);
  addTempleGate(dress, 14.2, 0, -Math.PI / 2, lite);
  if (!lite) {
    addTempleGate(dress, 0, 14.2, Math.PI, false);
    addTempleGate(dress, -14.2, 0, Math.PI / 2, false);
  }

  const bannerCount = lite ? 4 : 8;
  for (let i = 0; i < bannerCount; i++) addBanner(dress, (i / bannerCount) * Math.PI * 2 + Math.PI / 8, lite);

  if (!lite) {
    for (const [x, z] of [[-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6]] as const) {
      const lantern = new THREE.PointLight(0xff842d, 1.9, 5.5, 2);
      lantern.position.set(x, 2.15, z);
      dress.add(lantern);
    }
  }

  scene.add(dress);
}

function looksLikeFighter(group: THREE.Group) {
  const directMeshes = group.children.filter((child) => child instanceof THREE.Mesh);
  return directMeshes.length >= 8 && directMeshes.length <= 13 && group.position.y < 2;
}

function enhanceFighters(scene: THREE.Scene, profile: GraphicsProfile) {
  scene.traverse((node) => {
    if (!(node instanceof THREE.Group) || node.userData.cleanRoomFighterStyled || !looksLikeFighter(node)) return;
    node.userData.cleanRoomFighterStyled = true;

    const dark = material(0x151519, 0.78);
    const gold = material(0xc99832, 0.44, 0.32);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, 0.58), dark);
    shoulder.position.set(0, 1.62, 0);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 16), gold);
    crest.rotation.x = Math.PI / 2;
    crest.position.set(0, 1.34, 0.27);
    node.add(shoulder, crest);

    if (profile.mode !== 'safe') {
      const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.08), dark);
      scarf.position.set(0.27, 1.34, -0.35);
      scarf.rotation.z = -0.24;
      scarf.rotation.x = 0.34;
      node.add(scarf);
    }
  });
}

function modeDescription(profile: GraphicsProfile) {
  if (profile.mode === 'safe') return '30 FPS · 1× render scale · low-power GPU · shadows off';
  if (profile.mode === 'balanced') return '60 FPS · 1.35× render scale · shadows on';
  return '60 FPS · up to 2× render scale · high-performance GPU';
}

function mountGraphicsUi() {
  const button = document.createElement('button');
  button.id = 'graphics-settings-button';
  button.className = 'graphics-settings-button';
  button.type = 'button';
  document.body.appendChild(button);

  const refreshButton = () => {
    const profile = getGraphicsProfile();
    button.dataset.mode = profile.mode;
    button.textContent = `◈ ${profile.label.toUpperCase()} GPU`;
    button.hidden = !document.querySelector('main.menu-screen, main.panel-screen');
    document.documentElement.dataset.graphics = profile.mode;
  };

  const showSettings = () => {
    document.querySelector('#graphics-settings-overlay')?.remove();
    const profile = getGraphicsProfile();
    const preference = readPreference();
    const overlay = document.createElement('div');
    overlay.id = 'graphics-settings-overlay';
    overlay.className = 'graphics-settings-overlay';
    overlay.innerHTML = `
      <section class="graphics-settings-panel">
        <header><div><small>DEVICE PROTECTION</small><h2>Graphics Mode</h2></div><button id="graphics-close" aria-label="Close">×</button></header>
        ${RECOVERY_AT_BOOT ? '<div class="gpu-recovery-note"><b>SAFE FALLBACK ACTIVE</b><span>The previous accelerated session did not finish cleanly, so this launch has been protected automatically.</span></div>' : ''}
        <p class="graphics-current">Current renderer: <strong>${profile.label}</strong> · ${modeDescription(profile)}</p>
        <div class="graphics-mode-grid">
          <button data-graphics="auto" class="${preference === 'auto' ? 'active' : ''}"><b>AUTO SAFE</b><span>Recommended first launch. Keeps GPU recovery enabled and starts conservatively.</span></button>
          <button data-graphics="safe" class="${preference === 'safe' ? 'active' : ''}"><b>SAFE</b><span>30 FPS, 1× resolution, low-power GPU, no realtime shadows.</span></button>
          <button data-graphics="balanced" class="${preference === 'balanced' ? 'active' : ''}"><b>BALANCED</b><span>60 FPS, better lighting and detail with a moderate GPU load.</span></button>
          <button data-graphics="high" class="${preference === 'high' ? 'active' : ''}"><b>HIGH</b><span>Best visuals. Only use this after Balanced is stable on your laptop.</span></button>
        </div>
        <p class="graphics-warning">Changing mode reloads the game so WebGL can recreate the renderer safely.</p>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#graphics-close')?.addEventListener('click', () => overlay.remove());
    overlay.querySelectorAll<HTMLButtonElement>('[data-graphics]').forEach((choice) => {
      choice.addEventListener('click', () => {
        setPreference(choice.dataset.graphics as GraphicsPreference);
        location.reload();
      });
    });
  };

  button.addEventListener('click', showSettings);
  const observer = new MutationObserver(refreshButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refreshButton();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountGraphicsUi);
else mountGraphicsUi();
