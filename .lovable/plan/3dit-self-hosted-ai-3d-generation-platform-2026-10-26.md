# 3DIT — Self-hosted AI 3D generation platform

## 1. What exists today

- A blank starter website (placeholder home page, default styling). There is no 3DIT design yet, so nothing visual needs to be preserved — Phase 1 creates the design.
- Lovable Cloud (the database, sign-in and file storage) has just been switched on. It is empty: no tables, no buckets, no users.
- Nothing has been connected to Meshy or any other paid 3D service, and nothing will be.

## 2. How the pieces fit together

```text
 Browser (3DIT site, built in Lovable)
   |  upload photo, watch progress, spin model, download
   v
 Lovable Cloud  (sign-in, database of jobs/models, file storage)
   |  site server sends a "job" with a private image link
   v
 Your GPU backend on RunPod  (Python + FastAPI)  <-- built OUTSIDE Lovable
   |  TRELLIS.2 makes the 3D shape
   |  Trimesh / Blender clean it up and export GLB, OBJ, STL
   v
 Results uploaded back to Lovable Cloud storage, job marked "done"
```

The website never talks to RunPod directly. Only the site's server does, using a secret key, so nobody can abuse your GPU.

## 3. Phases

### Phase 1 — Built in Lovable now (works without a GPU)
- 3DIT look and feel: landing page, sign in (email, Google), dashboard.
- "Create" page: drag in a photo, preview it, press Generate.
- Job tracking: each request is saved with a status (queued, processing, done, failed) and a progress bar that updates live.
- 3D viewer (Three.js): spin, zoom, lighting, wireframe toggle.
- Library: all your models, with download buttons for GLB, OBJ and STL.
- Until the GPU backend exists, Generate shows a clear "Generation backend not connected yet" message. A bundled sample model lets you test the viewer and downloads honestly labelled as a sample.

### Phase 2 — Built outside Lovable (you, with my step-by-step guide)
- A small Python FastAPI app that loads TRELLIS.2 and implements the contract in section 5.
- Packaged as a Docker image, run on a RunPod GPU (you create the account and pay RunPod directly; I will not create paid resources).
- Then you give Lovable two secrets: the backend address and a shared password. I switch Generate on and we test one real photo end to end.

### Phase 3 — Printable output
- Trimesh: repair holes, make the mesh watertight, scale to real millimetres, reduce triangles.
- Blender (headless): export clean STL/OBJ/GLB and a thumbnail.
- Site gets size (mm) and "print-ready" options.

### Phase 4 — Text to 3D
- Self-hosted image model with a commercial licence (for example FLUX.1-schnell, Apache 2.0 — licence to be confirmed by you) on the same RunPod backend.
- Flow: text → image → you approve it → TRELLIS.2 → 3D.

## 4. Things you must do by hand (later, when we reach Phase 2)
1. Create a RunPod account and add credit.
2. Check the TRELLIS.2 licence and the image model licence allow commercial use for your business.
3. Build and deploy the Docker image I describe (I will write the code and exact commands for you to copy).
4. Paste the backend address and shared password into the secure form Lovable shows you.

## Technical details

### 5. Backend API contract (FastAPI on RunPod)
All requests carry `Authorization: Bearer <GENERATION_BACKEND_TOKEN>`.

- `POST /v1/jobs/image-to-3d`
  body: `{ job_id, image_url (signed, 1h), callback_url, options: { seed, texture: bool, target_faces, formats: ["glb","obj","stl"] } }`
  returns `202 { job_id, status: "queued" }`
- `GET /v1/jobs/{job_id}` → `{ status, progress 0-100, error? }`
- Worker callback: `POST {callback_url}` signed with HMAC (`X-3DIT-Signature`) body `{ job_id, status, progress, outputs?: { glb, obj, stl, thumbnail } , error? }`. Outputs are uploaded by the worker to signed upload URLs supplied in the job, so the GPU never holds Cloud admin keys.
- `GET /health` → `{ ok, model_loaded, gpu }`
- Phase 4 adds `POST /v1/jobs/text-to-image` with the same shape.

### 6. Database (Lovable Cloud)
- `profiles` (id → auth user, display_name, avatar_url)
- `generation_jobs` (id, user_id, kind `image_to_3d|text_to_3d`, status enum, progress int, input_image_path, prompt, options jsonb, error, backend_job_id, created_at, updated_at)
- `models` (id, user_id, job_id, title, glb_path, obj_path, stl_path, thumbnail_path, face_count, created_at)
- RLS: users read/write only their own rows; status updates only via the server callback (service role).
- Realtime on `generation_jobs` for live progress.
- Storage buckets (private): `inputs`, `models`; files stored under `<user_id>/...`, served via signed URLs.

### 7. Integration points in the site
- Server function `createImageTo3DJob` (signed-in): saves the job, creates signed URLs, calls the backend; returns "backend not configured" if secrets are missing.
- Server route `/api/public/generation-callback`: verifies HMAC, updates job, inserts model row.
- Secrets (added in Phase 2): `GENERATION_BACKEND_URL`, `GENERATION_BACKEND_TOKEN`, `GENERATION_CALLBACK_SECRET`.
- Viewer: three + @react-three/fiber + drei, client-only, loads GLB from signed URL.

### 8. Honesty rules
- No Meshy or proprietary 3D API anywhere.
- No claims that generation works until a real photo has gone through the deployed RunPod backend and the result has opened in the viewer.
