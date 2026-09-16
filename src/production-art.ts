import * as THREE from 'three';

type FighterPart = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;

type ArtEffectKind = 'spark' | 'dust' | 'ring';

interface ArtEffect {
  node: THREE.Object3D;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  total: number;
  kind: ArtEffectKind;
}

interface FighterRig {
  group: THREE.Group;
  torso: FighterPart | null;
  head: FighterPart | null;
  leftArm: FighterPart | null;
  rightArm: FighterPart | null;
  leftLeg: FighterPart | null;
  rightLeg: FighterPart | null;
  weapon: FighterPart | null;
  shield: THREE.Mesh;
  aura: THREE.Group;
  primary: THREE.Color;
  accent: THREE.Color;
  previousPosition: THREE.Vector3;
  previousYaw: number;
  phase: number;
  hitLit: boolean;
  isPlayer: boolean;
  baseTorsoY: number;
  baseLeftArmZ: number;
  baseRightArmZ: number;
  baseWeaponZ: number;
}

interface SceneArtState {
  rigs: FighterRig[];
  effects: ArtEffect[];
  environment: THREE.Group | null;
  lastTime: number;
  scanTimer: number;
  lastDustAt: number;
}

const sceneStates = new WeakMap<THREE.Scene, SceneArtState>();
const sparkGeometry = new THREE.TetrahedronGeometry(0.115, 0);
const dustGeometry = new THREE.SphereGeometry(0.12, 7, 5);
const ringGeometry = new THREE.RingGeometry(0.66, 0.78, 32);
const tempVector = new THREE.Vector3();
const tempColor = new THREE.Color();

let attackUntil = 0;
let specialUntil = 0;
let dodgeUntil = 0;
let blockHeld = false;

function nowMs() {
  return performance.now();
}

function graphicsMode() {
  return document.documentElement.dataset.graphics ?? 'safe';
}

function safeGraphics() {
  return graphicsMode() === 'safe';
}

function standardMaterial(color: THREE.ColorRepresentation, roughness = 0.64, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function meshColor(mesh: FighterPart | null, fallback: number) {
  if (!mesh || Array.isArray(mesh.material) || !(mesh.material instanceof THREE.MeshStandardMaterial)) return new THREE.Color(fallback);
  return mesh.material.color.clone();
}

function directMeshes(group: THREE.Group) {
  return group.children.filter((child): child is FighterPart => child instanceof THREE.Mesh);
}

function geometryKind(mesh: FighterPart) {
  return mesh.geometry.type;
}

function looksLikeFighter(group: THREE.Group) {
  if (group.userData.productionArtEnvironment) return false;
  const meshes = directMeshes(group);
  if (meshes.length < 9 || meshes.length > 16) return false;
  const head = meshes.some((mesh) => geometryKind(mesh) === 'CylinderGeometry' && mesh.position.y > 1.75 && mesh.position.y < 2.3);
  const torso = meshes.some((mesh) => geometryKind(mesh) === 'BoxGeometry' && mesh.position.y > 1.0 && mesh.position.y < 1.55 && Math.abs(mesh.position.x) < 0.12);
  const legs = meshes.filter((mesh) => geometryKind(mesh) === 'BoxGeometry' && mesh.position.y > 0.25 && mesh.position.y < 0.7 && Math.abs(mesh.position.x) > 0.12 && Math.abs(mesh.position.x) < 0.42).length;
  return head && torso && legs >= 2;
}

function findPart(meshes: FighterPart[], predicate: (mesh: FighterPart) => boolean) {
  return meshes.find(predicate) ?? null;
}

function addStyledMesh(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], name: string) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.name = name;
  mesh.castShadow = !safeGraphics();
  mesh.receiveShadow = !safeGraphics();
  group.add(mesh);
  return mesh;
}

function buildAura(primary: THREE.Color, accent: THREE.Color) {
  const aura = new THREE.Group();
  aura.name = 'production-elemental-aura';
  for (let i = 0; i < 3; i++) {
    const color = i === 1 ? accent : primary;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.68 + i * 0.16, 0.035 + i * 0.008, 6, safeGraphics() ? 18 : 30),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.45 + i * 0.38;
    ring.userData.productionAuraIndex = i;
    aura.add(ring);
  }
  return aura;
}

