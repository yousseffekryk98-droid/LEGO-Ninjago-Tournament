import * as THREE from 'three';
import { DEFAULT_ARENA_HAZARD_ANCHORS, type ArenaHazardAnchor } from './arena-hazards';

const FLOOR_Y = 0.082;

function lineMaterial(color: number, opacity: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}

function addArc(
  group: THREE.Group,
  material: THREE.Material,
  radius: number,
  start: number,
  length: number,
  width: number,
  y = FLOOR_Y
) {
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + width, 72, 1, start, length),
    material
  );
  arc.rotation.x = -Math.PI / 2;
  arc.position.y = y;
  group.add(arc);
  return arc;
}

function addGroovePath(
  group: THREE.Group,
  material: THREE.Material,
  points: THREE.Vector3[],
  radius = 0.075
) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => point.clone().setY(FLOOR_Y + 0.008)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 42, radius, 7, false), material);
  group.add(tube);
  return tube;
}

function buildCenterMedallion(group: THREE.Group, dark: THREE.Material, mid: THREE.Material, bronze: THREE.Material) {
  for (const [inner, outer, material] of [
    [1.2, 1.36, bronze],
    [2.15, 2.28, dark],
    [3.5, 3.64, mid],
    [5.1, 5.24, dark]
  ] as const) {
    addArc(group, material, inner, 0, Math.PI * 2, outer - inner, FLOOR_Y + 0.008);
  }

  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.015, 2.1), i % 4 === 0 ? dark : mid);
    spoke.position.set(Math.cos(angle) * 3.95, FLOOR_Y + 0.012, Math.sin(angle) * 3.95);
    spoke.rotation.y = -angle;
    group.add(spoke);
  }

  const makeSerpent = (mirror: number) => {
    const path = [
      new THREE.Vector3(mirror * 0.9, 0, -4.25),
      new THREE.Vector3(mirror * 2.8, 0, -2.7),
      new THREE.Vector3(mirror * 1.65, 0, -0.8),
      new THREE.Vector3(mirror * 3.25, 0, 1.15),
      new THREE.Vector3(mirror * 2.1, 0, 3.15),
      new THREE.Vector3(mirror * 1.0, 0, 4.35)
    ];
    addGroovePath(group, dark, path, 0.11);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.9, 6), dark);
    head.rotation.x = Math.PI / 2;
    head.rotation.z = mirror > 0 ? -0.5 : 0.5;
    head.position.set(mirror * 1.08, FLOOR_Y + 0.018, 4.62);
    group.add(head);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bronze);
    eye.scale.y = 0.45;
    eye.position.set(mirror * 0.95, FLOOR_Y + 0.04, 4.72);
    group.add(eye);
  };

  makeSerpent(-1);
  makeSerpent(1);
}

function buildSlabSeams(group: THREE.Group, fine: THREE.Material, dark: THREE.Material) {
  // Radial seams are staggered by ring so the floor reads like fitted stone slabs
  // rather than a modern square grid.
  const rings = [
    { radius: 8.4, count: 18, length: 5.4 },
    { radius: 15.0, count: 24, length: 5.0 },
    { radius: 22.0, count: 30, length: 4.5 },
    { radius: 29.0, count: 36, length: 4.0 },
    { radius: 35.5, count: 42, length: 3.4 }
  ];

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    const ring = rings[ringIndex];
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + (ringIndex % 2 ? 0.07 : 0);
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.012, ring.length),
        i % 5 === 0 ? dark : fine
      );
      seam.position.set(Math.cos(angle) * ring.radius, FLOOR_Y, Math.sin(angle) * ring.radius);
      seam.rotation.y = -angle;
      group.add(seam);
    }
  }

  for (const radius of [6.0, 10.5, 15.5, 21.0, 27.0, 32.5, 37.8, 40.2]) {
    addArc(group, radius > 26 ? dark : fine, radius, 0, Math.PI * 2, radius > 32 ? 0.12 : 0.08);
  }
}

