import * as THREE from 'three';
import type { CharacterDef } from './types';
import { createCharacterModel } from './model';

export class CharacterPreview {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  private readonly renderer: THREE.WebGLRenderer;
  private model: THREE.Group | null = null;
  private frame = 0;
  private running = true;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly host: HTMLElement, character: CharacterDef) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '3D fighter preview');
    this.renderer.domElement.setAttribute('role', 'img');
    this.host.replaceChildren(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x251d2d, 2.35));

    const key = new THREE.DirectionalLight(0xffe5b5, 4.1);
    key.position.set(-3.5, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x8ebfff, 2.1);
    rim.position.set(4, 3.5, -3);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.95, 0.24, 36),
      new THREE.MeshStandardMaterial({
        color: 0x33283d,
        metalness: 0.18,
        roughness: 0.72
      })
    );
    floor.position.y = -0.13;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.48, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xc89c3d, transparent: true, opacity: 0.72 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.015;
    this.scene.add(ring);

    this.camera.position.set(3.6, 2.8, 5.6);
    this.camera.lookAt(0, 1.18, 0);

    this.setCharacter(character);
    this.resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.host);
    } else {
      window.addEventListener('resize', this.resize);
    }

    this.loop();
  }

  setCharacter(character: CharacterDef) {
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeModel(this.model);
    }

    const model = createCharacterModel(character, 1.12);
    model.position.y = 0;
    model.rotation.y = -0.42;
    model.userData.characterId = character.id;
    this.model = model;
    this.scene.add(model);
    this.host.dataset.characterId = character.id;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.resize);
    if (this.model) this.disposeModel(this.model);
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  private disposeModel(model: THREE.Group) {
    model.traverse((object) => {
      if (object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((item) => item.dispose());
        return;
      }
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((item) => item.dispose());
    });
  }

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
    if (this.model) {
      this.model.rotation.y += 0.006;
      this.model.position.y = 0.025 + Math.sin(performance.now() * 0.0018) * 0.025;
    }
    this.renderer.render(this.scene, this.camera);
  };
}
