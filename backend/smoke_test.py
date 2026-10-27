"""
3DIT GPU smoke test — run ON the RunPod pod, with the server STOPPED (it needs the GPU).

  bash smoke_test.sh                 # uses a TRELLIS.2 example photo
  bash smoke_test.sh my_photo.png    # or your own photo

Checks, in order, and prints PASS/FAIL for each:
  1. GPU visible + VRAM
  2. TRELLIS.2 model loads (with the MIT BiRefNet background remover)
  3. Background removal works on the photo (saves smoke_out/1_no_background.png)
  4. One full image -> 3D job (TRELLIS.2 -> mesh clean-up -> GLB/OBJ/STL files)
Also reports timings and peak GPU memory. Nothing is uploaded anywhere.
"""
import glob
import os
import sys
import time
import traceback

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "smoke_out")
results: list[tuple[str, bool, str]] = []


def record(name, ok, info=""):
    results.append((name, ok, info))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {info}", flush=True)


def finish():
    print("\n===== 3DIT smoke test summary =====")
    for name, ok, info in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}  {info}")
    ok = all(r[1] for r in results) and len(results) == 4
    print("RESULT:", "ALL PASSED" if ok else "FAILED — copy this whole output to Lovable")
    sys.exit(0 if ok else 1)


def main():
    os.makedirs(OUT, exist_ok=True)
    image_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not image_path:
        examples = sorted(glob.glob("/workspace/TRELLIS.2/assets/example_image/*.png")) + sorted(
            glob.glob("/workspace/TRELLIS.2/assets/example_image/*.jpg"))
        if not examples:
            record("find test photo", False, "no example images; pass a photo path")
            finish()
        image_path = examples[0]
    print("Test photo:", image_path)

    import torch
    # 1. GPU
    if not torch.cuda.is_available():
        record("GPU visible", False, "torch.cuda.is_available() is False")
        finish()
    p = torch.cuda.get_device_properties(0)
    record("GPU visible", True, f"{p.name}, {p.total_memory / 1024**3:.1f} GB, torch {torch.__version__} cuda {torch.version.cuda}")

    import trellis_runner
    from PIL import Image

    # 2. Model load
    t = time.time()
    try:
        pipe = trellis_runner.load_pipeline()
        rembg = type(pipe.rembg_model).__name__ if getattr(pipe, "rembg_model", None) is not None else "none"
        ok = rembg == "BiRefNet"
        record("model load", ok, f"{time.time() - t:.0f}s, background remover = {rembg}"
               + ("" if ok else " (expected BiRefNet — licence risk)"))
        if not ok:
            finish()
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        record("model load", False, str(e)[:300])
        finish()

    # 3. Background removal (TRELLIS.2's own preprocess = BiRefNet + crop)
    t = time.time()
    try:
        img = Image.open(image_path).convert("RGB")  # force removal (no existing alpha)
        out = pipe.preprocess_image(img)
        out.save(os.path.join(OUT, "1_no_background.png"))
        alpha = out.getchannel("A") if out.mode == "RGBA" else None
        info = f"{time.time() - t:.1f}s, saved smoke_out/1_no_background.png"
        if alpha is not None:
            ext = alpha.getextrema()
            record("background removal", ext[0] < 50 and ext[1] > 200, f"{info}, alpha range {ext}")
        else:
            record("background removal", True, f"{info} (output mode {out.mode}; check the picture)")
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        record("background removal", False, str(e)[:300])
        finish()

    # 4. One complete job, same code path as the server
    from mesh_tools import export_all
    torch.cuda.reset_peak_memory_stats()
    t = time.time()
    try:
        raw = trellis_runner.run_trellis(image_path, 42, 100_000, OUT)
        t_gen = time.time() - t
        files, faces, watertight = export_all(raw["glb"], raw["print_mesh"], OUT, 100_000)
        sizes = {k: os.path.getsize(v) for k, v in files.items()}
        peak = torch.cuda.max_memory_allocated() / 1024**3
        ok = all(sizes.get(k, 0) > 1000 for k in ("glb", "obj", "stl")) and faces > 0
        record("full image->3D job", ok,
               f"TRELLIS {t_gen:.0f}s, total {time.time() - t:.0f}s, faces={faces}, watertight={watertight}, "
               f"peak VRAM {peak:.1f} GB, files={sizes}")
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        record("full image->3D job", False, str(e)[:300])
    finish()


if __name__ == "__main__":
    main()