function decorateFighter(group: THREE.Group, isPlayer: boolean): FighterRig {
  const meshes = directMeshes(group);
  const torso = findPart(meshes, (mesh) => geometryKind(mesh) === 'BoxGeometry' && mesh.position.y > 1.0 && mesh.position.y < 1.55 && Math.abs(mesh.position.x) < 0.12);
  const head = findPart(meshes, (mesh) => geometryKind(mesh) === 'CylinderGeometry' && mesh.position.y > 1.75 && mesh.position.y < 2.3);
  const leftLeg = findPart(meshes, (mesh) => geometryKind(mesh) === 'BoxGeometry' && mesh.position.y > 0.25 && mesh.position.y < 0.7 && mesh.position.x < -0.12);
  const rightLeg = findPart(meshes, (mesh) => geometryKind(mesh) === 'BoxGeometry' && mesh.position.y > 0.25 && mesh.position.y < 0.7 && mesh.position.x > 0.12 && mesh.position.x < 0.42);
  const leftArm = findPart(meshes, (mesh) => geometryKind(mesh) === 'BoxGeometry' && mesh.position.y > 1.0 && mesh.position.y < 1.6 && mesh.position.x < -0.45);
  const rightArm = findPart(meshes, (mesh) => geometryKind(mesh) === 'BoxGeometry' && mesh.position.y > 1.0 && mesh.position.y < 1.6 && mesh.position.x > 0.45 && mesh.position.x < 0.72);
  const weapon = findPart(meshes, (mesh) => geometryKind(mesh) === 'BoxGeometry' && Math.abs(mesh.position.x) > 0.72 && mesh.position.y > 1.0);

  const primary = meshColor(torso, 0x96332b);
  const accent = meshes.find((mesh) => mesh.position.y > 0.78 && mesh.position.y < 1.0 && Math.abs(mesh.position.x) < 0.2);
  const accentColor = meshColor(accent ?? null, 0xd4aa42);
  const primaryMat = standardMaterial(primary, 0.55, 0.02);
  const darkerPrimary = primary.clone().multiplyScalar(0.52);
  const darkMat = standardMaterial(darkerPrimary, 0.72, 0.03);
  const blackMat = standardMaterial(0x101115, 0.72, 0.02);
  const goldMat = standardMaterial(accentColor, 0.38, 0.28);
  const skinMat = standardMaterial(0xf3c84d, 0.58, 0.01);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf8efc8, emissive: 0x362b0d, emissiveIntensity: 0.45, roughness: 0.45 });

  // Hood crown and wrapped jaw give the silhouette a toy-like masked ninja read
  // without reproducing any commercial model or texture.
  addStyledMesh(group, new THREE.SphereGeometry(0.43, safeGraphics() ? 12 : 20, safeGraphics() ? 7 : 12, 0, Math.PI * 2, 0, Math.PI * 0.62), primaryMat, [0, 2.19, 0], 'production-hood-crown');
  addStyledMesh(group, new THREE.CylinderGeometry(0.405, 0.37, 0.26, safeGraphics() ? 12 : 20), primaryMat, [0, 1.93, 0], 'production-mask-wrap');
  addStyledMesh(group, new THREE.CylinderGeometry(0.105, 0.11, 0.08, 12), darkMat, [0, 2.53, 0], 'production-head-stud');
  addStyledMesh(group, new THREE.BoxGeometry(0.18, 0.055, 0.035), eyeMat, [-0.12, 2.075, 0.385], 'production-left-eye');
  addStyledMesh(group, new THREE.BoxGeometry(0.18, 0.055, 0.035), eyeMat, [0.12, 2.075, 0.385], 'production-right-eye');
  const browLeft = addStyledMesh(group, new THREE.BoxGeometry(0.2, 0.04, 0.03), blackMat, [-0.12, 2.145, 0.4], 'production-left-brow');
  const browRight = addStyledMesh(group, new THREE.BoxGeometry(0.2, 0.04, 0.03), blackMat, [0.12, 2.145, 0.4], 'production-right-brow');
  browLeft.rotation.z = -0.12;
  browRight.rotation.z = 0.12;

  // Layered gi, cross-body wraps and belt knot create readable detail from the
  // isometric camera while staying cheap enough for Safe mode.
  const leftWrap = addStyledMesh(group, new THREE.BoxGeometry(0.12, 0.82, 0.06), darkMat, [-0.17, 1.29, 0.275], 'production-left-wrap');
  leftWrap.rotation.z = -0.55;
  const rightWrap = addStyledMesh(group, new THREE.BoxGeometry(0.12, 0.82, 0.06), darkMat, [0.17, 1.29, 0.28], 'production-right-wrap');
  rightWrap.rotation.z = 0.55;
  const buckle = addStyledMesh(group, new THREE.CylinderGeometry(0.15, 0.15, 0.065, 16), goldMat, [0, 0.89, 0.31], 'production-belt-medallion');
  buckle.rotation.x = Math.PI / 2;
  addStyledMesh(group, new THREE.BoxGeometry(1.03, 0.14, 0.54), blackMat, [0, 1.62, -0.01], 'production-shoulder-yoke');
  addStyledMesh(group, new THREE.BoxGeometry(0.34, 0.12, 0.44), darkMat, [-0.23, 0.08, 0.03], 'production-left-boot');
  addStyledMesh(group, new THREE.BoxGeometry(0.34, 0.12, 0.44), darkMat, [0.23, 0.08, 0.03], 'production-right-boot');

  const leftHand = addStyledMesh(group, new THREE.SphereGeometry(0.145, 10, 7), skinMat, [-0.64, 0.92, 0], 'production-left-hand');
  const rightHand = addStyledMesh(group, new THREE.SphereGeometry(0.145, 10, 7), skinMat, [0.64, 0.92, 0], 'production-right-hand');
  leftHand.scale.y = 0.82;
  rightHand.scale.y = 0.82;
  addStyledMesh(group, new THREE.BoxGeometry(0.3, 0.12, 0.28), goldMat, [-0.58, 1.02, 0], 'production-left-cuff');
  addStyledMesh(group, new THREE.BoxGeometry(0.3, 0.12, 0.28), goldMat, [0.58, 1.02, 0], 'production-right-cuff');

  // Cloth tails animate subtly behind the fighter and make spins/dodges read better.
  const tailA = addStyledMesh(group, new THREE.BoxGeometry(0.12, 0.62, 0.07), primaryMat, [-0.13, 1.35, -0.38], 'production-tail-a');
  const tailB = addStyledMesh(group, new THREE.BoxGeometry(0.12, 0.52, 0.07), primaryMat, [0.12, 1.3, -0.4], 'production-tail-b');
  tailA.rotation.x = 0.34;
  tailA.rotation.z = 0.16;
  tailB.rotation.x = 0.46;
  tailB.rotation.z = -0.18;

  if (weapon) {
    const blade = addStyledMesh(group, new THREE.BoxGeometry(0.11, 0.92, 0.07), goldMat, [weapon.position.x + 0.08, weapon.position.y + 0.25, weapon.position.z + 0.03], 'production-weapon-blade');
    blade.rotation.copy(weapon.rotation);
    const guard = addStyledMesh(group, new THREE.BoxGeometry(0.44, 0.08, 0.12), blackMat, [weapon.position.x - 0.03, weapon.position.y - 0.16, weapon.position.z + 0.01], 'production-weapon-guard');
    guard.rotation.z = weapon.rotation.z;
  }

  const shield = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.76, 28, 1, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  shield.name = 'production-block-shield';
  shield.position.set(0, 1.25, 0.68);
  shield.rotation.z = Math.PI;
  group.add(shield);

  const aura = buildAura(primary, accentColor);
  group.add(aura);

  group.userData.productionArtFighter = true;
  group.userData.productionPrimary = `#${primary.getHexString()}`;

  return {
    group,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weapon,
    shield,
    aura,
    primary,
    accent: accentColor,
    previousPosition: group.position.clone(),
    previousYaw: group.rotation.y,
    phase: Math.random() * Math.PI * 2,
    hitLit: false,
    isPlayer,
    baseTorsoY: torso?.position.y ?? 1.28,
    baseLeftArmZ: leftArm?.rotation.z ?? -0.22,
    baseRightArmZ: rightArm?.rotation.z ?? 0.22,
    baseWeaponZ: weapon?.rotation.z ?? -0.45
  };
}

