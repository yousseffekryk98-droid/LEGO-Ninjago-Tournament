import * as THREE from 'three';
import type { FighterArchetype, FighterModelProfile, FighterWeapon } from '../model-types';

export interface MinifigureModelOptions {
  primary: number;
  accent: number;
  scale?: number;
  profile?: FighterModelProfile;
}

const DEFAULT_PROFILE: FighterModelProfile = {
  archetype: 'ninja',
  weapon: 'katana',
  hood: true,
  shoulderArmor: false,
  extraArms: false,
  metallic: false
};

function material(color: number, metallic = false, roughness = 0.3) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: metallic ? 0.2 : roughness,
    metalness: metallic ? 0.64 : 0.01,
    clearcoat: metallic ? 0.34 : 0.86,
    clearcoatRoughness: metallic ? 0.18 : 0.14,
    sheen: metallic ? 0.08 : 0.16,
    sheenRoughness: 0.42
  });
}

function addMesh(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  meshMaterial: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createTorsoGeometry(topWidth = 0.82, bottomWidth = 0.96, height = 0.9, depth = 0.52) {
  const top = topWidth / 2;
  const bottom = bottomWidth / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;
  const vertices = new Float32Array([
    -bottom, -halfHeight, halfDepth,  bottom, -halfHeight, halfDepth,  top, halfHeight, halfDepth, -top, halfHeight, halfDepth,
    -bottom, -halfHeight, -halfDepth, bottom, -halfHeight, -halfDepth, top, halfHeight, -halfDepth, -top, halfHeight, -halfDepth
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    1, 5, 6, 1, 6, 2,
    5, 4, 7, 5, 7, 6,
    4, 0, 3, 4, 3, 7,
    3, 2, 6, 3, 6, 7,
    4, 5, 1, 4, 1, 0
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addCHand(group: THREE.Group, name: string, hand: THREE.Material, side: -1 | 1) {
  const x = side * 0.7;
  addMesh(group, `${name}Wrist`, new THREE.CylinderGeometry(0.075, 0.075, 0.18, 12), hand, [x, 1.0, 0.01], [0, 0, side * 0.2]);
  const hook = addMesh(
    group,
    name,
    new THREE.TorusGeometry(0.105, 0.045, 8, 20, Math.PI * 1.55),
    hand,
    [side * 0.72, 0.92, 0.03],
    [0, 0, side > 0 ? 0.68 : -2.46]
  );
  hook.scale.y = 1.08;
}

function addArm(
  group: THREE.Group,
  name: 'leftArm' | 'rightArm',
  primary: THREE.Material,
  accent: THREE.Material,
  hand: THREE.Material,
  side: -1 | 1
) {
  const rig = new THREE.Group();
  rig.name = name;
  rig.position.set(side * 0.5, 1.58, 0);
  rig.rotation.z = side * 0.18;
  rig.userData.animationPart = name;
  group.add(rig);

  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.36, 4, 10), primary);
  arm.name = `${name}Body`;
  arm.position.set(side * 0.055, -0.31, 0);
  arm.rotation.z = side * 0.055;
  arm.castShadow = true;
  arm.receiveShadow = true;
  rig.add(arm);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 12), hand);
  wrist.name = `${name}Wrist`;
  wrist.position.set(side * 0.11, -0.62, 0.01);
  wrist.rotation.z = side * 0.2;
  wrist.castShadow = true;
  rig.add(wrist);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.125, 0.15, 12), accent);
  cuff.name = `${name}Cuff`;
  cuff.position.set(side * 0.105, -0.53, 0.01);
  cuff.rotation.z = side * 0.11;
  cuff.castShadow = true;
  rig.add(cuff);

  const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.22), accent);
  wrap.name = `${name}Wrap`;
  wrap.position.set(side * 0.085, -0.42, 0.015);
  wrap.rotation.z = side * 0.08;
  wrap.castShadow = true;
  rig.add(wrap);

  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.043, 8, 20, Math.PI * 1.55), hand);
  hook.name = name === 'leftArm' ? 'leftHand' : 'rightHand';
  hook.position.set(side * 0.13, -0.76, 0.03);
  hook.rotation.z = side > 0 ? 0.68 : -2.46;
  hook.scale.y = 1.08;
  hook.castShadow = true;
  rig.add(hook);
  return rig;
}

