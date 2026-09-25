import * as THREE from 'three';

export type ArenaHazardKind = 'pit' | 'spikes';
export type ArenaHazardPhase = 'idle' | 'warning' | 'active' | 'recovery';

export interface ArenaHazardAnchor {
  id: string;
  kind: ArenaHazardKind;
  x: number;
  z: number;
  radius: number;
  minWave: number;
}

export interface ArenaHazardTarget {
  id: string;
  position: THREE.Vector3;
  grounded: boolean;
}

export interface ArenaHazardImpact {
  hazardId: string;
  hazardKind: ArenaHazardKind;
  targetId: string;
  lethal: boolean;
}

export interface ArenaHazardFrame {
  impacts: ArenaHazardImpact[];
  announcements: string[];
}

export interface ArenaHazardDifficulty {
  maxConcurrent: number;
  cooldownScale: number;
}

interface RuntimeHazard {
  anchor: ArenaHazardAnchor;
  group: THREE.Group;
  warningRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  phase: ArenaHazardPhase;
  timer: number;
  phaseDuration: number;
  hitTargets: Set<string>;
  panels: THREE.Mesh[];
  depthDisc?: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  shaft?: THREE.Mesh;
  spikes: THREE.Mesh[];
  spikeHomeY: number[];
}

export const DEFAULT_ARENA_HAZARD_ANCHORS: readonly ArenaHazardAnchor[] = [
  { id: 'pit-north-west', kind: 'pit', x: -18, z: -16, radius: 2.65, minWave: 2 },
  { id: 'pit-north-east', kind: 'pit', x: 18, z: -16, radius: 2.65, minWave: 2 },
  { id: 'pit-south-west', kind: 'pit', x: -18, z: 16, radius: 2.65, minWave: 2 },
  { id: 'pit-south-east', kind: 'pit', x: 18, z: 16, radius: 2.65, minWave: 2 },
  { id: 'spike-west', kind: 'spikes', x: -12, z: -3, radius: 1.35, minWave: 1 },
  { id: 'spike-east', kind: 'spikes', x: 12, z: 3, radius: 1.35, minWave: 1 },
  { id: 'spike-north', kind: 'spikes', x: 4, z: -13, radius: 1.35, minWave: 1 },
  { id: 'spike-south', kind: 'spikes', x: -4, z: 13, radius: 1.35, minWave: 1 }
] as const;

export function getArenaHazardDifficulty(wave: number): ArenaHazardDifficulty {
  if (wave >= 9) return { maxConcurrent: 3, cooldownScale: 0.7 };
  if (wave >= 5) return { maxConcurrent: 2, cooldownScale: 0.82 };
  return { maxConcurrent: 1, cooldownScale: 1 };
}

