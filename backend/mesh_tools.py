"""Mesh clean-up and export with Trimesh (Blender polish comes in Phase 3)."""
import os

import trimesh


def export_all(viewer_glb: str, print_mesh: str, out_dir: str, target_faces: int):
    """
    viewer_glb: Y-up coloured GLB from TRELLIS.2 -> copied as model.glb for the website viewer.
    print_mesh: Z-up geometry -> cleaned and exported as model.stl / model.obj for printing.
    """
    files = {
        "glb": os.path.join(out_dir, "model.glb"),
        "obj": os.path.join(out_dir, "model.obj"),
        "stl": os.path.join(out_dir, "model.stl"),
    }
    trimesh.load(viewer_glb, force="scene").export(files["glb"])

    mesh = trimesh.load(print_mesh, force="mesh")
    mesh.merge_vertices()
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.update_faces(mesh.unique_faces())
    mesh.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(mesh)
    trimesh.repair.fix_normals(mesh)
    if len(mesh.faces) > target_faces:
        mesh = mesh.simplify_quadric_decimation(face_count=target_faces)

    # Sit the model on the print bed (z = 0) and scale so the tallest side is 100 mm.
    mesh.apply_translation(-mesh.bounds[0])
    extent = float(max(mesh.extents)) or 1.0
    mesh.apply_scale(100.0 / extent)

    mesh.export(files["obj"])
    mesh.export(files["stl"])
    return files, int(len(mesh.faces)), bool(mesh.is_watertight)