function addTorsoPrint(group: THREE.Group, accent: THREE.Material, dark: THREE.Material) {
  addMesh(group, 'torsoUnderlayer', new THREE.BoxGeometry(0.5, 0.46, 0.024), dark, [0, 1.31, 0.273]);
  addMesh(group, 'torsoSash', new THREE.BoxGeometry(0.12, 0.78, 0.026), accent, [0.02, 1.34, 0.288], [0, 0, -0.55]);
  addMesh(group, 'torsoSashEdge', new THREE.BoxGeometry(0.052, 0.73, 0.028), dark, [-0.06, 1.34, 0.292], [0, 0, -0.55]);
  addMesh(group, 'torsoTrim', new THREE.BoxGeometry(0.64, 0.065, 0.028), accent, [0, 1.5, 0.29], [0, 0, 0.04]);

  // Layered collar and wrap details read more like printed NINJAGO robes while
  // remaining original procedural geometry rather than copied textures.
  addMesh(group, 'collarLeft', new THREE.BoxGeometry(0.1, 0.43, 0.027), dark, [-0.13, 1.56, 0.295], [0, 0, -0.54]);
  addMesh(group, 'collarRight', new THREE.BoxGeometry(0.1, 0.43, 0.027), accent, [0.13, 1.56, 0.296], [0, 0, 0.54]);
  addMesh(group, 'waistWrapTop', new THREE.BoxGeometry(0.82, 0.065, 0.03), dark, [0, 1.02, 0.296]);
  addMesh(group, 'waistWrapBottom', new THREE.BoxGeometry(0.82, 0.05, 0.03), accent, [0, 0.96, 0.298]);
  addMesh(group, 'robeFoldLeft', new THREE.BoxGeometry(0.055, 0.34, 0.025), dark, [-0.22, 1.18, 0.292], [0, 0, -0.12]);
  addMesh(group, 'robeFoldRight', new THREE.BoxGeometry(0.055, 0.31, 0.025), accent, [0.24, 1.18, 0.292], [0, 0, 0.12]);

  const badge = addMesh(group, 'elementBadge', new THREE.CylinderGeometry(0.105, 0.105, 0.03, 18), accent, [0.23, 1.54, 0.305], [Math.PI / 2, 0, 0]);
  badge.scale.x = 0.92;
  addMesh(group, 'beltKnot', new THREE.BoxGeometry(0.19, 0.12, 0.05), dark, [0, 0.91, 0.3]);
  addMesh(group, 'beltTailLeft', new THREE.BoxGeometry(0.08, 0.34, 0.035), accent, [-0.07, 0.75, 0.29], [0, 0, -0.12]);
  addMesh(group, 'beltTailRight', new THREE.BoxGeometry(0.08, 0.28, 0.035), accent, [0.07, 0.77, 0.29], [0, 0, 0.1]);
}

function addKatana(group: THREE.Group, accent: THREE.Material, side: 1 | -1, index = 0) {
  const x = side * (0.75 + index * 0.08);
  const grip = material(0x28242b, false, 0.48);
  addMesh(group, `katanaHandle${side}_${index}`, new THREE.CylinderGeometry(0.058, 0.058, 0.42, 10), grip, [x, 1.05, 0.08], [0, 0, side * 0.32]);
  addMesh(group, `katanaGuard${side}_${index}`, new THREE.BoxGeometry(0.28, 0.055, 0.12), accent, [x + side * 0.065, 1.28, 0.08], [0, 0, side * 0.32]);
  const blade = addMesh(group, `katanaBlade${side}_${index}`, new THREE.BoxGeometry(0.065, 1.02, 0.095), accent, [x + side * 0.14, 1.78, 0.08], [0, 0, side * 0.32]);
  blade.scale.y = 1.08;
  addMesh(group, `katanaTip${side}_${index}`, new THREE.ConeGeometry(0.065, 0.28, 6), accent, [x + side * 0.25, 2.33, 0.08], [0, 0, side * 0.32]);
}

function addStaff(group: THREE.Group, accent: THREE.Material) {
  addMesh(group, 'staff', new THREE.CylinderGeometry(0.055, 0.065, 2.05, 10), accent, [0.78, 1.25, 0.04], [0, 0, -0.22]);
  addMesh(group, 'staffTop', new THREE.OctahedronGeometry(0.18, 0), accent, [1.0, 2.18, 0.04]);
}

function addSpear(group: THREE.Group, accent: THREE.Material) {
  addMesh(group, 'spearShaft', new THREE.CylinderGeometry(0.045, 0.055, 2.0, 10), accent, [0.78, 1.22, 0.06], [0, 0, -0.2]);
  addMesh(group, 'spearHead', new THREE.ConeGeometry(0.14, 0.44, 8), accent, [0.98, 2.2, 0.06], [0, 0, -0.2]);
}

function addScythe(group: THREE.Group, accent: THREE.Material) {
  addMesh(group, 'scytheShaft', new THREE.CylinderGeometry(0.05, 0.06, 2.05, 10), accent, [0.76, 1.2, 0.06], [0, 0, -0.25]);
  addMesh(group, 'scytheBlade', new THREE.BoxGeometry(0.72, 0.08, 0.16), accent, [0.82, 2.12, 0.06], [0, 0, 0.42]);
}

function addNunchucks(group: THREE.Group, accent: THREE.Material) {
  addMesh(group, 'nunchuckA', new THREE.CylinderGeometry(0.07, 0.07, 0.56, 10), accent, [0.72, 1.15, 0.06], [0, 0, -0.28]);
  addMesh(group, 'nunchuckB', new THREE.CylinderGeometry(0.07, 0.07, 0.56, 10), accent, [1.02, 1.58, 0.06], [0, 0, 0.32]);
  const chainMaterial = new THREE.LineBasicMaterial({ color: 0x9ca4ad });
  const chainGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0.78, 1.42, 0.06),
    new THREE.Vector3(0.88, 1.52, 0.06),
    new THREE.Vector3(0.96, 1.34, 0.06)
  ]);
  const chain = new THREE.Line(chainGeometry, chainMaterial);
  chain.name = 'nunchuckChain';
  group.add(chain);
}

function addShuriken(group: THREE.Group, accent: THREE.Material) {
  for (const side of [-1, 1] as const) {
    const star = addMesh(group, `shuriken${side}`, new THREE.OctahedronGeometry(0.22, 0), accent, [side * 0.78, 1.18, 0.16], [0.35, 0, Math.PI / 4]);
    star.scale.set(1.25, 0.18, 1.25);
  }
}