export function validateArenaHazardLayout(
  anchors: readonly ArenaHazardAnchor[],
  minGap = 3.2,
  spawn = new THREE.Vector2(0, 2.5),
  spawnSafeRadius = 7.5
) {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const anchor of anchors) {
    if (ids.has(anchor.id)) errors.push(`duplicate hazard id: ${anchor.id}`);
    ids.add(anchor.id);

    const spawnDistance = new THREE.Vector2(anchor.x, anchor.z).distanceTo(spawn);
    if (spawnDistance - anchor.radius < spawnSafeRadius) {
      errors.push(`${anchor.id} intrudes into the spawn safety zone`);
    }
  }

  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const a = anchors[i];
      const b = anchors[j];
      const centerDistance = Math.hypot(a.x - b.x, a.z - b.z);
      const edgeGap = centerDistance - a.radius - b.radius;
      if (edgeGap < minGap) errors.push(`${a.id} overlaps/crowds ${b.id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

export class ArenaHazardManager {
  private hazards: RuntimeHazard[];
  private announcements: string[] = [];

  constructor(
    private scene: THREE.Scene,
    anchors: readonly ArenaHazardAnchor[] = DEFAULT_ARENA_HAZARD_ANCHORS,
    private random: () => number = Math.random
  ) {
    const validation = validateArenaHazardLayout(anchors);
    if (!validation.valid) throw new Error(`Invalid arena hazard layout: ${validation.errors.join('; ')}`);
    this.hazards = anchors.map((anchor, index) => this.createHazard(anchor, index));
  }

  update(dt: number, wave: number, targets: readonly ArenaHazardTarget[]): ArenaHazardFrame {
    const impacts: ArenaHazardImpact[] = [];
    const difficulty = getArenaHazardDifficulty(wave);
    let concurrent = this.hazards.filter((hazard) => hazard.phase === 'warning' || hazard.phase === 'active').length;

    for (const hazard of this.hazards) {
      if (wave < hazard.anchor.minWave) {
        this.setVisualProgress(hazard, 0, 0);
        continue;
      }

      hazard.timer -= dt;

      if (hazard.phase === 'idle') {
        if (hazard.timer <= 0 && concurrent < difficulty.maxConcurrent) {
          this.enterWarning(hazard);
          concurrent += 1;
        }
      } else if (hazard.phase === 'warning') {
        const warningProgress = 1 - clamp01(hazard.timer / hazard.phaseDuration);
        this.setVisualProgress(hazard, 0, warningProgress);
        if (hazard.timer <= 0) this.enterActive(hazard);
      } else if (hazard.phase === 'active') {
        const activeProgress = 1 - clamp01(hazard.timer / hazard.phaseDuration);
        const openProgress = hazard.anchor.kind === 'pit'
          ? smooth(Math.min(1, activeProgress / 0.16))
          : smooth(Math.min(1, activeProgress / 0.1));
        this.setVisualProgress(hazard, openProgress, 1);

        const collisionReady = openProgress >= 0.72;
        if (collisionReady) {
          for (const target of targets) {
            if (!target.grounded || hazard.hitTargets.has(target.id)) continue;
            const distance = Math.hypot(target.position.x - hazard.anchor.x, target.position.z - hazard.anchor.z);
            const collisionRadius = hazard.anchor.kind === 'pit' ? hazard.anchor.radius * 0.78 : hazard.anchor.radius * 0.88;
            if (distance > collisionRadius) continue;
            hazard.hitTargets.add(target.id);
            impacts.push({
              hazardId: hazard.anchor.id,
              hazardKind: hazard.anchor.kind,
              targetId: target.id,
              lethal: hazard.anchor.kind === 'pit'
            });
          }
        }

        if (hazard.timer <= 0) this.enterRecovery(hazard);
      } else {
        const closeProgress = clamp01(hazard.timer / hazard.phaseDuration);
        this.setVisualProgress(hazard, smooth(closeProgress), 0);
        if (hazard.timer <= 0) {
          hazard.phase = 'idle';
          hazard.phaseDuration = 0;
          hazard.timer = this.nextCooldown(hazard.anchor.kind, difficulty.cooldownScale);
          hazard.hitTargets.clear();
          this.setVisualProgress(hazard, 0, 0);
        }
      }
    }

    const announcements = this.announcements.splice(0);
    return { impacts, announcements };
  }

  getSnapshot() {
    return this.hazards.map((hazard) => ({
      id: hazard.anchor.id,
      kind: hazard.anchor.kind,
      phase: hazard.phase,
      timer: hazard.timer
    }));
  }

  reset() {
    this.announcements.length = 0;
    for (const [index, hazard] of this.hazards.entries()) {
      hazard.phase = 'idle';
      hazard.phaseDuration = 0;
      hazard.hitTargets.clear();
      hazard.timer = this.initialDelay(hazard.anchor.kind, index);
      this.setVisualProgress(hazard, 0, 0);
    }
  }

  destroy() {
    for (const hazard of this.hazards) {
      this.scene.remove(hazard.group);
      hazard.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
    }
    this.hazards.length = 0;
    this.announcements.length = 0;
  }

  private createHazard(anchor: ArenaHazardAnchor, index: number): RuntimeHazard {
    const group = new THREE.Group();
    group.name = `arenaHazard:${anchor.id}`;
    group.position.set(anchor.x, 0, anchor.z);

    const warningRing = new THREE.Mesh(
      new THREE.RingGeometry(anchor.radius * 0.82, anchor.radius * 1.02, 48),
      new THREE.MeshBasicMaterial({
        color: anchor.kind === 'pit' ? 0xff633d : 0xffb43b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    warningRing.rotation.x = -Math.PI / 2;
    warningRing.position.y = 0.105;
    group.add(warningRing);

    const runtime: RuntimeHazard = {
      anchor,
      group,
      warningRing,
      phase: 'idle',
      timer: this.initialDelay(anchor.kind, index),
      phaseDuration: 0,
      hitTargets: new Set(),
      panels: [],
      spikes: [],
      spikeHomeY: []
    };

    if (anchor.kind === 'pit') this.buildPit(runtime);
    else this.buildSpikes(runtime);

    this.scene.add(group);
    this.setVisualProgress(runtime, 0, 0);
    return runtime;
  }

  private buildPit(hazard: RuntimeHazard) {
    const { radius } = hazard.anchor;
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x626e79,
      roughness: 0.9,
      metalness: 0.01
    });
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x262b31,
      roughness: 0.96,
      metalness: 0.02
    });

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.93, radius * 0.82, 2.8, 28, 1, true),
      edgeMaterial
    );
    shaft.position.y = -1.3;
    shaft.visible = false;
    hazard.group.add(shaft);
    hazard.shaft = shaft;

    const depthDisc = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x050608, transparent: true, opacity: 0, depthWrite: false })
    );
    depthDisc.rotation.x = -Math.PI / 2;
    depthDisc.position.y = 0.088;
    hazard.group.add(depthDisc);
    hazard.depthDisc = depthDisc;

    const rim = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.9, radius, 36),
      edgeMaterial
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.094;
    hazard.group.add(rim);

    const panelCount = 6;
    for (let i = 0; i < panelCount; i++) {
      const angle = (i / panelCount) * Math.PI * 2;
      const panel = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.89, 5, angle, (Math.PI * 2) / panelCount),
        stoneMaterial.clone()
      );
      panel.rotation.x = -Math.PI / 2;
      panel.position.y = 0.11;
      panel.receiveShadow = true;
      panel.castShadow = true;
      panel.userData.hazardAngle = angle + Math.PI / panelCount;
      panel.userData.hazardTiltSign = i % 2 === 0 ? 1 : -1;
      hazard.group.add(panel);
      hazard.panels.push(panel);
    }

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2;
      const crack = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 0.6, 0.012, 0.035),
        new THREE.MeshBasicMaterial({ color: 0x2b1815, transparent: true, opacity: 0.5, depthWrite: false })
      );
      crack.position.set(Math.cos(angle) * radius * 0.35, 0.126, Math.sin(angle) * radius * 0.35);
      crack.rotation.y = -angle + (i % 2 ? 0.18 : -0.18);
      hazard.group.add(crack);
    }
  }

  private buildSpikes(hazard: RuntimeHazard) {
    const { radius } = hazard.anchor;
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: 0x30353a,
      roughness: 0.88,
      metalness: 0.08,
      emissive: 0x000000
    });
    const metalMaterial = new THREE.MeshStandardMaterial({
      color: 0x969ca1,
      roughness: 0.36,
      metalness: 0.56
    });

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.08, 24), plateMaterial);
    plate.name = 'hazardSpikePlate';
    plate.position.y = 0.055;
    plate.receiveShadow = true;
    hazard.group.add(plate);

    const locations: Array<[number, number]> = [[0, 0]];
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? 6 : 8;
      const r = ring === 0 ? radius * 0.42 : radius * 0.7;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + ring * 0.18;
        locations.push([Math.cos(angle) * r, Math.sin(angle) * r]);
      }
    }

    for (const [x, z] of locations) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.78, 8), metalMaterial);
      const homeY = -0.34;
      spike.position.set(x, homeY, z);
      spike.castShadow = true;
      hazard.group.add(spike);
      hazard.spikes.push(spike);
      hazard.spikeHomeY.push(homeY);
    }
  }

  private enterWarning(hazard: RuntimeHazard) {
    hazard.phase = 'warning';
    hazard.phaseDuration = hazard.anchor.kind === 'pit' ? 1.2 : 0.8;
    hazard.timer = hazard.phaseDuration;
    hazard.hitTargets.clear();
    this.announcements.push(
      hazard.anchor.kind === 'pit'
        ? 'PIT TRAP! Cracked floor is about to collapse.'
        : 'SPIKE TRAP! Move off the glowing plate.'
    );
  }

  private enterActive(hazard: RuntimeHazard) {
    hazard.phase = 'active';
    hazard.phaseDuration = hazard.anchor.kind === 'pit' ? 2.65 : 1.45;
    hazard.timer = hazard.phaseDuration;
    hazard.hitTargets.clear();
  }

  private enterRecovery(hazard: RuntimeHazard) {
    hazard.phase = 'recovery';
    hazard.phaseDuration = hazard.anchor.kind === 'pit' ? 0.9 : 0.58;
    hazard.timer = hazard.phaseDuration;
  }

  private setVisualProgress(hazard: RuntimeHazard, openProgress: number, warningProgress: number) {
    const pulse = 0.45 + Math.sin(performance.now() * 0.018) * 0.28;
    hazard.warningRing.material.opacity = warningProgress > 0 ? Math.max(0.15, pulse) * warningProgress : 0;
    hazard.warningRing.scale.setScalar(0.96 + warningProgress * 0.08);

    if (hazard.anchor.kind === 'pit') {
      const depth = hazard.depthDisc;
      if (depth) depth.material.opacity = clamp01(openProgress * 1.18);
      if (hazard.shaft) hazard.shaft.visible = openProgress > 0.08;

      for (const panel of hazard.panels) {
        const angle = Number(panel.userData.hazardAngle ?? 0);
        const sign = Number(panel.userData.hazardTiltSign ?? 1);
        const warningJitter = warningProgress > 0 && openProgress === 0
          ? Math.sin(performance.now() * 0.028 + angle * 3) * 0.035 * warningProgress
          : 0;
        panel.position.x = Math.cos(angle) * openProgress * 0.48 + Math.cos(angle) * warningJitter;
        panel.position.z = Math.sin(angle) * openProgress * 0.48 + Math.sin(angle) * warningJitter;
        panel.position.y = 0.11 - openProgress * 2.65;
        panel.rotation.x = -Math.PI / 2 + sign * openProgress * 0.72;
        panel.rotation.z = sign * openProgress * 0.24;
      }
      return;
    }

    const plate = hazard.group.getObjectByName('hazardSpikePlate');
    if (plate instanceof THREE.Mesh && plate.material instanceof THREE.MeshStandardMaterial) {
      plate.material.emissive.setHex(warningProgress > 0 ? 0x6a2b0d : openProgress > 0.2 ? 0x351b09 : 0x000000);
      plate.material.emissiveIntensity = warningProgress > 0 ? 0.8 + pulse * 0.6 : openProgress * 0.45;
    }

    for (let i = 0; i < hazard.spikes.length; i++) {
      const spike = hazard.spikes[i];
      const homeY = hazard.spikeHomeY[i];
      spike.position.y = THREE.MathUtils.lerp(homeY, 0.42, openProgress);
      spike.rotation.y += openProgress > 0 ? 0.015 * (i % 2 ? 1 : -1) : 0;
    }
  }

  private initialDelay(kind: ArenaHazardKind, index: number) {
    const base = kind === 'pit' ? 5.5 : 3.3;
    return base + index * 0.65 + this.random() * 2.4;
  }

  private nextCooldown(kind: ArenaHazardKind, cooldownScale: number) {
    const base = kind === 'pit' ? 8.5 : 6.4;
    return (base + this.random() * 4.2) * cooldownScale;
  }
}
