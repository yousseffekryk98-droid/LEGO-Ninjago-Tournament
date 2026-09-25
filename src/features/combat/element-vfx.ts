import * as THREE from 'three';
import type { ElementCombatTheme } from '../characters/elemental';

interface ActiveElementFx {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  gravity: number;
  life: number;
  maxLife: number;
  growth: number;
  spin: THREE.Vector3;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export class ElementVfxSystem {
  private active: ActiveElementFx[] = [];

  constructor(private scene: THREE.Scene, private random: () => number = Math.random) {}

  update(dt: number) {
    for (const effect of [...this.active]) {
      effect.life -= dt;
      effect.velocity.y -= effect.gravity * dt;
      effect.object.position.addScaledVector(effect.velocity, dt);
      effect.object.rotation.x += effect.spin.x * dt;
      effect.object.rotation.y += effect.spin.y * dt;
      effect.object.rotation.z += effect.spin.z * dt;

      if (effect.growth !== 0) {
        const scale = Math.max(0.05, 1 + effect.growth * dt);
        effect.object.scale.multiplyScalar(scale);
      }

      const alpha = clamp01(effect.life / effect.maxLife);
      effect.object.traverse((object) => {
        if (object instanceof THREE.PointLight) {
          object.intensity = Number(object.userData.baseIntensity ?? object.intensity) * alpha;
          return;
        }
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!('opacity' in material)) continue;
          const withOpacity = material as THREE.Material & { opacity: number; transparent: boolean };
          if (withOpacity.userData.baseOpacity === undefined) withOpacity.userData.baseOpacity = withOpacity.opacity;
          withOpacity.transparent = true;
          withOpacity.opacity = Number(withOpacity.userData.baseOpacity) * alpha;
        }
      });

      if (effect.life <= 0) this.remove(effect);
    }
  }

  spawnKick(theme: ElementCombatTheme, origin: THREE.Vector3, direction: THREE.Vector3) {
    const forward = direction.clone().setY(0).normalize();
    this.spawnGroundPulse(theme, origin, 0.7);

    switch (theme.effect) {
      case 'fire':
        this.spawnFire(theme, origin, forward, 12);
        break;
      case 'ice':
        this.spawnIce(theme, origin, forward, 10);
        break;
      case 'lightning':
        this.spawnLightning(theme, origin, forward, 5);
        break;
      case 'earth':
        this.spawnEarth(theme, origin, forward, 9);
        break;
      case 'water':
        this.spawnWater(theme, origin, forward, 12);
        break;
      case 'poison':
        this.spawnPoison(theme, origin, forward, 9);
        break;
      case 'wind':
        this.spawnWind(theme, origin, forward, 5);
        break;
      case 'metal':
        this.spawnMetal(theme, origin, forward, 10);
        break;
      case 'shadow':
        this.spawnShadow(theme, origin, forward, 8);
        break;
      case 'mind':
        this.spawnPsychic(theme, origin, 4);
        break;
      case 'sound':
        this.spawnSound(theme, origin, forward, 5);
        break;
      case 'nature':
        this.spawnNature(theme, origin, forward, 10);
        break;
      case 'gravity':
        this.spawnGravity(theme, origin, forward, 7);
        break;
      case 'light':
      case 'energy':
      case 'force':
      default:
        this.spawnEnergy(theme, origin, forward, 10);
        break;
    }

    this.spawnLight(theme, origin.clone().add(new THREE.Vector3(0, 0.75, 0)), theme.lightIntensity, 0.34);
    this.trim();
  }

  spawnImpact(theme: ElementCombatTheme, origin: THREE.Vector3) {
    this.spawnGroundPulse(theme, origin.clone().setY(0.055), 0.42);
    const direction = new THREE.Vector3(0, 0, 1);
    switch (theme.effect) {
      case 'fire': this.spawnFire(theme, origin, direction, 6); break;
      case 'ice': this.spawnIce(theme, origin, direction, 7); break;
      case 'lightning': this.spawnLightning(theme, origin, direction, 3); break;
      case 'earth': this.spawnEarth(theme, origin, direction, 5); break;
      case 'water': this.spawnWater(theme, origin, direction, 7); break;
      case 'poison': this.spawnPoison(theme, origin, direction, 5); break;
      case 'wind': this.spawnWind(theme, origin, direction, 3); break;
      case 'metal': this.spawnMetal(theme, origin, direction, 6); break;
      case 'shadow': this.spawnShadow(theme, origin, direction, 5); break;
      case 'mind': this.spawnPsychic(theme, origin, 3); break;
      case 'sound': this.spawnSound(theme, origin, direction, 4); break;
      case 'nature': this.spawnNature(theme, origin, direction, 7); break;
      case 'gravity': this.spawnGravity(theme, origin, direction, 5); break;
      default: this.spawnEnergy(theme, origin, direction, 6); break;
    }
    this.spawnLight(theme, origin, theme.lightIntensity * 0.7, 0.22);
    this.trim();
  }

  spawnSpinjitzuBurst(theme: ElementCombatTheme, origin: THREE.Vector3) {
    this.spawnGroundPulse(theme, origin.clone().setY(0.05), 1.05);
    for (let ring = 0; ring < 3; ring++) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(1.0 + ring * 0.34, 0.045 + ring * 0.008, 8, 42),
        this.additive(theme[ring % 2 === 0 ? 'color' : 'accent'], 0.76 - ring * 0.12)
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.copy(origin).add(new THREE.Vector3(0, 0.22 + ring * 0.38, 0));
      this.add(mesh, new THREE.Vector3(0, 0.75 + ring * 0.18, 0), -0.3, 0.55, 1.4, new THREE.Vector3(0.5, 5 + ring, -0.4));
    }

    const forward = new THREE.Vector3(0, 0, 1);
    if (theme.effect === 'fire') this.spawnFire(theme, origin, forward, 18);
    else if (theme.effect === 'ice') this.spawnIce(theme, origin, forward, 16);
    else if (theme.effect === 'lightning') this.spawnLightning(theme, origin, forward, 8);
    else if (theme.effect === 'earth' || theme.effect === 'metal') this.spawnEarth(theme, origin, forward, 14);
    else if (theme.effect === 'water' || theme.effect === 'wind') this.spawnWater(theme, origin, forward, 16);
    else if (theme.effect === 'poison' || theme.effect === 'shadow') this.spawnPoison(theme, origin, forward, 14);
    else if (theme.effect === 'sound') this.spawnSound(theme, origin, forward, 9);
    else if (theme.effect === 'nature') this.spawnNature(theme, origin, forward, 16);
    else if (theme.effect === 'gravity') this.spawnGravity(theme, origin, forward, 12);
    else this.spawnEnergy(theme, origin, forward, 16);

    this.spawnLight(theme, origin.clone().add(new THREE.Vector3(0, 1.1, 0)), theme.lightIntensity * 1.25, 0.6);
    this.trim();
  }

  destroy() {
    for (const effect of [...this.active]) this.remove(effect);
    this.active.length = 0;
  }

  getActiveCount() {
    return this.active.length;
  }

  private spawnGroundPulse(theme: ElementCombatTheme, origin: THREE.Vector3, strength: number) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.83, 44),
      this.additive(theme.accent, 0.72)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(origin).setY(0.065);
    this.add(ring, new THREE.Vector3(), 0, 0.34 + strength * 0.22, 3.1 + strength * 2.1, new THREE.Vector3(0, 0, 1.6));

    if (theme.groundStyle === 'crack' || theme.groundStyle === 'scorch') {
      for (let i = 0; i < 5; i++) {
        const streak = new THREE.Mesh(
          new THREE.BoxGeometry(0.65 + this.random() * 0.85, 0.015, 0.035),
          this.additive(theme.color, 0.48)
        );
        const angle = (i / 5) * Math.PI * 2 + this.random() * 0.4;
        streak.position.copy(origin).add(new THREE.Vector3(Math.cos(angle) * 0.55, 0.07, Math.sin(angle) * 0.55));
        streak.rotation.y = -angle;
        this.add(streak, new THREE.Vector3(), 0, 0.45, 0.7, new THREE.Vector3());
      }
    }
  }

  private spawnFire(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.08 + this.random() * 0.09, 0.42 + this.random() * 0.5, 7),
        new THREE.MeshBasicMaterial({
          color: i % 3 === 0 ? theme.accent : theme.color,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      flame.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 0.65, 0.25 + this.random() * 0.45, (this.random() - 0.5) * 0.65));
      const side = new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar((this.random() - 0.5) * 3.4);
      const velocity = forward.clone().multiplyScalar(2.4 + this.random() * 3.8).add(side);
      velocity.y = 2.5 + this.random() * 3.8;
      this.add(flame, velocity, 4.2, 0.46 + this.random() * 0.28, -0.25, new THREE.Vector3(3, 4, 2));
    }
  }

  private spawnIce(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12 + this.random() * 0.13, 0),
        new THREE.MeshPhysicalMaterial({
          color: i % 2 ? theme.color : theme.accent,
          emissive: theme.color,
          emissiveIntensity: 0.24,
          transparent: true,
          opacity: 0.92,
          roughness: 0.16,
          metalness: 0.03,
          transmission: 0.08
        })
      );
      shard.scale.y = 1.5 + this.random() * 1.4;
      shard.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 0.5, 0.35 + this.random() * 0.3, (this.random() - 0.5) * 0.5));
      const radial = new THREE.Vector3(this.random() - 0.5, 0, this.random() - 0.5).normalize().multiplyScalar(2 + this.random() * 3);
      const velocity = forward.clone().multiplyScalar(1.5 + this.random() * 2.4).add(radial);
      velocity.y = 2 + this.random() * 2.8;
      this.add(shard, velocity, 7.2, 0.5 + this.random() * 0.25, -0.08, new THREE.Vector3(7, 5, 8));
    }
  }

  private spawnLightning(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    for (let i = 0; i < count; i++) {
      const points: THREE.Vector3[] = [];
      const length = 1.7 + this.random() * 1.9;
      for (let step = 0; step <= 6; step++) {
        const t = step / 6;
        points.push(origin.clone()
          .addScaledVector(forward, length * t)
          .addScaledVector(side, (this.random() - 0.5) * 0.65 * (1 - Math.abs(t - 0.5)))
          .add(new THREE.Vector3(0, 0.28 + this.random() * 0.65, 0)));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: i % 2 ? theme.color : theme.accent,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending
        })
      );
      this.add(line, new THREE.Vector3(), 0, 0.16 + this.random() * 0.12, 0, new THREE.Vector3());
    }

    for (let i = 0; i < count * 2; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.045 + this.random() * 0.045, 7, 5),
        this.additive(i % 2 ? theme.accent : theme.color, 0.95)
      );
      spark.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 1.1, 0.25 + this.random() * 0.9, (this.random() - 0.5) * 1.1));
      this.add(spark, new THREE.Vector3((this.random() - 0.5) * 6, 1 + this.random() * 4, (this.random() - 0.5) * 6), 2.5, 0.28, -0.8, new THREE.Vector3());
    }
  }

  private spawnEarth(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.1 + this.random() * 0.18, 0),
        new THREE.MeshStandardMaterial({
          color: i % 3 === 0 ? theme.accent : theme.color,
          roughness: 0.92,
          metalness: theme.effect === 'metal' ? 0.48 : 0.02,
          transparent: true,
          opacity: 0.95
        })
      );
      rock.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 0.7, 0.18, (this.random() - 0.5) * 0.7));
      const velocity = forward.clone().multiplyScalar(1 + this.random() * 2.2);
      velocity.x += (this.random() - 0.5) * 4;
      velocity.z += (this.random() - 0.5) * 4;
      velocity.y = 2.3 + this.random() * 3.2;
      this.add(rock, velocity, 9.8, 0.55 + this.random() * 0.22, -0.16, new THREE.Vector3(5, 6, 4));
    }
  }

  private spawnWater(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.07 + this.random() * 0.09, 9, 7),
        new THREE.MeshPhysicalMaterial({
          color: i % 2 ? theme.color : theme.accent,
          emissive: theme.color,
          emissiveIntensity: 0.16,
          transparent: true,
          opacity: 0.72,
          roughness: 0.12,
          transmission: 0.16
        })
      );
      drop.scale.y = 1.5 + this.random();
      drop.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 0.7, 0.2 + this.random() * 0.5, (this.random() - 0.5) * 0.7));
      const velocity = forward.clone().multiplyScalar(2.2 + this.random() * 3.8);
      velocity.x += (this.random() - 0.5) * 2.8;
      velocity.z += (this.random() - 0.5) * 2.8;
      velocity.y = 1.2 + this.random() * 3.1;
      this.add(drop, velocity, 4.8, 0.48 + this.random() * 0.24, -0.12, new THREE.Vector3(2, 4, 2));
    }

    const ripple = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.035, 7, 36),
      this.additive(theme.accent, 0.68)
    );
    ripple.rotation.x = Math.PI / 2;
    ripple.position.copy(origin).setY(0.08);
    this.add(ripple, new THREE.Vector3(), 0, 0.4, 4.5, new THREE.Vector3(0, 1.2, 0));
  }

  private spawnPoison(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(0.22 + this.random() * 0.22, 10, 7),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? theme.color : theme.accent,
          transparent: true,
          opacity: 0.3,
          depthWrite: false
        })
      );
      cloud.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 1.0, 0.25 + this.random() * 0.7, (this.random() - 0.5) * 1.0));
      const velocity = forward.clone().multiplyScalar(0.5 + this.random() * 1.6);
      velocity.x += (this.random() - 0.5) * 1.6;
      velocity.z += (this.random() - 0.5) * 1.6;
      velocity.y = 0.7 + this.random() * 1.5;
      this.add(cloud, velocity, -0.35, 0.85 + this.random() * 0.4, 0.45, new THREE.Vector3(0.4, 0.8, 0.3));
    }
  }

  private spawnWind(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.45 + i * 0.09, 0.025, 6, 30),
        this.additive(i % 2 ? theme.color : theme.accent, 0.62)
      );
      ring.position.copy(origin).addScaledVector(forward, i * 0.28).add(new THREE.Vector3(0, 0.25 + i * 0.12, 0));
      ring.rotation.x = Math.PI / 2 + (this.random() - 0.5) * 0.35;
      this.add(ring, forward.clone().multiplyScalar(3.5 + i * 0.5), -0.15, 0.42 + i * 0.03, 1.8, new THREE.Vector3(2, 5, 2));
    }
  }

  private spawnMetal(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const shard = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.08, 0.3 + this.random() * 0.28),
        new THREE.MeshStandardMaterial({
          color: i % 2 ? theme.color : theme.accent,
          metalness: 0.78,
          roughness: 0.22,
          transparent: true,
          opacity: 0.95
        })
      );
      shard.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 0.6, 0.3 + this.random() * 0.45, (this.random() - 0.5) * 0.6));
      const velocity = forward.clone().multiplyScalar(2 + this.random() * 3.5);
      velocity.x += (this.random() - 0.5) * 3.5;
      velocity.z += (this.random() - 0.5) * 3.5;
      velocity.y = 1.8 + this.random() * 3.4;
      this.add(shard, velocity, 6.8, 0.48 + this.random() * 0.2, -0.08, new THREE.Vector3(9, 7, 11));
    }
  }

  private spawnShadow(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const wisp = new THREE.Mesh(
        new THREE.SphereGeometry(0.16 + this.random() * 0.18, 9, 7),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? theme.color : theme.accent,
          transparent: true,
          opacity: 0.34,
          depthWrite: false
        })
      );
      wisp.scale.set(1.4, 0.7, 1.4);
      wisp.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 0.9, 0.3 + this.random() * 0.9, (this.random() - 0.5) * 0.9));
      const velocity = forward.clone().multiplyScalar(0.8 + this.random() * 1.6);
      velocity.x += (this.random() - 0.5) * 2;
      velocity.z += (this.random() - 0.5) * 2;
      velocity.y = 0.5 + this.random() * 1.2;
      this.add(wisp, velocity, -0.2, 0.72 + this.random() * 0.35, 0.35, new THREE.Vector3(0.7, 1.8, 0.6));
    }
  }

  private spawnPsychic(theme: ElementCombatTheme, origin: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.45 + i * 0.22, 0.035, 7, 36),
        this.additive(i % 2 ? theme.color : theme.accent, 0.7)
      );
      ring.position.copy(origin).add(new THREE.Vector3(0, 0.45 + i * 0.2, 0));
      ring.rotation.x = Math.PI / 2;
      this.add(ring, new THREE.Vector3(0, 0.22, 0), 0, 0.5 + i * 0.05, 2.5, new THREE.Vector3(0.6, 2.2, 0.4));
    }
  }

  private spawnSound(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    for (let i = 0; i < count; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.34 + i * 0.16, 0.035, 7, 40),
        this.additive(i % 2 ? theme.color : theme.accent, 0.78 - i * 0.07)
      );
      ring.position.copy(origin)
        .addScaledVector(forward, i * 0.33)
        .addScaledVector(side, (i % 2 ? 1 : -1) * 0.08)
        .add(new THREE.Vector3(0, 0.32 + i * 0.12, 0));
      ring.rotation.x = Math.PI / 2;
      this.add(ring, forward.clone().multiplyScalar(2.6 + i * 0.42), -0.08, 0.42 + i * 0.04, 1.65, new THREE.Vector3(0.2, 3.2, 0.4));
    }

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      this.additive(theme.accent, 0.9)
    );
    core.position.copy(origin).add(new THREE.Vector3(0, 0.52, 0));
    this.add(core, forward.clone().multiplyScalar(2.8), -0.12, 0.34, 0.5, new THREE.Vector3());
  }

  private spawnNature(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    const side = new THREE.Vector3(-forward.z, 0, forward.x);
    for (let i = 0; i < count; i++) {
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + this.random() * 0.05, 7, 5),
        new THREE.MeshStandardMaterial({
          color: i % 3 === 0 ? theme.accent : theme.color,
          roughness: 0.72,
          metalness: 0.01,
          transparent: true,
          opacity: 0.9
        })
      );
      leaf.scale.set(0.65, 0.18, 1.55);
      leaf.position.copy(origin)
        .addScaledVector(side, (this.random() - 0.5) * 0.9)
        .add(new THREE.Vector3((this.random() - 0.5) * 0.35, 0.22 + this.random() * 0.65, (this.random() - 0.5) * 0.35));
      const velocity = forward.clone().multiplyScalar(1.6 + this.random() * 2.8)
        .add(side.clone().multiplyScalar((this.random() - 0.5) * 2.2));
      velocity.y = 1.2 + this.random() * 2.3;
      this.add(leaf, velocity, 2.5, 0.55 + this.random() * 0.3, -0.12, new THREE.Vector3(6, 8, 5));
    }

    const vine = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.035, 7, 40),
      this.additive(theme.accent, 0.62)
    );
    vine.rotation.x = Math.PI / 2;
    vine.position.copy(origin).setY(0.08);
    this.add(vine, new THREE.Vector3(), 0, 0.5, 3.4, new THREE.Vector3(0.3, 2.2, 0.4));
  }

  private spawnGravity(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    const group = new THREE.Group();
    group.position.copy(origin).add(new THREE.Vector3(0, 0.7, 0));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.45 + (i % 3) * 0.2;
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.08 + (i % 2) * 0.035, 0),
        this.additive(i % 2 ? theme.color : theme.accent, 0.86)
      );
      orb.position.set(Math.cos(angle) * radius, (i % 3 - 1) * 0.16, Math.sin(angle) * radius);
      group.add(orb);
    }
    const lens = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.045, 8, 42),
      this.additive(theme.accent, 0.7)
    );
    lens.rotation.x = Math.PI / 2;
    group.add(lens);
    this.add(group, forward.clone().multiplyScalar(1.25), -0.5, 0.62, 0.8, new THREE.Vector3(1.6, 7.5, -1.1));
  }

  private spawnEnergy(theme: ElementCombatTheme, origin: THREE.Vector3, forward: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.07 + this.random() * 0.1, 0),
        this.additive(i % 2 ? theme.color : theme.accent, 0.82)
      );
      orb.position.copy(origin).add(new THREE.Vector3((this.random() - 0.5) * 0.75, 0.25 + this.random() * 0.75, (this.random() - 0.5) * 0.75));
      const velocity = forward.clone().multiplyScalar(1.8 + this.random() * 3.2);
      velocity.x += (this.random() - 0.5) * 3;
      velocity.z += (this.random() - 0.5) * 3;
      velocity.y = 1 + this.random() * 2.8;
      this.add(orb, velocity, 2.2, 0.45 + this.random() * 0.25, 0.25, new THREE.Vector3(4, 5, 6));
    }
  }

  private spawnLight(theme: ElementCombatTheme, origin: THREE.Vector3, intensity: number, life: number) {
    const light = new THREE.PointLight(theme.color, intensity, 6.5, 2);
    light.position.copy(origin);
    light.userData.baseIntensity = intensity;
    this.add(light, new THREE.Vector3(), 0, life, 0, new THREE.Vector3());
  }

  private additive(color: number, opacity: number) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  }

  private add(
    object: THREE.Object3D,
    velocity: THREE.Vector3,
    gravity: number,
    life: number,
    growth: number,
    spin: THREE.Vector3
  ) {
    this.scene.add(object);
    this.active.push({
      object,
      velocity,
      gravity,
      life,
      maxLife: life,
      growth,
      spin
    });
  }

  private trim() {
    while (this.active.length > 220) this.remove(this.active[0]);
  }

  private remove(effect: ActiveElementFx) {
    const index = this.active.indexOf(effect);
    if (index >= 0) this.active.splice(index, 1);
    this.scene.remove(effect.object);
    effect.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }
}
