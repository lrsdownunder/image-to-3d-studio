# 3DIT AI server — beginner installation guide

This folder is the AI server that turns a photo into a 3D model. It runs on a rented
GPU computer at **RunPod**, not inside Lovable. **It has not been deployed or tested yet.**

| File | What it is |
| --- | --- |
| `trellis_runner.py` | Loads and runs **Microsoft TRELLIS.2** (based on the official `example.py`) |
| `mesh_tools.py` | Cleans the mesh with **Trimesh**, exports GLB / OBJ / STL, sizes it to 100 mm |
| `main.py` | The web server (**FastAPI**) that the 3DIT website talks to |
| `install.sh` | One-time install on the GPU computer |
| `start.sh` | Starts the server |
| `.env.example` | Template for your passwords and settings |

---

## 1. Licences (read before any commercial use)

Checked against the official sources in October 2026. This is not legal advice.

| Part | Licence | Commercial use? | What 3DIT does |
| --- | --- | --- | --- |
| TRELLIS.2 code (github.com/microsoft/TRELLIS.2) | MIT | ✅ Yes | Used |
| TRELLIS.2-4B weights (Hugging Face) | MIT | ✅ Yes | Used |
| TRELLIS-image-large decoder (loaded automatically) | MIT | ✅ Yes | Used |
| CuMesh, FlexGEMM, o-voxel (TRELLIS.2 helpers) | MIT | ✅ Yes | Used |
| DINOv3 image model (`facebook/dinov3-vitl16-pretrain-lvd1689m`) | Meta **DINOv3 License** | ✅ Allowed under its terms | Used — **you must read and accept it on Hugging Face** |
| `briaai/RMBG-2.0` background remover (official default) | CC BY-NC 4.0 | ❌ Non-commercial | **Replaced** by `ZhengPeng7/BiRefNet` (MIT) |
| NVIDIA **nvdiffrast** / **nvdiffrec** (used for textured PBR export & renders) | NVIDIA Source Code License — "research or evaluation only" | ❌ No (needs a licence from NVIDIA) | **Not installed.** `install.sh` removes the one import that needs it |
| Trimesh, FastAPI, PyTorch, flash-attn | MIT / BSD | ✅ Yes | Used |

**What this means for you:** by default (`TEXTURE_MODE=vertex`) every part used is
commercially licensed. The trade-off is that models get **vertex colours** instead of
high-resolution texture images. That doesn't matter for STL (3D printing has no colour)
but the website preview looks a little softer. `TEXTURE_MODE=pbr` gives the official
sharp textures but needs nvdiffrast, so use it **only** for private testing unless
you get a commercial licence from NVIDIA.

---

## 2. Exact requirements

**GPU (from the official README):** NVIDIA, **at least 24 GB of video memory**, Linux.
Microsoft tested it on **A100 and H100**.

| RunPod GPU | VRAM | Verdict |
| --- | --- | --- |
| A100 80 GB / H100 80 GB | 80 GB | ✅ Officially tested — safest |
| A100 40 GB, L40S / A6000 (48 GB) | 40–48 GB | ✅ Should work (≥ 24 GB), not officially tested |
| RTX 4090 / 3090 (24 GB) | 24 GB | ⚠️ Bare minimum; use `TRELLIS_PIPELINE_TYPE=512` or `1024_cascade` |
| Anything under 24 GB, or V100 | — | ❌ Not supported (V100 lacks flash-attn) |

**Software:** Ubuntu 22.04, **CUDA 12.4**, Python **3.10** (made by the script),
PyTorch **2.6.0** (cu124), flash-attn **2.7.3**.

**Docker image to use (official RunPod):** `runpod/pytorch:0.7.0-ubuntu2204-cu1241-torch260`
(Ubuntu 22.04, CUDA 12.4.1, PyTorch 2.6.0). Check it exists at
https://hub.docker.com/r/runpod/pytorch/tags?name=ubuntu2204-cu1241-torch260 — the tag
must appear in the list. Avoid CUDA 12.8 / Ubuntu 24.04 templates for the first test.
If the image has no CUDA 12.4 compiler, `install.sh` installs one inside its own environment.

