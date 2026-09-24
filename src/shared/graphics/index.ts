import * as THREE from 'three';

export type GraphicsPreference = 'auto' | 'safe' | 'balanced' | 'high';
export type ResolvedGraphicsMode = 'safe' | 'balanced' | 'high';

export interface GraphicsProfile {
  mode: ResolvedGraphicsMode;
  label: string;
  pixelRatio: number;
  maxFps: number;
  shadows: boolean;
  antialias: boolean;
  powerPreference: WebGLPowerPreference;
}

const PREF_KEY = 'ninja-tournament-graphics-v2';
const RECOVERY_KEY = 'ninja-tournament-gpu-recovery-v2';
const RENDER_GUARD_KEY = 'ninja-tournament-render-guard-v2';
const STABLE_TIMER_MS = 18_000;

const recoveryAtBoot =
  localStorage.getItem(RECOVERY_KEY) === '1' ||
  localStorage.getItem(RENDER_GUARD_KEY) === 'armed';

const SAFE: GraphicsProfile = {
  mode: 'safe',
  label: 'Safe',
  pixelRatio: 1,
  maxFps: 30,
  shadows: false,
  antialias: false,
  powerPreference: 'low-power'
};

const BALANCED: GraphicsProfile = {
  mode: 'balanced',
  label: 'Balanced',
  pixelRatio: 1.35,
  maxFps: 60,
  shadows: true,
  antialias: true,
  powerPreference: 'default'
};

const HIGH: GraphicsProfile = {
  mode: 'high',
  label: 'High',
  pixelRatio: 2,
  maxFps: 60,
  shadows: true,
  antialias: true,
  powerPreference: 'high-performance'
};

export function readGraphicsPreference(): GraphicsPreference {
  const value = localStorage.getItem(PREF_KEY);
  return value === 'auto' || value === 'safe' || value === 'balanced' || value === 'high'
    ? value
    : 'auto';
}

export function getGraphicsProfile(): GraphicsProfile {
  if (recoveryAtBoot) return SAFE;
  const preference = readGraphicsPreference();
  if (preference === 'balanced') return BALANCED;
  if (preference === 'high') return HIGH;
  return SAFE;
}

export function setGraphicsPreference(preference: GraphicsPreference) {
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

type LooseCanvasGetContext = (this: HTMLCanvasElement, type: string, attributes?: unknown) => unknown;
const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
  getContext: LooseCanvasGetContext;
};
const originalGetContext = canvasPrototype.getContext;

canvasPrototype.getContext = function patchedGetContext(
  this: HTMLCanvasElement,
  type: string,
  attributes?: unknown
) {
  const isWebGl = type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl';
  if (!isWebGl) return originalGetContext.call(this, type, attributes);

  const profile = getGraphicsProfile();
  armRenderGuard(profile);

  if (!this.dataset.gpuGuardWired) {
    this.dataset.gpuGuardWired = 'true';
    this.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      markGpuRecovery();
    });
  }

  const baseAttributes = attributes && typeof attributes === 'object'
    ? attributes as WebGLContextAttributes
    : {};

  return originalGetContext.call(this, type, {
    ...baseAttributes,
    antialias: profile.antialias,
    powerPreference: profile.powerPreference,
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false
  });
};

const frameTimes = new WeakMap<THREE.WebGLRenderer, number>();
const stableSince = new WeakMap<THREE.WebGLRenderer, number>();

const rendererPrototype = THREE.WebGLRenderer.prototype as unknown as {
  setPixelRatio: (value: number) => void;
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
};
const originalSetPixelRatio = rendererPrototype.setPixelRatio;
const originalRender = rendererPrototype.render;

rendererPrototype.setPixelRatio = function guardedPixelRatio(
  this: THREE.WebGLRenderer,
  value: number
) {
  originalSetPixelRatio.call(this, Math.min(value, getGraphicsProfile().pixelRatio));
};

rendererPrototype.render = function guardedRender(
  this: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
) {
  const profile = getGraphicsProfile();
  if (this.shadowMap.enabled !== profile.shadows) this.shadowMap.enabled = profile.shadows;

  const now = performance.now();
  const minimumFrameTime = 1000 / profile.maxFps;
  const last = frameTimes.get(this) ?? 0;
  if (last > 0 && now - last < minimumFrameTime - 1) return;
  frameTimes.set(this, now);

  if (!stableSince.has(this)) stableSince.set(this, now);
  if (profile.mode !== 'safe' && now - (stableSince.get(this) ?? now) >= STABLE_TIMER_MS) {
    clearRenderGuard();
  }

  originalRender.call(this, scene, camera);
};

function description(profile: GraphicsProfile) {
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

  const refresh = () => {
    const profile = getGraphicsProfile();
    button.dataset.mode = profile.mode;
    const label = `◈ ${profile.label.toUpperCase()} GPU`;
    if (button.textContent !== label) button.textContent = label;
    button.hidden = !document.querySelector('main.menu-screen, main.panel-screen');
    document.documentElement.dataset.graphics = profile.mode;
  };

  const openSettings = () => {
    document.querySelector('#graphics-settings-overlay')?.remove();
    const profile = getGraphicsProfile();
    const preference = readGraphicsPreference();

    const overlay = document.createElement('div');
    overlay.id = 'graphics-settings-overlay';
    overlay.className = 'graphics-settings-overlay';
    overlay.innerHTML = `
      <section class="graphics-settings-panel" role="dialog" aria-modal="true" aria-labelledby="graphics-settings-title">
        <header>
          <div><small>DEVICE PROTECTION</small><h2 id="graphics-settings-title">Graphics Mode</h2></div>
          <button id="graphics-close" aria-label="Close">×</button>
        </header>
        ${recoveryAtBoot ? '<div class="gpu-recovery-note"><b>SAFE FALLBACK ACTIVE</b><span>The previous accelerated session did not finish cleanly, so this launch was protected automatically.</span></div>' : ''}
        <p class="graphics-current">Current renderer: <strong>${profile.label}</strong> · ${description(profile)}</p>
        <div class="graphics-mode-grid">
          <button data-graphics="auto" class="${preference === 'auto' ? 'active' : ''}"><b>AUTO SAFE</b><span>Recommended first launch. Starts conservatively and keeps GPU recovery enabled.</span></button>
          <button data-graphics="safe" class="${preference === 'safe' ? 'active' : ''}"><b>SAFE</b><span>30 FPS, 1× resolution, low-power GPU, no realtime shadows.</span></button>
          <button data-graphics="balanced" class="${preference === 'balanced' ? 'active' : ''}"><b>BALANCED</b><span>60 FPS with better lighting and moderate GPU load.</span></button>
          <button data-graphics="high" class="${preference === 'high' ? 'active' : ''}"><b>HIGH</b><span>Best visuals. Use after Balanced is stable on your device.</span></button>
        </div>
        <p class="graphics-warning">Changing mode reloads the game so WebGL can recreate the renderer safely.</p>
      </section>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#graphics-close')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.querySelectorAll<HTMLButtonElement>('[data-graphics]').forEach((choice) => {
      choice.addEventListener('click', () => {
        setGraphicsPreference(choice.dataset.graphics as GraphicsPreference);
        location.reload();
      });
    });
  };

  button.addEventListener('click', openSettings);
  const appRoot = document.querySelector('#app');
  if (appRoot) new MutationObserver(refresh).observe(appRoot, { childList: true, subtree: true });
  refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountGraphicsUi, { once: true });
} else {
  mountGraphicsUi();
}