function createTempleTower(angle: number, lite: boolean) {
  const tower = new THREE.Group();
  const radius = 15.6;
  tower.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  tower.rotation.y = -angle + Math.PI / 2;
  const stone = standardMaterial(0x28282d, 0.9, 0.02);
  const red = standardMaterial(0x7f211e, 0.66, 0.03);
  const gold = standardMaterial(0xc69332, 0.4, 0.28);
  const roof = standardMaterial(0x15161a, 0.74, 0.08);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.65, 0.55, 8), stone);
  base.position.y = 0.27;
  tower.add(base);
  for (const x of [-0.92, 0.92]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.4, 0.24), red);
    post.position.set(x, 2.0, 0);
    tower.add(post);
  }
  const upper = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.28, 1.32), gold);
  upper.position.y = 3.45;
  tower.add(upper);
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(2.15, 0.82, 4), roof);
  roofMesh.position.y = 4.02;
  roofMesh.rotation.y = Math.PI / 4;
  tower.add(roofMesh);

  if (!lite) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffa33b, emissive: 0xff6a16, emissiveIntensity: 2.4, roughness: 0.4 }));
    lamp.position.set(0, 2.72, 0.42);
    tower.add(lamp);
  }
  tower.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = !lite;
      node.receiveShadow = !lite;
    }
  });
  return tower;
}

