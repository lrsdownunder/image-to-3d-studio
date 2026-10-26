"""
Loads and runs Microsoft TRELLIS.2 (https://github.com/microsoft/TRELLIS.2).

Built from the official repo's `example.py`, `trellis2/pipelines/trellis2_image_to_3d.py`
and `o-voxel/o_voxel/postprocess.py` (main branch, checked Oct 2026).

Licence-aware design (see README "Licences"):
  * TRELLIS.2 code + TRELLIS.2-4B weights: MIT (commercial OK).
  * Default background remover in the official config is briaai/RMBG-2.0 (CC BY-NC 4.0,
    NON-commercial). We swap it for ZhengPeng7/BiRefNet (MIT) by writing our own
    pipeline config next to the downloaded weights.
  * Textured PBR export (o_voxel.postprocess.to_glb) uses NVIDIA nvdiffrast, whose licence
    is research/evaluation only. So the default TEXTURE_MODE="vertex" never touches it and
    produces a vertex-coloured mesh instead. TEXTURE_MODE="pbr" is for evaluation only.
"""
from __future__ import annotations

import json
import os

os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import numpy as np  # noqa: E402
import torch  # noqa: E402
import trimesh  # noqa: E402
from PIL import Image  # noqa: E402

MODEL_REPO = os.environ.get("TRELLIS_MODEL_REPO", "microsoft/TRELLIS.2-4B")
MODEL_DIR = os.environ.get("TRELLIS_MODEL_DIR", "/workspace/models/TRELLIS.2-4B")
REMBG_MODEL = os.environ.get("REMBG_MODEL", "ZhengPeng7/BiRefNet")  # MIT
PIPELINE_TYPE = os.environ.get("TRELLIS_PIPELINE_TYPE", "1024_cascade")  # 512 | 1024 | 1024_cascade | 1536_cascade
TEXTURE_MODE = os.environ.get("TEXTURE_MODE", "vertex")  # vertex (commercial-safe) | pbr (evaluation only)
CONFIG_NAME = "pipeline_3dit.json"

_pipeline = None


def _prepare_local_config() -> None:
    """Download the weights once and write a config that uses an MIT background remover."""
    from huggingface_hub import snapshot_download

    if not os.path.exists(os.path.join(MODEL_DIR, "pipeline.json")):
        snapshot_download(MODEL_REPO, local_dir=MODEL_DIR, token=os.environ.get("HF_TOKEN"))
    with open(os.path.join(MODEL_DIR, "pipeline.json")) as f:
        cfg = json.load(f)
    cfg["args"]["rembg_model"] = {"name": "BiRefNet", "args": {"model_name": REMBG_MODEL}}
    cfg["args"]["default_pipeline_type"] = PIPELINE_TYPE
    with open(os.path.join(MODEL_DIR, CONFIG_NAME), "w") as f:
        json.dump(cfg, f)


def load_pipeline():
    """Load TRELLIS.2 onto the GPU. Called once when the server starts."""
    global _pipeline
    if not torch.cuda.is_available():
        raise RuntimeError("No CUDA GPU found — TRELLIS.2 needs an NVIDIA GPU with 24 GB+ VRAM")
    from trellis2.pipelines import Trellis2ImageTo3DPipeline

    _prepare_local_config()
    pipe = Trellis2ImageTo3DPipeline.from_pretrained(MODEL_DIR, config_file=CONFIG_NAME)
    pipe.cuda()
    _pipeline = pipe
    return pipe


def is_loaded() -> bool:
    return _pipeline is not None


def _z_up_to_y_up(v: np.ndarray) -> np.ndarray:
    """TRELLIS.2 meshes are Z-up; glTF viewers expect Y-up (same conversion as o_voxel.to_glb)."""
    out = v.copy()
    out[:, 1], out[:, 2] = v[:, 2], -v[:, 1]
    return out


def run_trellis(image_path: str, seed: int, target_faces: int, out_dir: str) -> dict:
    """
    Run image -> 3D and write:
      raw_y_up.glb  (for the web viewer; coloured)
      raw_z_up.ply  (geometry in printer orientation, Z-up)
    Returns {"glb": path, "print_mesh": path}.
    """
    if _pipeline is None:
        raise RuntimeError("TRELLIS.2 pipeline is not loaded")

    image = Image.open(image_path)
    image.load()
    mesh = _pipeline.run(image, seed=seed, pipeline_type=PIPELINE_TYPE)[0]
    # CuMesh (MIT) simplification on the GPU, as in example.py.
    mesh.simplify(min(int(target_faces), 16_777_216))

    glb_path = os.path.join(out_dir, "raw_y_up.glb")
    if TEXTURE_MODE == "pbr":
        # EVALUATION ONLY: uses nvdiffrast (NVIDIA non-commercial licence).
        import o_voxel

        glb = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=int(target_faces),
            texture_size=2048,
            remesh=True,
            remesh_band=1,
            remesh_project=0,
            verbose=False,
        )
        glb.export(glb_path)
    else:
        # Commercial-safe: sample base colour at each vertex with FlexGEMM (MIT).
        attrs = mesh.query_vertex_attrs()
        rgb = attrs[:, mesh.layout["base_color"]].clamp(0, 1).cpu().numpy()
        colors = np.concatenate([(rgb * 255).astype(np.uint8), np.full((len(rgb), 1), 255, np.uint8)], axis=1)
        verts = mesh.vertices.cpu().numpy()
        faces = mesh.faces.cpu().numpy()
        trimesh.Trimesh(_z_up_to_y_up(verts), faces, vertex_colors=colors, process=False).export(glb_path)

    print_path = os.path.join(out_dir, "raw_z_up.ply")
    trimesh.Trimesh(mesh.vertices.cpu().numpy(), mesh.faces.cpu().numpy(), process=False).export(print_path)

    del mesh
    torch.cuda.empty_cache()
    return {"glb": glb_path, "print_mesh": print_path}


def gpu_info() -> dict:
    if not torch.cuda.is_available():
        return {"name": None, "vram_gb": None}
    p = torch.cuda.get_device_properties(0)
    return {"name": p.name, "vram_gb": round(p.total_memory / 1024**3, 1)}
