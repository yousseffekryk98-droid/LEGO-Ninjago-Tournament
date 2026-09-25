import * as THREE from 'three';
import { replaceWithStaticGlb } from '../../shared/three/gltf-assets';

export const CENTER_PILLAR_RADIUS = 1.62;
export const CENTER_PILLAR_CLEARANCE = 0.78;
export const CENTER_PILLAR_AUTHORED_ASSET_URL = '/assets/models/arena/chen-center-pillar.glb';
export const ARENA_GATE_AUTHORED_ASSET_URL = '/assets/models/arena/chen-gate.glb';
export const SERPENT_COLUMN_AUTHORED_ASSET_URL = '/assets/models/arena/serpent-column.glb';
export const ARENA_GONG_AUTHORED_ASSET_URL = '/assets/models/arena/chen-gong.glb';

const setShadow = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.transparent = true;
      material.userData.baseOpacity = material.opacity;
    }
  });
};

export function buildLegacyCenterPillar(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = 'legacyCenterSerpentPillar';

  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4947, roughness: 0.96, metalness: 0.01 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x2d2e31, roughness: 0.98 });
  const stoneHighlight = new THREE.MeshStandardMaterial({ color: 0x5b5a56, roughness: 0.93 });
  const serpent = new THREE.MeshStandardMaterial({ color: 0x72243d, roughness: 0.57, metalness: 0.025 });
  const serpentDark = new THREE.MeshStandardMaterial({ color: 0x3f1527, roughness: 0.7 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xa27a35, roughness: 0.42, metalness: 0.32 });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.86, 2.08, 0.42, 12), stoneDark);
  plinth.name = 'centerPillarPlinth';
  plinth.position.y = 0.2;
  group.add(plinth);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.72, 0.62, 12), stone);
  base.name = 'centerPillarBase';
  base.position.y = 0.69;
  group.add(base);

  const baseCollar = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.14, 9, 32), bronze);
  baseCollar.rotation.x = Math.PI / 2;
  baseCollar.position.y = 0.93;
  group.add(baseCollar);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.18, 9.7, 12), stone);
  shaft.name = 'centerPillarShaft';
  shaft.position.y = 5.62;
  group.add(shaft);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.11, 8.85, 0.22), i % 3 === 0 ? stoneHighlight : stoneDark);
    rib.name = `centerPillarRib:${i}`;
    rib.position.set(Math.cos(angle) * 1.03, 5.55, Math.sin(angle) * 1.03);
    rib.rotation.y = -angle;
    rib.scale.z = i % 2 ? 0.72 : 1;
    group.add(rib);
  }

  for (let i = 0; i < 7; i++) {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(1.08 + (i % 2) * 0.045, 0.06, 7, 26),
      i % 3 === 1 ? stoneDark : stoneHighlight
    );
    collar.name = `centerPillarStoneBand:${i}`;
    collar.rotation.x = Math.PI / 2;
    collar.rotation.z = i * 0.17;
    collar.position.y = 1.42 + i * 1.28;
    collar.scale.x = i % 2 ? 1.05 : 0.98;
    group.add(collar);
  }

  const capLower = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.08, 0.5, 12), stoneDark);
  capLower.position.y = 10.55;
  group.add(capLower);
  const capUpper = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.3, 0.42, 12), stone);
  capUpper.position.y = 10.98;
  group.add(capUpper);
  const capCrown = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.14, 9, 32), bronze);
  capCrown.rotation.x = Math.PI / 2;
  capCrown.position.y = 11.12;
  group.add(capCrown);

  const helixPoints: THREE.Vector3[] = [];
  const turns = 2.62;
  const segmentCount = 116;
  for (let i = 0; i <= segmentCount; i++) {
    const t = i / segmentCount;
    const angle = -1.02 + t * Math.PI * 2 * turns;
    const radius = 1.27 + Math.sin(t * Math.PI * 4.2) * 0.07;
    helixPoints.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      0.72 + t * 9.35,
      Math.sin(angle) * radius
    ));
  }
  const serpentCurve = new THREE.CatmullRomCurve3(helixPoints);
  const coil = new THREE.Mesh(new THREE.TubeGeometry(serpentCurve, 148, 0.205, 10, false), serpent);
  coil.name = 'centerPillarSerpentBody';
  group.add(coil);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.16, 0.73, -0.38),
    new THREE.Vector3(-1.64, 0.58, -0.72),
    new THREE.Vector3(-1.72, 0.38, -1.22),
    new THREE.Vector3(-1.25, 0.23, -1.62)
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 28, 0.22, 10, false), serpentDark);
  tail.name = 'centerPillarSerpentTail';
  group.add(tail);

  const headAngle = -1.02 + Math.PI * 2 * turns;
  const outward = new THREE.Vector3(Math.cos(headAngle), 0, Math.sin(headAngle));
  const tangent = new THREE.Vector3(-Math.sin(headAngle), 0, Math.cos(headAngle));

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.98, 6), serpent);
  head.name = 'centerPillarSerpentHead';
  head.position.copy(outward).multiplyScalar(1.37);
  head.position.y = 10.38;
  head.rotation.x = Math.PI / 2;
  head.rotation.z = -headAngle + Math.PI / 2;
  group.add(head);

  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.15, 0.3), serpentDark);
  brow.position.copy(head.position).add(new THREE.Vector3(0, 0.19, 0));
  brow.rotation.y = -headAngle;
  group.add(brow);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), new THREE.MeshBasicMaterial({ color: 0xf4ce66 }));
    eye.name = side < 0 ? 'centerPillarSerpentEyeLeft' : 'centerPillarSerpentEyeRight';
    eye.position.copy(head.position)
      .addScaledVector(tangent, side * 0.18)
      .addScaledVector(outward, 0.04)
      .add(new THREE.Vector3(0, 0.19, 0));
    group.add(eye);
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.18;
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 8), bronze);
    stud.name = `centerPillarStud:${i}`;
    stud.rotation.x = Math.PI / 2;
    stud.position.set(Math.cos(angle) * 1.58, 0.56, Math.sin(angle) * 1.58);
    group.add(stud);
  }

  setShadow(group);
  const fallbackParts = [...group.children];
  group.userData.assetState = 'procedural-fallback';
  scene.add(group);

  if (typeof window !== 'undefined') {
    group.userData.assetState = 'loading-authored-glb';
    void replaceWithStaticGlb({
      holder: group,
      fallback: fallbackParts,
      url: CENTER_PILLAR_AUTHORED_ASSET_URL,
      name: 'centerPillarAuthoredGlb'
    });
  }

  return group;
}