function buildEnvironment(scene: THREE.Scene) {
  const lite = safeGraphics();
  const environment = new THREE.Group();
  environment.name = 'production-art-environment';
  environment.userData.productionArtEnvironment = true;

  // A layered tournament seal gives the arena a deliberate focal point.
  const gold = new THREE.MeshBasicMaterial({ color: 0xd5a139, transparent: true, opacity: lite ? 0.3 : 0.48, side: THREE.DoubleSide, depthWrite: false });
  const red = new THREE.MeshBasicMaterial({ color: 0x8f2921, transparent: true, opacity: lite ? 0.2 : 0.4, side: THREE.DoubleSide, depthWrite: false });
  for (const [inner, outer, material] of [[2.2, 2.28, gold], [3.45, 3.55, red], [5.0, 5.08, gold]] as const) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, lite ? 36 : 64), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    environment.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 4.6), i % 2 ? red : gold);
    spoke.rotation.y = i * Math.PI / 4;
    spoke.position.y = 0.075;
    environment.add(spoke);
  }

  const towerCount = lite ? 2 : 4;
  for (let i = 0; i < towerCount; i++) environment.add(createTempleTower((i / towerCount) * Math.PI * 2 + Math.PI / 4, lite));

  // Audience silhouettes are intentionally abstract toy spectators rather than
  // replicas of any named commercial character.
  const spectatorCount = lite ? 8 : 24;
  const spectatorMat = standardMaterial(0x17181d, 0.9, 0.0);
  for (let i = 0; i < spectatorCount; i++) {
    const angle = (i / spectatorCount) * Math.PI * 2 + 0.09;
    const radius = 13.7 + (i % 3) * 0.28;
    const spectator = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.24), spectatorMat);
    body.position.y = 1.08 + (i % 2) * 0.13;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.22, 10), spectatorMat);
    head.position.y = body.position.y + 0.4;
    spectator.add(body, head);
    spectator.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    spectator.rotation.y = -angle - Math.PI / 2;
    environment.add(spectator);
  }

  if (!lite) {
    const emberMaterial = new THREE.MeshBasicMaterial({ color: 0xff8a38, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 14; i++) {
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.035, 6, 4), emberMaterial.clone());
      ember.position.set((Math.random() - 0.5) * 19, 0.7 + Math.random() * 3.8, (Math.random() - 0.5) * 19);
      ember.userData.productionEmber = true;
      ember.userData.productionEmberOffset = Math.random() * Math.PI * 2;
      environment.add(ember);
    }
  }

  scene.add(environment);
  return environment;
}