**Disk:**
| Disk | Minimum | Recommended | Holds |
| --- | --- | --- | --- |
| Container disk | 20 GB | 30–50 GB | System + apt packages (wiped when the pod stops) |
| Network/persistent volume at `/workspace` | 60 GB | **100 GB** | Conda env (~15 GB), model weights (~19 GB), pip + Hugging Face caches, build files, outputs |

`install.sh` and `start.sh` point every cache (`HF_HOME`, `PIP_CACHE_DIR`, `TORCH_HOME`,
temporary build files) at `/workspace`, so nothing large is lost when the pod stops.

**Updating the backend after a code change:** pull the new files, then refresh the
Python dependencies so additions like `pymeshfix` (mesh hole-closing) are present:
```bash
cd /root/3dit-backend && git pull
source /workspace/miniconda3/etc/profile.d/conda.sh && conda activate trellis2
pip install -r requirements.txt
```

**Time:** first install ≈ 30–60 min (it compiles GPU code). First start ≈ 5–10 min
(downloads the model). Each job ≈ 1–3 min depending on GPU and settings.

**Not yet verified on a real GPU** (must be checked during the first test): the whole install
finishing cleanly, flash-attn using a prebuilt wheel, model download + load, BiRefNet working
as the background remover, VRAM use on the A6000, and one complete image → 3D job.

---

## 3. Step by step

### Step 1 — Accounts (free)
1. Make a **Hugging Face** account at huggingface.co.
2. Open https://huggingface.co/facebook/dinov3-vitl16-pretrain-lvd1689m, read the licence,
   and click **Agree / request access**. Wait for approval (usually quick).
3. Hugging Face → Settings → **Access Tokens** → create a **Read** token. Keep it safe.

### Step 2 — RunPod (this is where you start paying — only when you're ready)
1. Create an account at runpod.io and add credit.
2. **Storage → New Network Volume**, 100 GB, in a region that has an RTX A6000.
3. **Pods → Deploy**: pick **RTX A6000**, click **Change Template → custom / edit**, and set
   the container image to `runpod/pytorch:0.7.0-ubuntu2204-cu1241-torch260`.
   Container disk **30 GB**, attach the volume at `/workspace`, and under
   **Expose HTTP Ports** add `8000`.
4. Once the pod starts, open its terminal and run `nvidia-smi` — you should see the A6000.