function addClaws(group: THREE.Group, accent: THREE.Material) {
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 2; i++) {
      addMesh(
        group,
        `claw${side}_${i}`,
        new THREE.ConeGeometry(0.055, 0.42, 8),
        accent,
        [side * (0.69 + i * 0.07), 1.0 - i * 0.05, 0.18],
        [Math.PI / 2, 0, side * 0.12]
      );
    }
  }
}

function addWeapon(group: THREE.Group, weapon: FighterWeapon, accent: THREE.Material) {
  if (weapon === 'none') return;
  if (weapon === 'katana') return addKatana(group, accent, 1);
  if (weapon === 'dual-katana') {
    addKatana(group, accent, 1);
    addKatana(group, accent, -1);
    return;
  }
  if (weapon === 'staff') return addStaff(group, accent);
  if (weapon === 'spear') return addSpear(group, accent);
  if (weapon === 'scythe') return addScythe(group, accent);
  if (weapon === 'nunchucks') return addNunchucks(group, accent);
  if (weapon === 'shuriken') return addShuriken(group, accent);
  if (weapon === 'claws') return addClaws(group, accent);
}

function addSerpentineTail(group: THREE.Group, primary: THREE.Material, accent: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.48, 0),
    new THREE.Vector3(0.08, 0.23, -0.3),
    new THREE.Vector3(-0.18, 0.14, -0.68),
    new THREE.Vector3(0.22, 0.1, -1.08)
  ]);
  const tail = addMesh(group, 'serpentineTail', new THREE.TubeGeometry(curve, 18, 0.18, 10, false), primary, [0, 0, 0]);
  tail.castShadow = true;
  addMesh(group, 'tailTip', new THREE.ConeGeometry(0.2, 0.45, 8), accent, [0.27, 0.12, -1.18], [Math.PI / 2.2, 0, -0.25]);
}

function addSkeletonRibs(group: THREE.Group, bone: THREE.Material, dark: THREE.Material) {
  addMesh(group, 'spine', new THREE.BoxGeometry(0.12, 0.72, 0.12), bone, [0, 1.3, 0]);
  for (let i = 0; i < 4; i++) {
    addMesh(group, `rib${i}`, new THREE.BoxGeometry(0.72 - i * 0.06, 0.07, 0.1), bone, [0, 1.55 - i * 0.17, 0]);
  }
  addMesh(group, 'ribShadow', new THREE.BoxGeometry(0.5, 0.42, 0.05), dark, [0, 1.32, -0.08]);
}

function addExtraArms(group: THREE.Group, primary: THREE.Material, hand: THREE.Material) {
  for (const side of [-1, 1] as const) {
    const upper = addMesh(group, side < 0 ? 'leftArmUpper' : 'rightArmUpper', new THREE.BoxGeometry(0.2, 0.62, 0.22), primary, [side * 0.58, 1.58, 0], [0, 0, side * 0.42]);
    upper.rotation.x = -0.12;
    addMesh(group, side < 0 ? 'leftHandUpper' : 'rightHandUpper', new THREE.SphereGeometry(0.13, 12, 8), hand, [side * 0.78, 1.31, 0.02]);
  }
}