function createSceneState(scene: THREE.Scene): SceneArtState {
  const state: SceneArtState = {
    rigs: [],
    effects: [],
    environment: null,
    lastTime: nowMs(),
    scanTimer: 0,
    lastDustAt: 0
  };
  sceneStates.set(scene, state);
  return state;
}

function spawnSpark(state: SceneArtState, scene: THREE.Scene, position: THREE.Vector3, color: THREE.Color, count: number) {
  const actualCount = safeGraphics() ? Math.min(4, count) : count;
  for (let i = 0; i < actualCount; i++) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending });
    const spark = new THREE.Mesh(sparkGeometry, material);
    spark.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.55, Math.random() * 0.35, (Math.random() - 0.5) * 0.55));
    spark.scale.setScalar(0.65 + Math.random() * 0.85);
    scene.add(spark);
    state.effects.push({
      node: spark,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 4.2, 1.6 + Math.random() * 3.4, (Math.random() - 0.5) * 4.2),
      spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      life: 0.38 + Math.random() * 0.24,
      total: 0.62,
      kind: 'spark'
    });
  }
}

function spawnDust(state: SceneArtState, scene: THREE.Scene, position: THREE.Vector3) {
  const count = safeGraphics() ? 2 : 5;
  for (let i = 0; i < count; i++) {
    const dust = new THREE.Mesh(dustGeometry, new THREE.MeshBasicMaterial({ color: 0xb8a98e, transparent: true, opacity: 0.32, depthWrite: false }));
    dust.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.65, 0.12, (Math.random() - 0.5) * 0.65));
    scene.add(dust);
    state.effects.push({
      node: dust,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.3, 0.5 + Math.random() * 0.45, (Math.random() - 0.5) * 1.3),
      spin: new THREE.Vector3(),
      life: 0.42,
      total: 0.42,
      kind: 'dust'
    });
  }
}

function spawnActionRing(state: SceneArtState, scene: THREE.Scene, position: THREE.Vector3, color: THREE.Color) {
  const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.64, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(position).setY(0.08);
  ring.scale.setScalar(0.35);
  scene.add(ring);
  state.effects.push({ node: ring, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0.34, total: 0.34, kind: 'ring' });
}

function updateEffects(state: SceneArtState, scene: THREE.Scene, dt: number) {
  for (const effect of [...state.effects]) {
    effect.life -= dt;
    const t = Math.max(0, effect.life / effect.total);
    if (effect.kind === 'ring') {
      const scale = 0.35 + (1 - t) * 2.65;
      effect.node.scale.setScalar(scale);
    } else {
      effect.velocity.y -= effect.kind === 'spark' ? 7.5 * dt : 0.5 * dt;
      effect.node.position.addScaledVector(effect.velocity, dt);
      effect.node.rotation.x += effect.spin.x * dt;
      effect.node.rotation.y += effect.spin.y * dt;
      effect.node.rotation.z += effect.spin.z * dt;
      if (effect.kind === 'dust') effect.node.scale.multiplyScalar(1 + dt * 2.1);
    }
    effect.node.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return;
      const material = child.material;
      if ('opacity' in material) material.opacity = (effect.kind === 'spark' ? 0.92 : effect.kind === 'ring' ? 0.64 : 0.32) * t;
    });
    if (effect.life <= 0) {
      scene.remove(effect.node);
      state.effects.splice(state.effects.indexOf(effect), 1);
    }
  }
}

function updateEnvironment(environment: THREE.Group | null, now: number) {
  if (!environment) return;
  environment.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.userData.productionEmber) return;
    const offset = Number(node.userData.productionEmberOffset ?? 0);
    node.position.y += Math.sin(now * 0.0014 + offset) * 0.0025;
    const material = node.material;
    if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0.38 + (Math.sin(now * 0.004 + offset) + 1) * 0.18;
    }
  });
}

