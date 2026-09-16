import * as THREE from 'three';

const lastFrame = new WeakMap<THREE.WebGLRenderer, number>();

function targetFrameMs() {
  const mode = document.documentElement.dataset.graphics ?? 'safe';
  if (mode === 'safe') return 1000 / 30;
  return 1000 / 60;
}

const rendererPrototype = THREE.WebGLRenderer.prototype as unknown as {
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
};
const previousRender = rendererPrototype.render;

rendererPrototype.render = function gatedProductionRender(this: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const now = performance.now();
  const last = lastFrame.get(this) ?? 0;
  const minimum = targetFrameMs();
  if (last > 0 && now - last < minimum - 1) return;
  lastFrame.set(this, now);
  previousRender.call(this, scene, camera);
};