function buildOuterGlyphRing(group: THREE.Group, dark: THREE.Material, fine: THREE.Material) {
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const radius = i % 4 === 0 ? 31.2 : i % 2 === 0 ? 33.2 : 35.2;
    const length = i % 6 === 0 ? 2.2 : i % 3 === 0 ? 1.55 : 1.05;

    const glyph = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.015, i % 5 === 0 ? 0.3 : 0.18),
      i % 4 === 0 ? dark : fine
    );
    glyph.position.set(Math.cos(angle) * radius, FLOOR_Y + 0.006, Math.sin(angle) * radius);
    glyph.rotation.y = -angle + (i % 3 === 0 ? 0.58 : i % 3 === 1 ? -0.28 : 0.16);
    group.add(glyph);

    if (i % 4 === 0) {
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.015, 0.16), dark);
      hook.position.set(
        Math.cos(angle + 0.018) * (radius - 0.72),
        FLOOR_Y + 0.007,
        Math.sin(angle + 0.018) * (radius - 0.72)
      );
      hook.rotation.y = -angle + Math.PI / 2;
      group.add(hook);
    }
  }

  // Broken arc segments create the hand-carved/maze language visible in the
  // original tournament floor without reproducing any proprietary texture.
  for (let band = 0; band < 3; band++) {
    const radius = 24.0 + band * 3.2;
    const segments = 12 + band * 2;
    for (let i = 0; i < segments; i++) {
      if ((i + band) % 4 === 1) continue;
      const start = (i / segments) * Math.PI * 2 + band * 0.12;
      const sweep = (Math.PI * 2 / segments) * (i % 3 === 0 ? 0.52 : 0.72);
      addArc(group, i % 2 ? fine : dark, radius, start, sweep, 0.13);
    }
  }
}

function buildHazardInlays(group: THREE.Group, anchors: readonly ArenaHazardAnchor[], dark: THREE.Material, bronze: THREE.Material) {
  const plateStone = lineMaterial(0x4d5963, 0.38);
  const hinge = lineMaterial(0x20252b, 0.7);

  for (const anchor of anchors) {
    const marker = new THREE.Group();
    marker.name = `floorInlay:${anchor.id}`;
    marker.position.set(anchor.x, 0, anchor.z);

    const border = new THREE.Mesh(
      new THREE.RingGeometry(anchor.radius + 0.05, anchor.radius + 0.18, 36),
      anchor.kind === 'pit' ? dark : bronze
    );
    border.rotation.x = -Math.PI / 2;
    border.position.y = FLOOR_Y + 0.005;
    marker.add(border);

    const inset = new THREE.Mesh(new THREE.CircleGeometry(anchor.radius * 0.94, 36), plateStone);
    inset.rotation.x = -Math.PI / 2;
    inset.position.y = FLOOR_Y - 0.002;
    marker.add(inset);

    if (anchor.kind === 'pit') {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.012, anchor.radius * 0.84),
          hinge
        );
        seam.position.set(
          Math.cos(angle) * anchor.radius * 0.48,
          FLOOR_Y + 0.01,
          Math.sin(angle) * anchor.radius * 0.48
        );
        seam.rotation.y = -angle;
        marker.add(seam);
      }

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const hingeStud = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.018, 10),
          hinge
        );
        hingeStud.rotation.x = Math.PI / 2;
        hingeStud.position.set(
          Math.cos(angle) * anchor.radius * 0.82,
          FLOOR_Y + 0.016,
          Math.sin(angle) * anchor.radius * 0.82
        );
        marker.add(hingeStud);
      }
    } else {
      for (let ring = 0; ring < 2; ring++) {
        const count = ring === 0 ? 6 : 8;
        const radius = ring === 0 ? anchor.radius * 0.42 : anchor.radius * 0.72;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + ring * 0.18;
          const slot = new THREE.Mesh(
            new THREE.RingGeometry(0.1, 0.15, 10),
            hinge
          );
          slot.rotation.x = -Math.PI / 2;
          slot.position.set(
            Math.cos(angle) * radius,
            FLOOR_Y + 0.013,
            Math.sin(angle) * radius
          );
          marker.add(slot);
        }
      }
    }

    group.add(marker);
  }
}

export function buildTournamentFloorDetails(
  scene: THREE.Scene,
  anchors: readonly ArenaHazardAnchor[] = DEFAULT_ARENA_HAZARD_ANCHORS
) {
  const group = new THREE.Group();
  group.name = 'legacyTournamentFloorDetails';

  const dark = lineMaterial(0x242b31, 0.72);
  const mid = lineMaterial(0x303941, 0.56);
  const fine = lineMaterial(0x38434c, 0.4);
  const bronze = lineMaterial(0x72522f, 0.52);

  buildCenterMedallion(group, dark, mid, bronze);
  buildSlabSeams(group, fine, dark);
  buildOuterGlyphRing(group, dark, fine);
  buildHazardInlays(group, anchors, dark, bronze);

  scene.add(group);
  return group;
}