function hasHitGlow(rig: FighterRig) {
  let glowing = false;
  rig.group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || Array.isArray(node.material) || !(node.material instanceof THREE.MeshStandardMaterial)) return;
    const emissive = node.material.emissive;
    if (emissive.r + emissive.g + emissive.b > 0.16) glowing = true;
  });
  return glowing;
}

function resetLimb(rig: FighterRig) {
  if (rig.leftArm) {
    rig.leftArm.rotation.x *= 0.72;
    rig.leftArm.rotation.z += (rig.baseLeftArmZ - rig.leftArm.rotation.z) * 0.25;
  }
  if (rig.rightArm) {
    rig.rightArm.rotation.x *= 0.72;
    rig.rightArm.rotation.z += (rig.baseRightArmZ - rig.rightArm.rotation.z) * 0.25;
  }
  if (rig.leftLeg) rig.leftLeg.rotation.x *= 0.72;
  if (rig.rightLeg) rig.rightLeg.rotation.x *= 0.72;
  if (rig.weapon) rig.weapon.rotation.z += (rig.baseWeaponZ - rig.weapon.rotation.z) * 0.2;
}

function updateRig(rig: FighterRig, state: SceneArtState, scene: THREE.Scene, dt: number, now: number) {
  tempVector.copy(rig.group.position).sub(rig.previousPosition);
  const planarDistance = Math.hypot(tempVector.x, tempVector.z);
  const speed = dt > 0.0001 ? planarDistance / dt : 0;
  rig.phase += dt * (speed > 0.15 ? Math.min(12, 5 + speed * 0.8) : 2.4);

  const gait = Math.sin(rig.phase);
  const moving = speed > 0.22;
  if (moving) {
    if (rig.leftLeg) rig.leftLeg.rotation.x = gait * 0.42;
    if (rig.rightLeg) rig.rightLeg.rotation.x = -gait * 0.42;
    if (rig.leftArm) rig.leftArm.rotation.x = -gait * 0.34;
    if (rig.rightArm) rig.rightArm.rotation.x = gait * 0.34;
    if (rig.torso) rig.torso.position.y = rig.baseTorsoY + Math.abs(gait) * 0.018;
  } else {
    resetLimb(rig);
    if (rig.torso) rig.torso.position.y = rig.baseTorsoY + Math.sin(rig.phase) * 0.012;
  }

  if (rig.isPlayer && now < attackUntil) {
    const remaining = Math.max(0, attackUntil - now) / 260;
    const swing = Math.sin((1 - remaining) * Math.PI);
    if (rig.rightArm) rig.rightArm.rotation.x = -0.45 - swing * 1.45;
    if (rig.weapon) rig.weapon.rotation.z = rig.baseWeaponZ - swing * 0.9;
  }

  const blockActive = rig.isPlayer && blockHeld;
  const shieldMaterial = rig.shield.material as THREE.MeshBasicMaterial;
  shieldMaterial.opacity += ((blockActive ? 0.6 : 0) - shieldMaterial.opacity) * Math.min(1, dt * 14);
  rig.shield.scale.setScalar(blockActive ? 1 + Math.sin(now * 0.012) * 0.035 : 0.95);
  if (blockActive && rig.leftArm && rig.rightArm) {
    rig.leftArm.rotation.x = -0.85;
    rig.rightArm.rotation.x = -0.85;
    rig.leftArm.rotation.z = -0.45;
    rig.rightArm.rotation.z = 0.45;
  }

  const specialActive = rig.isPlayer && now < specialUntil;
  rig.aura.visible = specialActive;
  rig.aura.children.forEach((child, index) => {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material) || !(child.material instanceof THREE.MeshBasicMaterial)) return;
    child.rotation.z = now * (0.0045 + index * 0.0014) * (index % 2 ? -1 : 1);
    child.scale.setScalar(0.9 + Math.sin(now * 0.009 + index) * 0.12);
    child.material.opacity = specialActive ? 0.46 - index * 0.08 : 0;
  });

  const hitGlow = hasHitGlow(rig);
  if (hitGlow && !rig.hitLit) {
    const impact = rig.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    tempColor.copy(rig.accent).lerp(new THREE.Color(0xffffff), 0.28);
    spawnSpark(state, scene, impact, tempColor, rig.isPlayer ? 6 : 8);
    spawnActionRing(state, scene, rig.group.position, rig.accent);
  }
  rig.hitLit = hitGlow;

  const dodgeRead = Math.abs(rig.group.rotation.z) > 0.075 || (rig.isPlayer && now < dodgeUntil);
  if (rig.isPlayer && dodgeRead && now - state.lastDustAt > (safeGraphics() ? 150 : 85)) {
    state.lastDustAt = now;
    spawnDust(state, scene, rig.group.position);
  }

  rig.previousPosition.copy(rig.group.position);
  rig.previousYaw = rig.group.rotation.y;
}

