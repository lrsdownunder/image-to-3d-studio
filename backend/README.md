# 3DIT generation backend (built outside Lovable)

This folder is the starting point for the GPU server. Lovable does **not** run it —
it runs on RunPod. Nothing here has been deployed or tested yet.

## What it does
1. The 3DIT website sends a job: a private link to the photo + upload links for the results.
2. This server downloads the photo, runs **TRELLIS.2** to make a 3D shape.
3. **Trimesh** cleans the mesh and exports GLB, OBJ and STL (`mesh_tools.py`).
4. Results are uploaded straight to 3DIT's storage, and the site is told "done".

## API contract (must match `src/lib/backend-contract.ts`)
- `GET /health` → `{ ok, model_loaded, gpu }`
- `POST /v1/jobs/image-to-3d` (header `Authorization: Bearer <GENERATION_BACKEND_TOKEN>`)
  body `{ job_id, image_url, callback_url, options: { seed?, texture, target_faces, formats }, upload_urls: { glb, obj, stl, thumbnail } }`
  → `202 { job_id, status: "queued" }`
- `GET /v1/jobs/{job_id}` → `{ status, progress, error? }`
- Callback: `POST callback_url`, header `X-3DIT-Signature: hex(HMAC_SHA256(GENERATION_CALLBACK_SECRET, raw_body))`,
  body `{ job_id, status, progress?, error?, face_count?, outputs?: { glb, obj, stl, thumbnail } }`

## Your manual steps (beginner version)
1. **Check licences.** Read the TRELLIS.2 licence on its GitHub page and confirm it allows your commercial use.
2. **Make a RunPod account** at runpod.io and add a small amount of credit. You pay RunPod directly.
3. **Pick a GPU.** TRELLIS.2 needs a large-memory GPU (24 GB or more; check the TRELLIS.2 README for the current minimum).
4. **Install TRELLIS.2** on the pod by following its README exactly, then copy this folder onto the pod.
5. **Finish the two TODOs** in `main.py` (`load_pipeline` and `run_trellis`) using the example code from the TRELLIS.2 README — or ask Lovable to help once you can paste that README section.
6. **Choose two passwords**: one for `GENERATION_BACKEND_TOKEN`, one for `GENERATION_CALLBACK_SECRET`. Set them as environment variables on the pod.
7. **Start it**: `pip install -r requirements.txt && uvicorn main:app --host 0.0.0.0 --port 8000`
8. **Expose port 8000** in RunPod and open `https://<your-pod>-8000.proxy.runpod.net/health` — you should see `"model_loaded": true`.
9. **Tell Lovable** you're ready. It will show a secure form for `GENERATION_BACKEND_URL`, `GENERATION_BACKEND_TOKEN` and `GENERATION_CALLBACK_SECRET` (same values as step 6).
10. Upload a test photo in 3DIT and watch the progress bar.
