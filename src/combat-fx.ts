import * as THREE from 'three';

interface CombatEffect {
  mesh: THREE.Mesh;
  life: number;
  total: number;
  startScale: number;
  endScale: number;
}

interface CombatSceneState {
  effects: CombatEffect[];
  attackSerial: number;
  specialSerial: number;
}

const states = new WeakMap<THREE.Scene, CombatSceneState>();
let attackSerial = 0;
let specialSerial = 0;

function safeGraphics() {
  return (document.documentElement.dataset.graphics ?? 'safe') === 'safe';
}

function currentPlayer(scene: THREE.Scene) {
  return scene.children.find((child): child is THREE.Group => child instanceof THREE.Group && child.userData.productionArtFighter === true) ?? null;
}

function fighterColor(group: THREE.Group) {
  const stored = group.userData.productionPrimary;
  if (typeof stored === 'string') return new THREE.Color(stored);
  return new THREE.Color(0xd6aa43);
}

function clearDecorativeEmissive(scene: THREE.Scene) {
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.name.startsWith('production-')) return;
    if (Array.isArray(node.material) || !(node.material instanceof THREE.MeshStandardMaterial)) return;
    // Production decoration should not be mistaken for gameplay hit emissive.
    if (node.name.includes('eye')) {
      node.material.emissive.setHex(0x000000);
      node.material.emissiveIntensity = 0;
    }
  });
}

function addEffect(state: CombatSceneState, scene: THREE.Scene, mesh: THREE.Mesh, life: number, startScale: number, endScale: number) {
  scene.add(mesh);
  state.effects.push({ mesh, life, total: life, startScale, endScale });
}

function spawnSlash(state: CombatSceneState, scene: THREE.Scene, player: THREE.Group) {
  const color = fighterColor(player).lerp(new THREE.Color(0xf2c65d), 0.35);
  const slash = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.055, safeGraphics() ? 5 : 7, safeGraphics() ? 22 : 36, Math.PI * 1.2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  slash.position.copy(player.position).add(new THREE.Vector3(Math.sin(player.rotation.y) * 0.7, 1.18, Math.cos(player.rotation.y) * 0.7));
  slash.rotation.set(Math.PI / 2, player.rotation.y, -0.52);
  addEffect(state, scene, slash, 0.22, 0.55, 1.35);

  if (!safeGraphics()) {
    const echo = slash.clone();
    echo.material = (slash.material as THREE.MeshBasicMaterial).clone();
    (echo.material as THREE.MeshBasicMaterial).opacity = 0.3;
    echo.position.y += 0.16;
    echo.rotation.z = -0.72;
    addEffect(state, scene, echo, 0.28, 0.4, 1.55);
  }
}

function spawnSpecialBurst(state: CombatSceneState, scene: THREE.Scene, player: THREE.Group) {
  const color = fighterColor(player).lerp(new THREE.Color(0xffffff), 0.16);
  for (let i = 0; i < (safeGraphics() ? 2 : 4); i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.8 + i * 0.16, 0.86 + i * 0.16, safeGraphics() ? 28 : 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.54 - i * 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(player.position).setY(0.09 + i * 0.025);
    addEffect(state, scene, ring, 0.72 + i * 0.06, 0.25 + i * 0.08, 4.5 + i * 0.7);
  }
}

function updateEffects(state: CombatSceneState, scene: THREE.Scene, dt: number) {
  for (const effect of [...state.effects]) {
    effect.life -= dt;
    const t = Math.max(0, effect.life / effect.total);
    const progress = 1 - t;
    const scale = effect.startScale + (effect.endScale - effect.startScale) * progress;
    effect.mesh.scale.setScalar(scale);
    effect.mesh.rotation.z += dt * 3.4;
    if (!Array.isArray(effect.mesh.material) && effect.mesh.material instanceof THREE.MeshBasicMaterial) {
      effect.mesh.material.opacity *= Math.pow(0.012, dt);
    }
    if (effect.life <= 0) {
      scene.remove(effect.mesh);
      const index = state.effects.indexOf(effect);
      if (index >= 0) state.effects.splice(index, 1);
    }
  }
}

const rendererPrototype = THREE.WebGLRenderer.prototype as unknown as {
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
};
const previousRender = rendererPrototype.render;
let previousAt = performance.now();
rendererPrototype.render = function combatFxRender(this: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0.001, (now - previousAt) / 1000));
  previousAt = now;
  clearDecorativeEmissive(scene);
  const state = states.get(scene) ?? { effects: [], attackSerial: 0, specialSerial: 0 };
  states.set(scene, state);
  const player = currentPlayer(scene);
  if (player && state.attackSerial !== attackSerial) {
    state.attackSerial = attackSerial;
    spawnSlash(state, scene, player);
  }
  if (player && state.specialSerial !== specialSerial) {
    state.specialSerial = specialSerial;
    spawnSpecialBurst(state, scene, player);
  }
  updateEffects(state, scene, dt);
  previousRender.call(this, scene, camera);
};

function markFromElement(target: EventTarget | null) {
  const button = target instanceof Element ? target.closest<HTMLElement>('button') : null;
  if (!button) return;
  if (button.matches('[data-action="attack"], [data-dojo-action="attack"]')) attackSerial += 1;
  if (button.matches('#special-btn, #dojo-special')) specialSerial += 1;
}

document.addEventListener('pointerdown', (event) => markFromElement(event.target));
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'KeyJ' || event.code === 'Space') attackSerial += 1;
  if (event.code === 'KeyE') specialSerial += 1;
});