function decorateBrickBursts(scene: THREE.Scene) {
  for (const child of scene.children) {
    if (!(child instanceof THREE.Mesh) || child.userData.productionBrickStud || child.geometry.type !== 'BoxGeometry') continue;
    const params = (child.geometry as THREE.BoxGeometry).parameters;
    if (!params || params.width > 0.55 || params.height > 0.35 || params.depth > 0.65) continue;
    child.userData.productionBrickStud = true;
    child.castShadow = !safeGraphics();
    const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
    const color = sourceMaterial instanceof THREE.MeshStandardMaterial ? sourceMaterial.color.clone() : new THREE.Color(0xb48a33);
    const stud = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(0.08, params.width * 0.28), Math.min(0.08, params.width * 0.28), 0.055, 8), standardMaterial(color, 0.52, 0.05));
    stud.position.y = params.height / 2 + 0.027;
    child.add(stud);
  }
}

function syncFighters(scene: THREE.Scene, state: SceneArtState) {
  const groups = scene.children.filter((child): child is THREE.Group => child instanceof THREE.Group && looksLikeFighter(child));
  for (const group of groups) {
    if (group.userData.productionArtFighter) continue;
    const rig = decorateFighter(group, state.rigs.length === 0);
    state.rigs.push(rig);
  }
  state.rigs = state.rigs.filter((rig) => rig.group.parent === scene);
  if (!state.environment && state.rigs.length > 0) state.environment = buildEnvironment(scene);
}

function updateSceneArt(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const state = sceneStates.get(scene) ?? createSceneState(scene);
  const now = nowMs();
  const dt = Math.min(0.05, Math.max(0.001, (now - state.lastTime) / 1000));
  state.lastTime = now;
  state.scanTimer -= dt;
  if (state.scanTimer <= 0) {
    syncFighters(scene, state);
    decorateBrickBursts(scene);
    state.scanTimer = 0.16;
  }
  for (const rig of state.rigs) updateRig(rig, state, scene, dt, now);
  updateEffects(state, scene, dt);
  updateEnvironment(state.environment, now);

  const host = renderer.domElement.parentElement;
  if (host?.id === 'game-host' || host?.id === 'dojo-host') host.dataset.productionScene = 'ready';
}

const rendererPrototype = THREE.WebGLRenderer.prototype as unknown as {
  render: (scene: THREE.Scene, camera: THREE.Camera) => void;
};
const previousRender = rendererPrototype.render;
rendererPrototype.render = function productionArtRender(this: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  updateSceneArt(scene, this);
  previousRender.call(this, scene, camera);
};

function markAction(action: 'attack' | 'special' | 'dodge') {
  const now = nowMs();
  if (action === 'attack') attackUntil = now + 260;
  if (action === 'special') specialUntil = now + 1650;
  if (action === 'dodge') dodgeUntil = now + 380;
}

window.addEventListener('keydown', (event) => {
  if (!event.repeat && (event.code === 'KeyJ' || event.code === 'Space')) markAction('attack');
  if (!event.repeat && event.code === 'KeyE') markAction('special');
  if (!event.repeat && event.code === 'KeyQ') markAction('dodge');
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') blockHeld = true;
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') blockHeld = false;
});