function addIdentityDetails(
  group: THREE.Group,
  profile: FighterModelProfile,
  primary: THREE.Material,
  accent: THREE.Material,
  dark: THREE.Material,
  skin: THREE.Material
) {
  const style = profile.identityStyle;
  if (!style) return;

  if (style === 'chen') {
    addMesh(group, 'chenHatBrim', new THREE.CylinderGeometry(0.58, 0.58, 0.09, 28), dark, [0, 2.42, 0]);
    const crown = addMesh(group, 'chenHatCrown', new THREE.CylinderGeometry(0.31, 0.4, 0.42, 20), primary, [0, 2.62, -0.02]);
    crown.rotation.z = -0.06;
    addMesh(group, 'chenHatBand', new THREE.CylinderGeometry(0.405, 0.405, 0.08, 20), accent, [0, 2.48, -0.02]);
    addMesh(group, 'chenBeardLeft', new THREE.BoxGeometry(0.12, 0.28, 0.055), dark, [-0.13, 1.84, 0.34], [0, 0, -0.18]);
    addMesh(group, 'chenBeardRight', new THREE.BoxGeometry(0.12, 0.28, 0.055), dark, [0.13, 1.84, 0.34], [0, 0, 0.18]);
    addMesh(group, 'chenCollarGem', new THREE.OctahedronGeometry(0.12, 0), accent, [0, 1.6, 0.36]);
    return;
  }

  if (style === 'clouse') {
    addMesh(group, 'clouseForeheadGem', new THREE.OctahedronGeometry(0.09, 0), accent, [0, 2.19, 0.365]);
    addMesh(group, 'clouseHoodPeak', new THREE.ConeGeometry(0.18, 0.52, 10), primary, [0, 2.66, -0.08], [0.08, 0, 0]);
    for (const side of [-1, 1] as const) {
      addMesh(group, `clouseShoulderCharm${side}`, new THREE.TorusGeometry(0.12, 0.025, 7, 18), accent, [side * 0.62, 1.58, 0.12], [Math.PI / 2, 0, 0]);
    }
    return;
  }

  if (style === 'eyezor') {
    addMesh(group, 'eyezorPatch', new THREE.BoxGeometry(0.2, 0.12, 0.045), dark, [-0.13, 2.08, 0.365], [0, 0, 0.14]);
    addMesh(group, 'eyezorPatchStrap', new THREE.BoxGeometry(0.52, 0.035, 0.025), dark, [0, 2.12, 0.355], [0, 0, -0.12]);
    addMesh(group, 'eyezorScar', new THREE.BoxGeometry(0.035, 0.22, 0.026), accent, [0.17, 2.02, 0.36], [0, 0, 0.25]);
    return;
  }

  if (style === 'zugu') {
    addMesh(group, 'zuguHeadBand', new THREE.BoxGeometry(0.66, 0.08, 0.05), accent, [0, 2.17, 0.35]);
    addMesh(group, 'zuguJawGuard', new THREE.BoxGeometry(0.46, 0.16, 0.065), dark, [0, 1.91, 0.35]);
    for (const side of [-1, 1] as const) {
      addMesh(group, `zuguArmorHorn${side}`, new THREE.ConeGeometry(0.09, 0.34, 8), accent, [side * 0.72, 1.84, -0.02], [0, 0, side * -0.45]);
    }
    return;
  }

  if (style === 'karlof') {
    addMesh(group, 'karlofJawPlate', new THREE.BoxGeometry(0.54, 0.19, 0.06), accent, [0, 1.91, 0.36]);
    addMesh(group, 'karlofBrowPlate', new THREE.BoxGeometry(0.62, 0.08, 0.055), accent, [0, 2.17, 0.355]);
    for (const side of [-1, 1] as const) {
      addMesh(group, `karlofGauntlet${side}`, new THREE.CylinderGeometry(0.19, 0.16, 0.32, 12), accent, [side * 0.72, 0.95, 0.04], [0, 0, Math.PI / 2]);
      addMesh(group, `karlofChestRivet${side}`, new THREE.CylinderGeometry(0.055, 0.055, 0.035, 10), accent, [side * 0.24, 1.48, 0.335], [Math.PI / 2, 0, 0]);
    }
    return;
  }

  if (style === 'griffin') {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.13;
      const spike = addMesh(group, `griffinHairSpike${i}`, new THREE.ConeGeometry(0.095, 0.42 + Math.abs(i - 2) * 0.04, 8), dark, [x, 2.48 + (i % 2) * 0.05, -0.02], [0.12, 0, x * -0.8]);
      spike.rotation.x = -0.18;
    }
    addMesh(group, 'griffinSpeedBand', new THREE.BoxGeometry(0.62, 0.055, 0.03), accent, [0, 2.14, 0.365]);
    return;
  }

  if (style === 'shade') {
    addMesh(group, 'shadeEyeGlow', new THREE.BoxGeometry(0.5, 0.045, 0.028), accent, [0, 2.1, 0.38]);
    addMesh(group, 'shadeScarfTailLeft', new THREE.BoxGeometry(0.1, 0.62, 0.1), primary, [-0.14, 1.58, -0.42], [0.18, 0, -0.2]);
    addMesh(group, 'shadeScarfTailRight', new THREE.BoxGeometry(0.1, 0.5, 0.1), primary, [0.12, 1.58, -0.42], [-0.14, 0, 0.18]);
    return;
  }

  if (style === 'neuro') {
    const temple = material(0x73e0d1, false, 0.22);
    for (const side of [-1, 1] as const) {
      addMesh(group, `neuroTempleDisc${side}`, new THREE.CylinderGeometry(0.12, 0.12, 0.045, 14), temple, [side * 0.35, 2.08, 0.02], [0, 0, Math.PI / 2]);
    }
    addMesh(group, 'neuroMindGem', new THREE.OctahedronGeometry(0.105, 0), accent, [0, 2.26, 0.28]);
    return;
  }

  if (style === 'paleman') {
    const glow = material(0xfff4a5, false, 0.16);
    const halo = addMesh(group, 'palemanHalo', new THREE.TorusGeometry(0.46, 0.035, 8, 30), glow, [0, 2.15, -0.24], [0, 0, 0]);
    halo.material.transparent = true;
    halo.material.opacity = 0.62;
    const light = new THREE.PointLight(0xfff0a8, 1.2, 3.4, 2);
    light.name = 'palemanLight';
    light.position.set(0, 2.08, 0.15);
    group.add(light);
    return;
  }

  if (style === 'tox') {
    const toxic = material(0x82bf45, false, 0.25);
    for (const side of [-1, 1] as const) {
      addMesh(group, `toxCanister${side}`, new THREE.CylinderGeometry(0.12, 0.12, 0.58, 12), toxic, [side * 0.28, 1.48, -0.42]);
      addMesh(group, `toxHairSpike${side}`, new THREE.ConeGeometry(0.1, 0.45, 8), dark, [side * 0.18, 2.5, 0], [0.08, 0, side * -0.22]);
    }
    addMesh(group, 'toxHairCenter', new THREE.ConeGeometry(0.11, 0.52, 8), dark, [0, 2.57, -0.02], [0.08, 0, 0]);
    return;
  }

  if (style === 'skylor') {
    const hair = material(0x5b2b1e, false, 0.38);
    addMesh(group, 'skylorHairCap', new THREE.SphereGeometry(0.37, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, [0, 2.34, -0.02]);
    addMesh(group, 'skylorPonytail', new THREE.CapsuleGeometry(0.09, 0.48, 4, 10), hair, [0.27, 2.13, -0.3], [0.35, 0, -0.35]);
    addMesh(group, 'skylorAmberBand', new THREE.BoxGeometry(0.58, 0.055, 0.03), accent, [0, 2.15, 0.365]);
    return;
  }

  if (style === 'chamille') {
    const hair = material(0xb23d78, false, 0.34);
    for (let i = 0; i < 4; i++) {
      addMesh(group, `chamilleHair${i}`, new THREE.ConeGeometry(0.09, 0.42, 8), hair, [(i - 1.5) * 0.14, 2.5 + (i % 2) * 0.04, -0.02], [0.05, 0, (i - 1.5) * -0.12]);
    }
    addMesh(group, 'chamilleFaceStripe', new THREE.BoxGeometry(0.055, 0.3, 0.028), accent, [0.2, 2.02, 0.36], [0, 0, 0.18]);
    return;
  }

  if (style === 'ash') {
    const smoke = material(0x8a8c91, false, 0.5);
    addMesh(group, 'ashHairCap', new THREE.SphereGeometry(0.38, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), smoke, [0, 2.35, -0.02]);
    for (let i = 0; i < 3; i++) {
      addMesh(group, `ashSmokeTuft${i}`, new THREE.ConeGeometry(0.08 + i * 0.015, 0.38 + i * 0.08, 8), smoke, [(i - 1) * 0.16, 2.55 + i * 0.03, -0.06], [0.12, 0, (i - 1) * -0.18]);
    }
    addMesh(group, 'ashScarf', new THREE.TorusGeometry(0.37, 0.07, 8, 24), accent, [0, 1.8, 0], [Math.PI / 2, 0, 0]);
  }
}