function attachAuthoredArenaAsset(holder: THREE.Group, fallback: readonly THREE.Object3D[], url: string, name: string) {
  holder.userData.assetState = 'procedural-fallback';
  if (typeof window === 'undefined') return;

  holder.userData.assetState = 'loading-authored-glb';
  void replaceWithStaticGlb({ holder, fallback, url, name });
}

export function attachAuthoredArenaGate(holder: THREE.Group, fallback: readonly THREE.Object3D[]) {
  attachAuthoredArenaAsset(holder, fallback, ARENA_GATE_AUTHORED_ASSET_URL, 'arenaGateAuthoredGlb');
}

export function attachAuthoredSerpentColumn(holder: THREE.Group, fallback: readonly THREE.Object3D[]) {
  attachAuthoredArenaAsset(holder, fallback, SERPENT_COLUMN_AUTHORED_ASSET_URL, 'serpentColumnAuthoredGlb');
}

export function attachAuthoredArenaGong(holder: THREE.Group, fallback: readonly THREE.Object3D[]) {
  attachAuthoredArenaAsset(holder, fallback, ARENA_GONG_AUTHORED_ASSET_URL, 'arenaGongAuthoredGlb');
}

export function resolveCenterPillarCollision(position: THREE.Vector3, padding = CENTER_PILLAR_CLEARANCE) {
  const minimumDistance = CENTER_PILLAR_RADIUS + padding;
  const dx = position.x;
  const dz = position.z;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq >= minimumDistance * minimumDistance) return false;

  const distance = Math.sqrt(distanceSq);
  if (distance < 0.0001) {
    position.x = minimumDistance;
    position.z = 0;
    return true;
  }

  const scale = minimumDistance / distance;
  position.x = dx * scale;
  position.z = dz * scale;
  return true;
}

function distanceToSegment2D(
  pointX: number,
  pointZ: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number
) {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0.0001) return Math.hypot(pointX - startX, pointZ - startZ);
  const t = Math.max(0, Math.min(1, ((pointX - startX) * dx + (pointZ - startZ) * dz) / lengthSq));
  return Math.hypot(pointX - (startX + dx * t), pointZ - (startZ + dz * t));
}

export function updateCenterPillarOcclusion(
  group: THREE.Group,
  camera: THREE.Camera,
  playerPosition: THREE.Vector3,
  dt: number
) {
  const cameraToPlayer = playerPosition.clone().sub(camera.position);
  const playerDistance = cameraToPlayer.length();
  const cameraToCenter = new THREE.Vector3(-camera.position.x, 0, -camera.position.z);
  const centerDistance = cameraToCenter.length();
  const lineDistance = distanceToSegment2D(
    0,
    0,
    camera.position.x,
    camera.position.z,
    playerPosition.x,
    playerPosition.z
  );

  const blocksView = centerDistance < playerDistance && lineDistance < CENTER_PILLAR_RADIUS * 1.35;
  const targetOpacity = blocksView ? 0.34 : 1;
  const previous = Number(group.userData.visibilityOpacity ?? 1);
  const alpha = dt <= 0 ? 1 : 1 - Math.exp(-dt * (blocksView ? 11 : 6));
  const next = THREE.MathUtils.lerp(previous, targetOpacity, alpha);
  group.userData.visibilityOpacity = next;

  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const baseOpacity = Number(material.userData.baseOpacity ?? 1);
      material.opacity = baseOpacity * next;
      material.depthWrite = next > 0.72;
    }
  });
}