document.addEventListener('pointerdown', (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button') : null;
  if (!target) return;
  if (target.matches('[data-action="attack"], [data-dojo-action="attack"]')) markAction('attack');
  if (target.matches('#special-btn, #dojo-special')) markAction('special');
  if (target.matches('#block-btn, #dojo-block')) blockHeld = true;
});
document.addEventListener('pointerup', () => { blockHeld = false; });
document.addEventListener('pointercancel', () => { blockHeld = false; });

function showShopToast(message: string) {
  document.querySelector('.production-shop-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'production-shop-toast';
  toast.innerHTML = `<i>✦</i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 220);
  }, 1450);
}

function enhanceShop(overlay: HTMLElement) {
  if (overlay.dataset.artPolished === 'true') return;
  overlay.dataset.artPolished = 'true';
  const panel = overlay.querySelector<HTMLElement>('.powerup-panel');
  const header = panel?.querySelector('header');
  if (!panel || !header) return;

  const tabs = document.createElement('nav');
  tabs.className = 'shop-production-tabs';
  tabs.innerHTML = `<button class="active" type="button">POWER-UPS</button><button type="button" data-shop-fighters>FIGHTERS</button><button type="button" data-shop-loadout>LOADOUT</button>`;
  header.insertAdjacentElement('afterend', tabs);
  tabs.querySelector<HTMLButtonElement>('[data-shop-fighters]')?.addEventListener('click', () => overlay.querySelector<HTMLButtonElement>('#fighter-market-btn')?.click());
  tabs.querySelector<HTMLButtonElement>('[data-shop-loadout]')?.addEventListener('click', () => overlay.querySelector<HTMLElement>('.powerup-note')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));

  overlay.querySelectorAll<HTMLElement>('[data-powerup-card]').forEach((card, index) => {
    card.dataset.rarity = index === 2 ? 'ELITE' : index === 1 ? 'RARE' : 'UNCOMMON';
    if (card.querySelector('.production-item-art')) return;
    const art = document.createElement('div');
    art.className = 'production-item-art';
    art.innerHTML = `<span></span><b>${card.dataset.rarity}</b>`;
    card.prepend(art);
  });
}

function enhanceMenu(menu: HTMLElement) {
  if (menu.dataset.artPolished === 'true') return;
  menu.dataset.artPolished = 'true';
  const title = menu.querySelector('.title-card');
  if (!title || title.querySelector('.production-menu-kicker')) return;
  const kicker = document.createElement('div');
  kicker.className = 'production-menu-kicker';
  kicker.innerHTML = '<i></i><span>ISLAND TOURNAMENT</span><i></i>';
  title.prepend(kicker);
}

function enhanceHud(game: HTMLElement) {
  if (game.dataset.artPolished === 'true') return;
  game.dataset.artPolished = 'true';
  const center = game.querySelector('.hud-center');
  if (center && !center.querySelector('.production-hud-mark')) {
    const mark = document.createElement('i');
    mark.className = 'production-hud-mark';
    center.prepend(mark);
  }
}

function enhanceDom() {
  document.documentElement.dataset.productionArt = 'v2';
  const menu = document.querySelector<HTMLElement>('main.menu-screen');
  if (menu) enhanceMenu(menu);
  const shop = document.querySelector<HTMLElement>('#powerup-overlay');
  if (shop) enhanceShop(shop);
  const game = document.querySelector<HTMLElement>('main.game-screen');
  if (game) enhanceHud(game);
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
  if (!target) return;
  if (target.matches('[data-buy-powerup]') && !target.disabled) window.setTimeout(() => showShopToast('POWER-UP ACQUIRED'), 40);
  if (target.matches('[data-equip-powerup]') && !target.disabled) window.setTimeout(() => showShopToast('LOADOUT UPDATED'), 40);
}, { capture: true });

const domObserver = new MutationObserver(enhanceDom);
domObserver.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhanceDom);
enhanceDom();
