"""Mesh clean-up and export with Trimesh (Blender polish comes in Phase 3)."""
import os

import numpy as np
import trimesh

# Voxel grid resolution used to rebuild a watertight shell. 256 matched the
# football repair quality on the RTX A6000 without blowing up memory.
VOXEL_RESOLUTION = 256


def _voxel_close(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """
    Rebuild the surface as a fully watertight shell: voxelise, fill the inside,
    extract with marching cubes, then move from voxel-index space back to model
    space (apply the voxel grid's transform) and smooth the terracing.
    """
    pitch = float(max(mesh.extents)) / VOXEL_RESOLUTION
    vox = mesh.voxelized(pitch).fill()
    closed = vox.marching_cubes
    closed.apply_transform(vox.transform)
    trimesh.smoothing.filter_taubin(closed, iterations=30)
    # Marching cubes / decimation can wind faces inward; a closed mesh with
    # negative volume has inward normals, so flip the whole shell.
    if closed.is_watertight and closed.volume < 0:
        closed.invert()
    return closed


def _transfer_colours(source: trimesh.Trimesh, target: trimesh.Trimesh) -> None:
    """Copy colours from the original mesh onto the remeshed shell by proximity."""
    from scipy.spatial import cKDTree

    visual = source.visual
    face_colors = getattr(visual, "face_colors", None)
    vertex_colors = getattr(visual, "vertex_colors", None)

    colour = None
    if face_colors is not None and len(face_colors) == len(source.faces):
        _, _, tri_id = trimesh.proximity.closest_point(source, target.vertices)
        colour = np.asarray(face_colors)[tri_id][:, :3]
        if vertex_colors is not None and len(vertex_colors) == len(source.vertices):
            nearest = cKDTree(source.vertices).query(target.vertices)[1]
            colour = (0.5 * colour + 0.5 * np.asarray(vertex_colors)[nearest][:, :3])
    elif vertex_colors is not None and len(vertex_colors) == len(source.vertices):
        nearest = cKDTree(source.vertices).query(target.vertices)[1]
        colour = np.asarray(vertex_colors)[nearest][:, :3]

    if colour is not None:
        target.visual = trimesh.visual.ColorVisuals(
            target, vertex_colors=np.clip(colour, 0, 255).astype(np.uint8)
        )


def _meshfix(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Make the shell watertight and manifold with MeshFix. Decimation leaves
    edges shared by 3+ faces (internal junk triangles), which slicers reject;
    MeshFix removes them. Falls back to the input mesh if pymeshfix is absent."""
    try:
        import pymeshfix
    except ImportError:
        print("[mesh_tools] pymeshfix not installed; skipping manifold repair")
        trimesh.repair.fill_holes(mesh)
        trimesh.repair.fix_normals(mesh)
        return mesh
    v, f = pymeshfix.clean_from_arrays(
        np.asarray(mesh.vertices, dtype=np.float64),
        np.asarray(mesh.faces, dtype=np.int32),
    )
    return trimesh.Trimesh(np.asarray(v), np.asarray(f).reshape(-1, 3), process=False)


def _decimate(mesh: trimesh.Trimesh, target_faces: int) -> trimesh.Trimesh:
    if len(mesh.faces) > target_faces:
        mesh = mesh.simplify_quadric_decimation(face_count=target_faces)
    mesh = _meshfix(mesh)
    if mesh.is_watertight and mesh.volume < 0:
        mesh.invert()
    return mesh


def export_all(viewer_glb: str, print_mesh: str, out_dir: str, target_faces: int):
    """
    viewer_glb: Y-up coloured GLB from TRELLIS.2 -> model.glb for the website viewer.
    print_mesh: Z-up geometry -> cleaned and exported as model.stl / model.obj for printing.

    TRELLIS.2 only sees the object from the photo's side, so the far side and
    occluded areas come back open. Both exports are closed with a voxel remesh
    (the repair proven on the first football model) so previews have no missing
    bottom and slicers get a watertight solid.
    """
    files = {
        "glb": os.path.join(out_dir, "model.glb"),
        "obj": os.path.join(out_dir, "model.obj"),
        "stl": os.path.join(out_dir, "model.stl"),
    }

    scene = trimesh.load(viewer_glb, force="scene")
    geoms = [g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh)]
    viewer = trimesh.util.concatenate(geoms) if geoms else trimesh.Trimesh()
    viewer.merge_vertices(merge_tex=True, merge_norm=True)
    trimesh.repair.fix_normals(viewer)
    if not viewer.is_watertight:
        try:
            original = viewer.copy()
            viewer = _decimate(_voxel_close(viewer), target_faces)
            _transfer_colours(original, viewer)
        except Exception as exc:  # polish must never fail the whole job
            print(f"[mesh_tools] viewer voxel repair failed, using raw mesh: {exc}")
    # Trimesh only writes the NORMAL attribute if vertex_normals was accessed.
    viewer.vertex_normals
    viewer.export(files["glb"])

    mesh = trimesh.load(print_mesh, force="mesh")
    mesh.merge_vertices()
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.update_faces(mesh.unique_faces())
    mesh.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(mesh)
    trimesh.repair.fix_normals(mesh)
    if not mesh.is_watertight:
        try:
            mesh = _voxel_close(mesh)
        except Exception as exc:
            print(f"[mesh_tools] print-mesh voxel repair failed, using raw mesh: {exc}")
    mesh = _decimate(mesh, target_faces)

    # Sit the model on the print bed (z = 0) and scale so the tallest side is 100 mm.
    mesh.apply_translation(-mesh.bounds[0])
    extent = float(max(mesh.extents)) or 1.0
    mesh.apply_scale(100.0 / extent)

    mesh.export(files["obj"])
    mesh.export(files["stl"])
    return files, int(len(mesh.faces)), bool(mesh.is_watertight)
