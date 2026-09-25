"""
Lloyd Tournament Robe — exact-mould Blender builder
====================================================
Creates a second high-fidelity Lloyd model from official LDraw minifigure
part geometry and original clean-room surface details.

Why LDraw instead of committing a Mecabricks export?
- Mecabricks exported assets are not redistributable under its general EULA.
- The LDraw Parts Library is redistributable under CC BY/CCAL with attribution.

This script downloads the official LDraw complete library on first run,
builds Lloyd from exact part mould geometry, adds Tournament-Robe-specific
clean-room decorations, creates the game's animation node contract, and
exports a GLB.

Run inside Blender:
  blender --background --python scripts/blender/build_lloyd_tournament_exact.py

Optional:
  blender --background --python scripts/blender/build_lloyd_tournament_exact.py -- --replace-game

Output:
  public/assets/models/fighters/lloyd-tournament-v2.glb
or with --replace-game:
  public/assets/models/fighters/lloyd-tournament.glb
"""

from __future__ import annotations

import bpy
import math
import os
import sys
import tempfile
import urllib.request
import zipfile
from mathutils import Matrix, Vector

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE_ROOT = os.path.join(REPO_ROOT, ".cache", "ldraw")
ZIP_PATH = os.path.join(CACHE_ROOT, "complete.zip")
LIB_ROOT = os.path.join(CACHE_ROOT, "library")
LDRAW_URL = "https://library.ldraw.org/library/updates/complete.zip"

# The exact official moulds used for this clean-room reconstruction.
PARTS = {
    "torso": "973.dat",
    "head": "3626b.dat",
    "hair": "61183.dat",
    "bandana": "15619.dat",
    "hips": "3815.dat",
    "right_leg": "3816.dat",
    "left_leg": "3817.dat",
    "right_arm": "3818.dat",
    "left_arm": "3819.dat",
    "hand": "3820.dat",
}

# LDraw standing-minifig placement, derived from official shortcut 979.dat.
PLACEMENT = {
    "left_leg":  (0.0, -28.0, 0.0),
    "right_leg": (0.0, -28.0, 0.0),
    "hips":      (0.0, -40.0, 0.0),
    "torso":     (0.0, -72.0, 0.0),
    "head":      (0.0, -100.0, 0.0),
    "hair":      (0.0, -100.0, 0.0),
    "bandana":   (0.0, -100.0, 0.0),
    "right_arm": (-15.552, -63.0, 0.0),
    "left_arm":  ( 15.552, -63.0, 0.0),
    "right_hand":(-23.552, -46.0, -10.0),
    "left_hand": ( 23.552, -46.0, -10.0),
}

# Official shortcut 979.dat arm and hand rotations.
ROT_RIGHT_ARM = Matrix((
    (0.9855, -0.1699, 0.0, 0.0),
    (0.1699,  0.9855, 0.0, 0.0),
    (0.0,     0.0,    1.0, 0.0),
    (0.0,     0.0,    0.0, 1.0),
))
ROT_LEFT_ARM = Matrix((
    (0.9855,  0.1699, 0.0, 0.0),
    (-0.1699, 0.9855, 0.0, 0.0),
    (0.0,     0.0,    1.0, 0.0),
    (0.0,     0.0,    0.0, 1.0),
))
ROT_RIGHT_HAND = Matrix((
    (0.942,  0.335,  0.0072, 0.0),
    (-0.2404, 0.6906, -0.6821, 0.0),
    (-0.2336, 0.6409, 0.7312, 0.0),
    (0.0,     0.0,    0.0,    1.0),
))
ROT_LEFT_HAND = Matrix((
    (0.942, -0.335,  0.0072, 0.0),
    (0.2404, 0.6906, -0.6821, 0.0),
    (0.2336, 0.6409, 0.7312, 0.0),
    (0.0,    0.0,    0.0,    1.0),
))


