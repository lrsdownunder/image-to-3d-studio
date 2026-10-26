"""Mesh clean-up and export with Trimesh (Blender step comes in Phase 3)."""
import os

import trimesh


def export_all(raw_glb: str, out_dir: str, target_faces: int):
    scene = trimesh.load(raw_glb, force="scene")
    mesh = scene.dump(concatenate=True) if isinstance(scene, trimesh.Scene) else scene

    mesh.merge_vertices()
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(mesh)
    trimesh.repair.fix_normals(mesh)
    if len(mesh.faces) > target_faces:
        mesh = mesh.simplify_quadric_decimation(face_count=target_faces)

    files = {
        "glb": os.path.join(out_dir, "model.glb"),
        "obj": os.path.join(out_dir, "model.obj"),
        "stl": os.path.join(out_dir, "model.stl"),
    }
    # Keep the textured original for GLB; use the cleaned mesh for print formats.
    scene.export(files["glb"])
    mesh.export(files["obj"])
    mesh.export(files["stl"])
    return files, int(len(mesh.faces))