function addHeadgear(group: THREE.Group, profile: FighterModelProfile, primary: THREE.Material, accent: THREE.Material) {
  if (profile.hood) {
    addMesh(group, 'hoodTop', new THREE.CylinderGeometry(0.43, 0.39, 0.34, 24), primary, [0, 2.3, -0.005]);
    const crown = addMesh(
      group,
      'hoodCrown',
      new THREE.SphereGeometry(0.435, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.6),
      primary,
      [0, 2.39, -0.005]
    );
    crown.scale.y = 0.72;

    // Neck cowl + layered mask panels create the two-piece hood silhouette seen
    // on physical ninja minifigures without importing a proprietary mesh.
    addMesh(group, 'hoodCowl', new THREE.TorusGeometry(0.39, 0.105, 10, 28), primary, [0, 1.82, -0.02], [Math.PI / 2, 0, 0]);
    addMesh(group, 'hoodCowlTrim', new THREE.TorusGeometry(0.405, 0.035, 8, 28), accent, [0, 1.845, 0], [Math.PI / 2, 0, 0]);
    addMesh(group, 'hoodBack', new THREE.BoxGeometry(0.72, 0.48, 0.2), primary, [0, 2.1, -0.26]);
    addMesh(group, 'hoodBrow', new THREE.BoxGeometry(0.68, 0.105, 0.12), primary, [0, 2.18, 0.3]);
    addMesh(group, 'hoodBrowTrim', new THREE.BoxGeometry(0.56, 0.035, 0.035), accent, [0, 2.17, 0.365]);
    addMesh(group, 'hoodCheekLeft', new THREE.BoxGeometry(0.17, 0.31, 0.17), primary, [-0.31, 2.03, 0.18], [0, 0, -0.12]);
    addMesh(group, 'hoodCheekRight', new THREE.BoxGeometry(0.17, 0.31, 0.17), primary, [0.31, 2.03, 0.18], [0, 0, 0.12]);
    addMesh(group, 'hoodTempleLeft', new THREE.BoxGeometry(0.095, 0.22, 0.11), accent, [-0.37, 2.12, 0.06], [0, 0, -0.08]);
    addMesh(group, 'hoodTempleRight', new THREE.BoxGeometry(0.095, 0.22, 0.11), accent, [0.37, 2.12, 0.06], [0, 0, 0.08]);
    addMesh(group, 'hoodTopSeam', new THREE.BoxGeometry(0.04, 0.28, 0.04), accent, [0, 2.47, 0.36], [0.15, 0, 0]);
    addMesh(group, 'hoodTieLeft', new THREE.BoxGeometry(0.12, 0.42, 0.09), primary, [-0.12, 1.92, -0.37], [0.18, 0, -0.22]);
    addMesh(group, 'hoodTieRight', new THREE.BoxGeometry(0.12, 0.34, 0.09), primary, [0.12, 1.95, -0.37], [-0.18, 0, 0.22]);
    addMesh(group, 'hoodTieBand', new THREE.BoxGeometry(0.34, 0.08, 0.11), accent, [0, 2.02, -0.365]);
  }

  if (profile.archetype === 'serpentine') {
    // Broader cobra/anacondrai silhouette for arena enemies and serpent fighters.
    const hood = addMesh(group, 'serpentHood', new THREE.SphereGeometry(0.58, 18, 12), primary, [0, 2.14, -0.07]);
    hood.scale.set(1.28, 0.74, 0.5);
    const hoodInset = addMesh(group, 'serpentHoodInset', new THREE.SphereGeometry(0.46, 16, 10), accent, [0, 2.14, -0.1]);
    hoodInset.scale.set(1.15, 0.56, 0.34);

    addMesh(group, 'serpentSnout', new THREE.BoxGeometry(0.46, 0.24, 0.38), primary, [0, 1.98, 0.34]);
    addMesh(group, 'serpentNoseRidge', new THREE.BoxGeometry(0.19, 0.08, 0.09), accent, [0, 2.08, 0.55]);

    for (const side of [-1, 1] as const) {
      addMesh(
        group,
        side < 0 ? 'serpentFangLeft' : 'serpentFangRight',
        new THREE.ConeGeometry(0.055, 0.26, 8),
        accent,
        [side * 0.17, 1.86, 0.52],
        [Math.PI, 0, side * 0.08]
      );
      addMesh(
        group,
        side < 0 ? 'serpentHoodSpikeLeft' : 'serpentHoodSpikeRight',
        new THREE.ConeGeometry(0.08, 0.38, 8),
        accent,
        [side * 0.47, 2.36, -0.07],
        [0, 0, side * 0.48]
      );
    }

    const crest = addMesh(group, 'serpentCrest', new THREE.ConeGeometry(0.1, 0.52, 8), accent, [0, 2.65, -0.08]);
    crest.rotation.z = 0.08;
  }

  if (profile.archetype === 'samurai') {
    addMesh(group, 'samuraiHelmet', new THREE.CylinderGeometry(0.43, 0.49, 0.24, 20), primary, [0, 2.31, 0]);
    addMesh(group, 'helmetBrim', new THREE.CylinderGeometry(0.53, 0.53, 0.08, 20), accent, [0, 2.19, 0]);
    addMesh(group, 'helmetCrest', new THREE.BoxGeometry(0.1, 0.5, 0.13), accent, [0, 2.62, 0], [0, 0, 0.25]);
  }

  if (profile.shoulderArmor) {
    const style = profile.armorStyle ?? 'heavy';
    const padDepth = style === 'zx' ? 0.7 : style === 'samurai' ? 0.66 : 0.58;
    const padWidth = style === 'dx' ? 0.36 : 0.42;
    addMesh(group, 'armorCollar', new THREE.TorusGeometry(style === 'zx' ? 0.4 : 0.37, 0.075, 8, 24), accent, [0, 1.74, 0], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1] as const) {
      addMesh(group, `shoulderPad${side}`, new THREE.BoxGeometry(padWidth, 0.14, padDepth), accent, [side * 0.57, 1.69, style === 'zx' ? -0.08 : -0.02], [0, 0, side * -0.08]);
      if (style !== 'dx') {
        addMesh(group, `shoulderSpike${side}`, new THREE.ConeGeometry(style === 'samurai' ? 0.11 : 0.095, style === 'zx' ? 0.34 : 0.28, 8), accent, [side * 0.7, 1.82, -0.03], [0, 0, side * -0.34]);
      }
    }
    addMesh(group, 'backArmorPlate', new THREE.BoxGeometry(style === 'zx' ? 1.02 : 0.9, 0.13, style === 'zx' ? 0.62 : 0.52), accent, [0, 1.68, -0.18]);
    addMesh(group, 'armorBackStud', new THREE.CylinderGeometry(0.16, 0.16, 0.1, 12), accent, [0, 1.64, -0.48], [Math.PI / 2, 0, 0]);

    if (style === 'zx') {
      const chest = addMesh(group, 'zxChestPlate', createTorsoGeometry(0.62, 0.78, 0.5, 0.09), accent, [0, 1.42, 0.32]);
      chest.scale.set(1, 1, 0.7);
      addMesh(group, 'zxChestCore', new THREE.TorusGeometry(0.16, 0.045, 8, 22), accent, [0, 1.48, 0.385], [Math.PI / 2, 0, 0]);
      for (const side of [-1, 1] as const) {
        addMesh(group, `zxBladeRack${side}`, new THREE.CylinderGeometry(0.055, 0.055, 1.05, 10), accent, [side * 0.29, 1.86, -0.48], [0, 0, side * 0.54]);
        addMesh(group, `zxBackFin${side}`, new THREE.BoxGeometry(0.11, 0.56, 0.28), accent, [side * 0.42, 1.91, -0.34], [0.12, 0, side * -0.22]);
      }
    } else if (style === 'dx') {
      addMesh(group, 'dxDragonMedallion', new THREE.TorusGeometry(0.16, 0.045, 8, 24), accent, [0.18, 1.47, 0.33], [Math.PI / 2, 0, 0]);
      addMesh(group, 'dxChestSlash', new THREE.BoxGeometry(0.1, 0.62, 0.04), accent, [-0.08, 1.36, 0.31], [0, 0, -0.62]);
    } else if (style === 'techno') {
      const tech = material(0x6ed9ff, true, 0.18);
      addMesh(group, 'technoChestNode', new THREE.CylinderGeometry(0.095, 0.095, 0.035, 14), tech, [0.22, 1.48, 0.335], [Math.PI / 2, 0, 0]);
      addMesh(group, 'technoBackRail', new THREE.BoxGeometry(0.7, 0.08, 0.12), tech, [0, 1.86, -0.38]);
    } else if (style === 'samurai') {
      addMesh(group, 'samuraiChestPlate', new THREE.BoxGeometry(0.75, 0.5, 0.1), accent, [0, 1.4, 0.31]);
      addMesh(group, 'samuraiWaistGuard', new THREE.BoxGeometry(0.98, 0.26, 0.55), accent, [0, 0.82, 0]);
    }

    addMesh(group, 'swordClipLeft', new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10), accent, [-0.24, 1.75, -0.42], [0, 0, -0.48]);
    addMesh(group, 'swordClipRight', new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10), accent, [0.24, 1.75, -0.42], [0, 0, 0.48]);
  }
}