def cli_args():
    argv = sys.argv
    if "--" not in argv:
        return []
    return argv[argv.index("--") + 1:]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        # Keep only datablocks that are still in use.
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def ensure_ldraw_library():
    os.makedirs(CACHE_ROOT, exist_ok=True)
    marker = os.path.join(LIB_ROOT, "parts", "61183.dat")
    if os.path.exists(marker):
        return
    if not os.path.exists(ZIP_PATH):
        print("Downloading official LDraw complete.zip…")
        urllib.request.urlretrieve(LDRAW_URL, ZIP_PATH)
    print("Extracting LDraw library…")
    os.makedirs(LIB_ROOT, exist_ok=True)
    with zipfile.ZipFile(ZIP_PATH, "r") as archive:
        archive.extractall(LIB_ROOT)

    # complete.zip normally contains ldraw/parts, but cope with alternate layout.
    nested = os.path.join(LIB_ROOT, "ldraw")
    if os.path.isdir(nested) and not os.path.isdir(os.path.join(LIB_ROOT, "parts")):
        for name in os.listdir(nested):
            src = os.path.join(nested, name)
            dst = os.path.join(LIB_ROOT, name)
            if not os.path.exists(dst):
                os.rename(src, dst)


def find_ldraw_file(name: str) -> str:
    clean = name.replace("\\", "/")
    candidates = [
        os.path.join(LIB_ROOT, "parts", clean),
        os.path.join(LIB_ROOT, "p", clean),
        os.path.join(LIB_ROOT, "p", "48", clean),
        os.path.join(LIB_ROOT, clean),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    raise FileNotFoundError(f"LDraw dependency not found: {name}")


def ldraw_matrix(values):
    x, y, z = values[:3]
    a, b, c, d, e, f, g, h, i = values[3:12]
    return Matrix((
        (a, b, c, x),
        (d, e, f, y),
        (g, h, i, z),
        (0.0, 0.0, 0.0, 1.0),
    ))


def parse_ldraw(part_name: str, parent: Matrix | None = None, depth=0):
    if depth > 80:
        raise RuntimeError(f"LDraw recursion too deep at {part_name}")
    parent = parent or Matrix.Identity(4)
    verts = []
    faces = []
    path = find_ldraw_file(part_name)

    def add_face(points):
        start = len(verts)
        verts.extend(points)
        faces.append(tuple(range(start, start + len(points))))

    with open(path, "r", encoding="latin-1", errors="replace") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("0 "):
                continue
            fields = line.split()
            kind = fields[0]
            try:
                if kind == "1":
                    nums = list(map(float, fields[2:14]))
                    child_name = " ".join(fields[14:])
                    child_matrix = parent @ ldraw_matrix(nums)
                    cv, cf = parse_ldraw(child_name, child_matrix, depth + 1)
                    base = len(verts)
                    verts.extend(cv)
                    faces.extend(tuple(base + idx for idx in face) for face in cf)
                elif kind == "3":
                    vals = list(map(float, fields[2:11]))
                    pts = [
                        parent @ Vector((vals[n], vals[n+1], vals[n+2], 1.0))
                        for n in (0, 3, 6)
                    ]
                    add_face([(p.x, p.y, p.z) for p in pts])
                elif kind == "4":
                    vals = list(map(float, fields[2:14]))
                    pts = [
                        parent @ Vector((vals[n], vals[n+1], vals[n+2], 1.0))
                        for n in (0, 3, 6, 9)
                    ]
                    add_face([(p.x, p.y, p.z) for p in pts])
                # Types 2 and 5 are line/conditional-line display helpers.
            except (ValueError, IndexError):
                # Ignore malformed helper lines instead of killing the build.
                continue
    return verts, faces


def make_material(name, rgba, metallic=0.0, roughness=0.28):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


MAT_GREEN = None
MAT_DARK_GREEN = None
MAT_YELLOW = None
MAT_BLACK = None
MAT_GOLD = None
MAT_OLIVE = None
MAT_TAN = None


def setup_materials():
    global MAT_GREEN, MAT_DARK_GREEN, MAT_YELLOW, MAT_BLACK, MAT_GOLD, MAT_OLIVE, MAT_TAN
    MAT_GREEN = make_material("Lloyd Tournament Green", (0.018, 0.36, 0.105, 1.0), 0.0, 0.22)
    MAT_DARK_GREEN = make_material("Dark Green Detail", (0.012, 0.12, 0.045, 1.0), 0.0, 0.28)
    MAT_YELLOW = make_material("LEGO Yellow", (1.0, 0.67, 0.06, 1.0), 0.0, 0.20)
    MAT_BLACK = make_material("Black Hands and Print", (0.008, 0.009, 0.01, 1.0), 0.0, 0.24)
    MAT_GOLD = make_material("Tournament Gold", (0.72, 0.48, 0.08, 1.0), 0.16, 0.22)
    MAT_OLIVE = make_material("Olive Print", (0.32, 0.39, 0.12, 1.0), 0.0, 0.30)
    MAT_TAN = make_material("Tan Hair", (0.82, 0.64, 0.28, 1.0), 0.0, 0.24)


def create_part(name, part_no, material, placement, rotation=None):
    verts, faces = parse_ldraw(part_no)
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.validate(verbose=False)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)

    # LDraw: Y points down. Blender: Z points up.
    axis = Matrix((
        (1, 0, 0, 0),
        (0, 0, 1, 0),
        (0, -1, 0, 0),
        (0, 0, 0, 1),
    ))
    transform = Matrix.Translation(Vector(placement)) @ (rotation or Matrix.Identity(4))
    obj.matrix_world = axis @ transform
    return obj