### Step 3 — Copy this folder to the pod
In the pod's **Web Terminal** (or Jupyter):
```sh
mkdir -p /workspace/3dit-backend
```
Then upload the files of this `backend` folder into `/workspace/3dit-backend`
(Jupyter's upload button is easiest). Or, if your project is on GitHub:
`git clone <your-repo> /workspace/3dit && cp -r /workspace/3dit/backend/. /workspace/3dit-backend/`

### Step 4 — Install (one time)
```sh
cd /workspace/3dit-backend
bash install.sh
```
Leave it running. It ends with **"Install finished"**. If it stops with an error, copy the
last 30 lines and paste them to Lovable.

### Step 5 — Passwords and settings
```sh
cd /workspace/3dit-backend
cp .env.example .env
openssl rand -hex 32   # run twice — one value per password
nano .env
```
Fill in:
- `GENERATION_BACKEND_TOKEN` = first random value
- `GENERATION_CALLBACK_SECRET` = second random value
- `HF_TOKEN` = your Hugging Face read token
- `ALLOWED_HOSTS` = `lovable.app,supabase.co` (add your own domain later if you buy one)

Save with Ctrl+O, Enter, Ctrl+X. **Keep both passwords** — you will paste them into Lovable.

### Step 5½ — Smoke test on the GPU (do this before starting the server)
```sh
cd /workspace/3dit-backend
bash smoke_test.sh              # uses a TRELLIS.2 example photo
bash smoke_test.sh my_photo.png # or your own photo
```
It checks, one by one: the GPU is visible, the model loads (with the commercial-safe
BiRefNet background remover), background removal works, and one complete photo → 3D job
produces GLB/OBJ/STL files. It prints timings and peak GPU memory, and ends with
**RESULT: ALL PASSED** or **FAILED**. Files land in `smoke_out/` (open
`1_no_background.png` to see the cut-out). The first run also downloads the model (~19 GB).
If it fails, paste `smoke_test.log` to Lovable. Stop the server first if it's running —
both need the GPU.

### Step 6 — Start the server
```sh
bash /workspace/3dit-backend/start.sh
```
To keep it running after you close the terminal, use `nohup bash start.sh > server.log 2>&1 &`
and read the log with `tail -f server.log`.

### Step 7 — Health check
In RunPod, click **Connect → HTTP 8000**, or open
`https://<POD_ID>-8000.proxy.runpod.net/health`. You should see something like:
```json
{"ok": true, "model_loaded": true, "loading": false, "load_error": null,
 "gpu": {"name": "NVIDIA A100-SXM4-80GB", "vram_gb": 79.2}, "texture_mode": "vertex"}
```
- `"loading": true` → still downloading/loading; wait and refresh.
- `"load_error"` has text → copy it to Lovable.

### Step 8 — Connect to 3DIT
Tell Lovable "the AI server is running". It will show a secure form for:
- `GENERATION_BACKEND_URL` = `https://<POD_ID>-8000.proxy.runpod.net`
- `GENERATION_BACKEND_TOKEN` and `GENERATION_CALLBACK_SECRET` = the two values from step 5

The Create page will then show a green "AI server ready" light. Upload a photo to test.

### Step 9 — Save money
**Stop the pod** whenever you're not testing. The network volume keeps everything; restart
the pod and run step 6 again. (The pod address can change — update `GENERATION_BACKEND_URL` if so.)

---

## 4. How it connects securely to 3DIT

```text
3DIT website server ──(1) job + Bearer password──▶ AI server  (/v1/jobs/image-to-3d)
AI server ──(2) download photo via private 1-hour link──▶ Lovable Cloud storage
AI server ──(3) upload GLB/OBJ/STL via one-time upload links──▶ Lovable Cloud storage
AI server ──(4) "done" message signed with HMAC──▶ 3DIT /api/public/generation-callback
```
- Visitors' browsers never talk to the AI server; only the 3DIT server does, with
  `GENERATION_BACKEND_TOKEN`. Anyone without it gets "401 Unauthorized".
- The AI server holds **no** Lovable Cloud keys — only short-lived links per job.
- Every status message is signed with `GENERATION_CALLBACK_SECRET`; 3DIT rejects unsigned
  or altered messages, so nobody can fake a finished model.
- `ALLOWED_HOSTS` stops the server from being tricked into fetching or posting to other sites.
- `/health` is public but only shows readiness and GPU name — no secrets, no user data.

## 5. API contract (must match `src/lib/backend-contract.ts`)
- `GET /health` → `{ ok, model_loaded, loading, load_error, gpu: { name, vram_gb }, texture_mode, queue_length, uptime_s }`
- `POST /v1/jobs/image-to-3d` (`Authorization: Bearer <GENERATION_BACKEND_TOKEN>`)
  body `{ job_id, image_url, callback_url, options: { seed?, texture, target_faces, formats }, upload_urls: { glb, obj, stl } }`
  → `202 { job_id, status: "queued" }`, or `503` while the model is loading
- `GET /v1/jobs/{job_id}` → `{ status, progress, error? }`
- Callback `POST callback_url`, header `X-3DIT-Signature: hex(HMAC_SHA256(secret, raw_body))`,
  body `{ job_id, status, progress?, error?, face_count?, outputs?: { glb, obj, stl } }`

## 6. Settings
| Variable | Default | Meaning |
| --- | --- | --- |
| `TRELLIS_PIPELINE_TYPE` | `1024_cascade` | Quality: `512` (fastest, least VRAM), `1024`, `1024_cascade`, `1536_cascade` (best, most VRAM) |
| `TEXTURE_MODE` | `vertex` | `vertex` = commercial-safe; `pbr` = official textures, **evaluation only** |
| `REMBG_MODEL` | `ZhengPeng7/BiRefNet` | Background remover (MIT). Don't switch to RMBG-2.0 for commercial use |
| `TRELLIS_MODEL_DIR` | `/workspace/models/TRELLIS.2-4B` | Where weights are stored |

## 7. Known limits
- One job at a time per GPU; others wait in a queue (lost if the server restarts).
- Printable files are scaled so the longest side is 100 mm. Blender clean-up and custom
  sizes come in Phase 3.
- No preview thumbnail yet (rendering needs nvdiffrast).