function addEyes(group: THREE.Group, eyeMaterial: THREE.Material, y = 2.08) {
  addMesh(group, 'leftEye', new THREE.BoxGeometry(0.105, 0.045, 0.035), eyeMaterial, [-0.13, y, 0.34]);
  addMesh(group, 'rightEye', new THREE.BoxGeometry(0.105, 0.045, 0.035), eyeMaterial, [0.13, y, 0.34]);
}

function addFacePrint(group: THREE.Group, dark: THREE.Material, hooded: boolean, serpentine: boolean) {
  addMesh(group, 'leftBrow', new THREE.BoxGeometry(0.13, 0.026, 0.028), dark, [-0.13, 2.145, 0.345], [0, 0, 0.08]);
  addMesh(group, 'rightBrow', new THREE.BoxGeometry(0.13, 0.026, 0.028), dark, [0.13, 2.145, 0.345], [0, 0, -0.08]);
  if (!hooded) {
    const mouth = addMesh(group, 'mouth', new THREE.BoxGeometry(serpentine ? 0.2 : 0.16, 0.024, 0.026), dark, [0, 1.935, 0.345]);
    mouth.rotation.z = serpentine ? -0.08 : 0;
  }
}

export function createMinifigureModel(options: MinifigureModelOptions) {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const scale = options.scale ?? 1;
  const group = new THREE.Group();
  group.name = 'fighterModel';
  group.userData.modelProfile = profile;

  const primary = material(options.primary, profile.metallic, 0.32);
  const accent = material(options.accent, profile.metallic, 0.3);
  const skinColor = profile.faceColor ?? (profile.archetype === 'serpentine' ? options.primary : 0xf2c64f);
  const skin = material(skinColor, profile.metallic, 0.3);
  const dark = material(0x17191c, false, 0.44);
  const eye = material(profile.eyeColor ?? 0x17191c, profile.metallic, 0.22);
  const defaultWeaponColor = ['ninja', 'nindroid', 'samurai', 'elemental'].includes(profile.archetype) ? 0xbfc5c9 : options.accent;
  const weaponMaterial = profile.weaponColor !== undefined
    ? material(profile.weaponColor, true, 0.18)
    : material(defaultWeaponColor, true, 0.18);

  const skeleton = profile.archetype === 'skeleton';
  const serpentine = profile.archetype === 'serpentine';

  const torso = addMesh(group, 'torso', createTorsoGeometry(0.8, 0.96, 0.9, 0.52), skeleton ? dark : primary, [0, 1.3, 0]);
  torso.scale.x = profile.archetype === 'master' ? 1.04 : 1;

  addMesh(group, 'belt', new THREE.BoxGeometry(0.96, 0.16, 0.54), accent, [0, 0.89, 0]);
  if (!skeleton) addTorsoPrint(group, accent, dark);

  if (!serpentine || profile.serpentineTail === false) {
    addMesh(group, 'leftLeg', new THREE.BoxGeometry(0.32, 0.72, 0.42), primary, [-0.23, 0.45, 0]);
    addMesh(group, 'rightLeg', new THREE.BoxGeometry(0.32, 0.72, 0.42), primary, [0.23, 0.45, 0]);
    addMesh(group, 'leftFoot', new THREE.BoxGeometry(0.34, 0.18, 0.54), primary, [-0.23, 0.12, 0.06]);
    addMesh(group, 'rightFoot', new THREE.BoxGeometry(0.34, 0.18, 0.54), primary, [0.23, 0.12, 0.06]);
    addMesh(group, 'leftBootSole', new THREE.BoxGeometry(0.35, 0.055, 0.56), dark, [-0.23, 0.035, 0.075]);
    addMesh(group, 'rightBootSole', new THREE.BoxGeometry(0.35, 0.055, 0.56), dark, [0.23, 0.035, 0.075]);
    addMesh(group, 'leftBootToe', new THREE.BoxGeometry(0.28, 0.07, 0.04), accent, [-0.23, 0.16, 0.335]);
    addMesh(group, 'rightBootToe', new THREE.BoxGeometry(0.28, 0.07, 0.04), accent, [0.23, 0.16, 0.335]);
    addMesh(group, 'leftKneeWrap', new THREE.BoxGeometry(0.25, 0.07, 0.035), accent, [-0.23, 0.56, 0.225], [0, 0, -0.05]);
    addMesh(group, 'rightKneeWrap', new THREE.BoxGeometry(0.25, 0.07, 0.035), accent, [0.23, 0.56, 0.225], [0, 0, 0.05]);
    addMesh(group, 'leftShinStripe', new THREE.BoxGeometry(0.24, 0.045, 0.03), dark, [-0.23, 0.34, 0.226], [0, 0, 0.04]);
    addMesh(group, 'rightShinStripe', new THREE.BoxGeometry(0.24, 0.045, 0.03), dark, [0.23, 0.34, 0.226], [0, 0, -0.04]);
    addMesh(group, 'hips', new THREE.BoxGeometry(0.76, 0.2, 0.44), accent, [0, 0.79, 0]);
    addMesh(group, 'beltBuckle', new THREE.CylinderGeometry(0.105, 0.105, 0.035, 16), dark, [0, 0.82, 0.235], [Math.PI / 2, 0, 0]);
  } else {
    addSerpentineTail(group, primary, accent);
  }

  addArm(group, 'leftArm', primary, accent, skin, -1);
  addArm(group, 'rightArm', primary, accent, skin, 1);
  addMesh(group, 'leftShoulderStud', new THREE.CylinderGeometry(0.15, 0.15, 0.18, 12), primary, [-0.5, 1.58, 0], [0, 0, Math.PI / 2]);
  addMesh(group, 'rightShoulderStud', new THREE.CylinderGeometry(0.15, 0.15, 0.18, 12), primary, [0.5, 1.58, 0], [0, 0, Math.PI / 2]);

  if (skeleton) {
    addSkeletonRibs(group, skin, dark);
  }

  const head = addMesh(
    group,
    'head',
    serpentine ? new THREE.CylinderGeometry(0.3, 0.42, 0.64, 14) : new THREE.CylinderGeometry(0.34, 0.34, 0.5, 18),
    skin,
    [0, 2.02, 0]
  );
  if (serpentine) head.scale.z = 1.18;
  addMesh(group, 'neckStud', new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16), skin, [0, 1.76, 0]);
  addMesh(group, 'headStud', new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), skin, [0, 2.32, 0]);

  if (profile.hood) {
    const maskWrap = addMesh(group, 'mask', new THREE.CylinderGeometry(0.365, 0.39, 0.245, 24), primary, [0, 1.99, 0.005]);
    maskWrap.scale.z = 1.04;
    addMesh(group, 'maskFront', new THREE.BoxGeometry(0.56, 0.22, 0.075), primary, [0, 1.995, 0.322]);
    addMesh(group, 'maskFold', new THREE.BoxGeometry(0.55, 0.05, 0.035), accent, [0, 1.965, 0.365], [0, 0, -0.045]);
    addMesh(group, 'maskLowerFold', new THREE.BoxGeometry(0.47, 0.038, 0.032), dark, [0, 1.91, 0.36], [0, 0, 0.04]);
    addMesh(group, 'maskSideLeft', new THREE.BoxGeometry(0.09, 0.2, 0.18), primary, [-0.345, 2.0, 0.16], [0, 0, -0.08]);
    addMesh(group, 'maskSideRight', new THREE.BoxGeometry(0.09, 0.2, 0.18), primary, [0.345, 2.0, 0.16], [0, 0, 0.08]);
    addMesh(group, 'eyeBand', new THREE.BoxGeometry(0.66, 0.11, 0.035), dark, [0, 2.1, 0.354]);
    addMesh(group, 'eyeBandTrim', new THREE.BoxGeometry(0.62, 0.026, 0.025), accent, [0, 2.155, 0.358]);
  }

  if (profile.archetype === 'nindroid') {
    addMesh(group, 'facePlate', new THREE.BoxGeometry(0.56, 0.16, 0.05), accent, [0, 2.0, 0.33]);
    if (profile.battleDamaged) {
      const exposed = material(0x4f5961, true, 0.26);
      const wire = material(0x78d7ff, true, 0.2);
      addMesh(group, 'damagedChestPanel', new THREE.BoxGeometry(0.34, 0.26, 0.045), exposed, [0.18, 1.38, 0.275], [0, 0, -0.12]);
      addMesh(group, 'damagedFacePanel', new THREE.BoxGeometry(0.2, 0.12, 0.045), exposed, [-0.18, 2.02, 0.355], [0, 0, 0.08]);
      addMesh(group, 'exposedWire', new THREE.BoxGeometry(0.035, 0.22, 0.04), wire, [0.06, 1.36, 0.31], [0, 0, 0.25]);
    }
  }

  addEyes(group, eye);
  addFacePrint(group, dark, profile.hood, serpentine);
  addHeadgear(group, profile, primary, accent);
  addIdentityDetails(group, profile, primary, accent, dark, skin);

  if (profile.extraArms) addExtraArms(group, primary, skin);
  const weaponRig = new THREE.Group();
  weaponRig.name = 'weaponRig';
  group.add(weaponRig);
  addWeapon(weaponRig, profile.weapon, weaponMaterial);

  if (profile.truePotentialGlow !== undefined) {
    const aura = addMesh(
      group,
      'truePotentialAura',
      new THREE.TorusGeometry(0.86, 0.045, 8, 40),
      new THREE.MeshBasicMaterial({
        color: profile.truePotentialGlow,
        transparent: true,
        opacity: 0.52,
        depthWrite: false
      }),
      [0, 0.12, 0],
      [Math.PI / 2, 0, 0]
    );
    aura.userData.truePotential = true;

    const glow = new THREE.PointLight(profile.truePotentialGlow, 1.8, 4.2, 2);
    glow.name = 'truePotentialLight';
    glow.position.y = 1.45;
    group.add(glow);
  }

  group.scale.setScalar(scale);
  return group;
}

export function createGenericFighterModel(
  primary: number,
  accent: number,
  scale = 1,
  archetype: FighterArchetype = 'villain',
  weapon: FighterWeapon = 'katana'
) {
  return createMinifigureModel({
    primary,
    accent,
    scale,
    profile: {
      archetype,
      weapon,
      hood: archetype === 'ninja',
      shoulderArmor: archetype === 'villain',
      extraArms: false,
      metallic: archetype === 'nindroid',
      eyeColor: archetype === 'serpentine' ? 0xffe04b : undefined,
      serpentineTail: archetype === 'serpentine'
    }
  });
}