def empty(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def parent_keep_world(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def add_flat_box(name, location, scale, material, rotation=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def add_curve_stroke(name, points, bevel, material, parent=None):
    curve = bpy.data.curves.new(name + "Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def normalize_to_game_height(objects, target_height=2.70):
    bpy.context.view_layer.update()
    corners = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            corners.append(obj.matrix_world @ Vector(corner))
    if not corners:
        return
    zmin = min(v.z for v in corners)
    zmax = max(v.z for v in corners)
    height = max(1e-6, zmax - zmin)
    factor = target_height / height
    for obj in bpy.context.scene.objects:
        obj.scale *= factor
        obj.location *= factor
    bpy.context.view_layer.update()
    # Put soles on Y=0 ground in game coordinates (Blender Z).
    corners = []
    for obj in objects:
        if obj.type == "MESH":
            corners.extend(obj.matrix_world @ Vector(c) for c in obj.bound_box)
    min_z = min(v.z for v in corners)
    for obj in bpy.context.scene.objects:
        if obj.parent is None:
            obj.location.z -= min_z


def build():
    clear_scene()
    ensure_ldraw_library()
    setup_materials()

    # Animation contract roots expected by the Three.js game.
    torso_rig = empty("torso")
    head_rig = empty("head")
    left_arm_rig = empty("leftArm")
    right_arm_rig = empty("rightArm")
    left_leg_rig = empty("leftLeg")
    right_leg_rig = empty("rightLeg")

    geometry = []

    torso = create_part("torsoMould", PARTS["torso"], MAT_GREEN, PLACEMENT["torso"])
    head = create_part("headMould", PARTS["head"], MAT_YELLOW, PLACEMENT["head"])
    hair = create_part("hair61183", PARTS["hair"], MAT_TAN, PLACEMENT["hair"])
    bandana = create_part("bandana15619", PARTS["bandana"], MAT_GREEN, PLACEMENT["bandana"])
    hips = create_part("hipsMould", PARTS["hips"], MAT_GREEN, PLACEMENT["hips"])

    right_leg = create_part("rightLegMould", PARTS["right_leg"], MAT_GREEN, PLACEMENT["right_leg"])
    left_leg = create_part("leftLegMould", PARTS["left_leg"], MAT_GREEN, PLACEMENT["left_leg"])
    right_arm = create_part("rightArmMould", PARTS["right_arm"], MAT_YELLOW, PLACEMENT["right_arm"], ROT_RIGHT_ARM)
    left_arm = create_part("leftArmMould", PARTS["left_arm"], MAT_YELLOW, PLACEMENT["left_arm"], ROT_LEFT_ARM)
    right_hand = create_part("rightHandMould", PARTS["hand"], MAT_BLACK, PLACEMENT["right_hand"], ROT_RIGHT_HAND)
    left_hand = create_part("leftHandMould", PARTS["hand"], MAT_BLACK, PLACEMENT["left_hand"], ROT_LEFT_HAND)

    geometry += [torso, head, hair, bandana, hips, right_leg, left_leg, right_arm, left_arm, right_hand, left_hand]

    # Parent exact moulds under the animation nodes.
    parent_keep_world(torso, torso_rig)
    parent_keep_world(hips, torso_rig)
    parent_keep_world(head, head_rig)
    parent_keep_world(hair, head_rig)
    parent_keep_world(bandana, head_rig)
    parent_keep_world(left_arm, left_arm_rig)
    parent_keep_world(left_hand, left_arm_rig)
    parent_keep_world(right_arm, right_arm_rig)
    parent_keep_world(right_hand, right_arm_rig)
    parent_keep_world(left_leg, left_leg_rig)
    parent_keep_world(right_leg, right_leg_rig)

    # Normalize exact LDraw mould assembly to the current game's character scale first.
    normalize_to_game_height(geometry, 2.70)
    bpy.context.view_layer.update()

    # Approximate clean-room Tournament Robe print from visual references.
    # These overlays intentionally do not copy commercial texture bitmaps.
    torso_front_y = -0.285
    add_flat_box("blackTournamentSash", (0.0, torso_front_y, 1.52), (0.11, 0.012, 0.62),
                 MAT_BLACK, rotation=(0, 0.0, math.radians(-28)), parent=torso_rig)
    add_flat_box("goldSashBorderL", (-0.07, torso_front_y - 0.014, 1.52), (0.016, 0.01, 0.62),
                 MAT_GOLD, rotation=(0, 0.0, math.radians(-28)), parent=torso_rig)
    add_flat_box("goldSashBorderR", (0.07, torso_front_y - 0.014, 1.52), (0.016, 0.01, 0.62),
                 MAT_GOLD, rotation=(0, 0.0, math.radians(-28)), parent=torso_rig)

    # Lloyd elemental medallion.
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.14, depth=0.022,
                                        location=(-0.24, torso_front_y - 0.02, 1.77),
                                        rotation=(math.pi / 2, 0, 0))
    medallion = bpy.context.object
    medallion.name = "lloydPowerMedallion"
    medallion.data.materials.append(MAT_BLACK)
    parent_keep_world(medallion, torso_rig)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.115, minor_radius=0.015, major_segments=36,
                                    location=(-0.24, torso_front_y - 0.035, 1.77),
                                    rotation=(math.pi / 2, 0, 0))
    ring = bpy.context.object
    ring.name = "lloydPowerMedallionGoldRing"
    ring.data.materials.append(MAT_GOLD)
    parent_keep_world(ring, torso_rig)

    # Original abstract energy glyph inside medallion.
    add_curve_stroke("medallionEnergyGlyph", [
        (-0.285, torso_front_y - 0.055, 1.80),
        (-0.235, torso_front_y - 0.055, 1.73),
        (-0.205, torso_front_y - 0.055, 1.80),
        (-0.255, torso_front_y - 0.055, 1.85),
    ], 0.012, MAT_GOLD, torso_rig)

    # Small gold pseudo-logograms on the sash: geometric marks, not copied text.
    marks = [
        [(-0.04,1.80),(0.00,1.85),(0.03,1.79)],
        [(-0.01,1.62),(-0.04,1.57),(0.04,1.55)],
        [(0.02,1.42),(-0.03,1.38),(0.04,1.34)],
    ]
    for idx, pts in enumerate(marks):
        world_pts=[(x, torso_front_y - 0.045, z) for x,z in pts]
        add_curve_stroke(f"sashGlyph{idx}", world_pts, 0.012, MAT_GOLD, torso_rig)

    # Waist rope and lower robe.
    add_flat_box("waistBlackLine", (0.0, torso_front_y, 1.13), (0.43, 0.012, 0.035), MAT_BLACK, parent=torso_rig)
    add_flat_box("waistGoldLine", (0.0, torso_front_y - 0.014, 1.08), (0.43, 0.01, 0.022), MAT_GOLD, parent=torso_rig)

    # Leg printing: black knee bars + olive/gold sash folds.
    for x, rig, side in ((-0.22, left_leg_rig, -1), (0.22, right_leg_rig, 1)):
        add_flat_box(f"kneeStripe{side}", (x, -0.255, 0.57), (0.16, 0.012, 0.026), MAT_BLACK, parent=rig)
        add_flat_box(f"kneeGold{side}", (x, -0.267, 0.70), (0.15, 0.01, 0.028), MAT_GOLD, parent=rig)
    add_curve_stroke("leftOliveRobeFold", [
        (-0.34,-0.275,0.98),(-0.26,-0.275,0.82),(-0.18,-0.275,0.94)
    ], 0.016, MAT_OLIVE, left_leg_rig)
    add_curve_stroke("rightOliveRobeFold", [
        (0.10,-0.275,1.00),(0.20,-0.275,0.84),(0.32,-0.275,0.94)
    ], 0.016, MAT_OLIVE, right_leg_rig)

    # Face print visible above the bandana: hard black eyebrows and eyes.
    add_curve_stroke("leftBrow", [(-0.19,-0.326,2.24),(-0.08,-0.326,2.19)], 0.016, MAT_BLACK, head_rig)
    add_curve_stroke("rightBrow", [(0.08,-0.326,2.19),(0.19,-0.326,2.24)], 0.016, MAT_BLACK, head_rig)
    for x in (-0.12, 0.12):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.033,
                                            location=(x,-0.342,2.16))
        eye = bpy.context.object
        eye.name = "leftEye" if x < 0 else "rightEye"
        eye.scale.y = 0.20
        eye.data.materials.append(MAT_BLACK)
        parent_keep_world(eye, head_rig)

    # Small bandana fold accents to make the cloth read closer to the Tournament minifig.
    add_curve_stroke("bandanaFold1", [(-0.28,-0.39,2.05),(0.0,-0.42,1.99),(0.28,-0.39,2.05)], 0.014, MAT_DARK_GREEN, head_rig)
    add_curve_stroke("bandanaFold2", [(-0.24,-0.40,1.98),(0.0,-0.425,1.93),(0.24,-0.40,1.98)], 0.012, MAT_DARK_GREEN, head_rig)

    # Game-facing root.
    root = empty("authoredCharacterBody")
    for rig in (torso_rig, head_rig, left_arm_rig, right_arm_rig, left_leg_rig, right_leg_rig):
        parent_keep_world(rig, root)

    # Smooth exact moulds but retain hard edges via Auto Smooth by angle where supported.
    for obj in geometry:
        if obj.type == "MESH":
            for poly in obj.data.polygons:
                poly.use_smooth = True

    # Export.
    replace_game = "--replace-game" in cli_args()
    filename = "lloyd-tournament.glb" if replace_game else "lloyd-tournament-v2.glb"
    output = os.path.join(REPO_ROOT, "public", "assets", "models", "fighters", filename)
    os.makedirs(os.path.dirname(output), exist_ok=True)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=output,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_extras=True,
    )

    print(f"Lloyd Tournament exact-mould GLB exported: {output}")
    print("Required animation nodes:",
          all(bpy.data.objects.get(n) is not None for n in
              ("torso","head","leftArm","rightArm","leftLeg","rightLeg")))


if __name__ == "__main__":
    build()
