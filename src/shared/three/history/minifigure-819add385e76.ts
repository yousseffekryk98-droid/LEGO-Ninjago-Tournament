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

function material(color: number, metallic = false, roughness = 0.58) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: metallic ? 0.3 : roughness,
    metalness: metallic ? 0.62 : 0.05
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

function addKatana(group: THREE.Group, accent: THREE.Material, side: 1 | -1, index = 0) {
  const x = side * (0.75 + index * 0.08);
  addMesh(group, `katanaHandle${side}_${index}`, new THREE.CylinderGeometry(0.055, 0.055, 0.42, 10), accent, [x, 1.05, 0.08], [0, 0, side * 0.32]);
  const blade = addMesh(group, `katanaBlade${side}_${index}`, new THREE.BoxGeometry(0.055, 1.15, 0.1), accent, [x + side * 0.12, 1.62, 0.08], [0, 0, side * 0.32]);
  blade.scale.y = 1.08;
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

function addHeadgear(group: THREE.Group, profile: FighterModelProfile, primary: THREE.Material, accent: THREE.Material) {
  if (profile.hood) {
    addMesh(group, 'hoodTop', new THREE.CylinderGeometry(0.42, 0.38, 0.32, 18), primary, [0, 2.28, 0]);
    addMesh(group, 'hoodBack', new THREE.BoxGeometry(0.7, 0.45, 0.16), primary, [0, 2.1, -0.25]);
  }

  if (profile.archetype === 'samurai') {
    addMesh(group, 'samuraiHelmet', new THREE.CylinderGeometry(0.43, 0.48, 0.24, 18), primary, [0, 2.31, 0]);
    addMesh(group, 'helmetCrest', new THREE.BoxGeometry(0.1, 0.5, 0.13), accent, [0, 2.62, 0], [0, 0, 0.25]);
  }

  if (profile.shoulderArmor) {
    addMesh(group, 'shoulderArmor', new THREE.BoxGeometry(1.34, 0.16, 0.62), accent, [0, 1.72, -0.02]);
  }
}

function addEyes(group: THREE.Group, eyeMaterial: THREE.Material, y = 2.08) {
  addMesh(group, 'leftEye', new THREE.BoxGeometry(0.105, 0.045, 0.035), eyeMaterial, [-0.13, y, 0.34]);
  addMesh(group, 'rightEye', new THREE.BoxGeometry(0.105, 0.045, 0.035), eyeMaterial, [0.13, y, 0.34]);
}

export function createMinifigureModel(options: MinifigureModelOptions) {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const scale = options.scale ?? 1;
  const group = new THREE.Group();
  group.name = 'fighterModel';
  group.userData.modelProfile = profile;

  const primary = material(options.primary, profile.metallic, 0.6);
  const accent = material(options.accent, profile.metallic, 0.5);
  const skinColor = profile.faceColor ?? (profile.archetype === 'serpentine' ? options.primary : 0xf2c64f);
  const skin = material(skinColor, profile.metallic, 0.54);
  const dark = material(0x17191c, false, 0.72);
  const eye = material(profile.eyeColor ?? 0xf4f1d8, profile.metallic, 0.28);
  const weaponMaterial = profile.weaponColor !== undefined
    ? material(profile.weaponColor, true, 0.24)
    : accent;

  const skeleton = profile.archetype === 'skeleton';
  const serpentine = profile.archetype === 'serpentine';

  const torso = addMesh(group, 'torso', new THREE.BoxGeometry(0.88, 0.9, 0.5), skeleton ? dark : primary, [0, 1.3, 0]);
  torso.scale.x = profile.archetype === 'master' ? 1.04 : 1;

  addMesh(group, 'belt', new THREE.BoxGeometry(0.94, 0.16, 0.54), accent, [0, 0.89, 0]);

  if (!serpentine || profile.serpentineTail === false) {
    addMesh(group, 'leftLeg', new THREE.BoxGeometry(0.32, 0.72, 0.42), primary, [-0.23, 0.45, 0]);
    addMesh(group, 'rightLeg', new THREE.BoxGeometry(0.32, 0.72, 0.42), primary, [0.23, 0.45, 0]);
    addMesh(group, 'hips', new THREE.BoxGeometry(0.76, 0.2, 0.44), accent, [0, 0.79, 0]);
  } else {
    addSerpentineTail(group, primary, accent);
  }

  const leftArm = addMesh(group, 'leftArm', new THREE.BoxGeometry(0.22, 0.72, 0.24), primary, [-0.58, 1.3, 0], [0, 0, -0.22]);
  const rightArm = addMesh(group, 'rightArm', new THREE.BoxGeometry(0.22, 0.72, 0.24), primary, [0.58, 1.3, 0], [0, 0, 0.22]);
  leftArm.userData.animationPart = 'leftArm';
  rightArm.userData.animationPart = 'rightArm';

  addMesh(group, 'leftHand', new THREE.SphereGeometry(0.13, 12, 8), skin, [-0.68, 0.96, 0.02]);
  addMesh(group, 'rightHand', new THREE.SphereGeometry(0.13, 12, 8), skin, [0.68, 0.96, 0.02]);

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

  if (profile.hood) {
    addMesh(group, 'mask', new THREE.BoxGeometry(0.72, 0.24, 0.52), primary, [0, 2.01, 0.02]);
    addMesh(group, 'eyeBand', new THREE.BoxGeometry(0.73, 0.12, 0.53), dark, [0, 2.1, 0.01]);
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
  addHeadgear(group, profile, primary, accent);

  if (profile.extraArms) addExtraArms(group, primary, skin);
  addWeapon(group, profile.weapon, weaponMaterial);

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
      metallic: archetype === 'nindroid'
    }
  });
}
