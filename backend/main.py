"""
3DIT generation backend (runs on RunPod, NOT inside Lovable).

Contract (must match src/lib/backend-contract.ts in the website):
  GET  /health                     public, no secrets — is the AI server alive?
  POST /v1/jobs/image-to-3d        Bearer GENERATION_BACKEND_TOKEN
  GET  /v1/jobs/{job_id}           Bearer GENERATION_BACKEND_TOKEN
Progress is reported to the site's callback URL, signed with HMAC-SHA256
(header X-3DIT-Signature) using GENERATION_CALLBACK_SECRET.
"""
import hashlib
import hmac
import json
import os
import tempfile
import threading
import time
import traceback
from contextlib import asynccontextmanager
from queue import Queue
from urllib.parse import urlparse

import requests
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

import trellis_runner
from mesh_tools import export_all

BACKEND_TOKEN = os.environ["GENERATION_BACKEND_TOKEN"]
CALLBACK_SECRET = os.environ["GENERATION_CALLBACK_SECRET"]
# Only send callbacks / downloads to these hosts (your 3DIT site + Lovable Cloud storage).
ALLOWED_HOSTS = {h.strip() for h in os.environ.get("ALLOWED_HOSTS", "").split(",") if h.strip()}
MAX_IMAGE_BYTES = 20 * 1024 * 1024

jobs: dict[str, dict] = {}
queue: "Queue[ImageTo3DRequest]" = Queue()
state = {"load_error": None, "started_at": time.time()}


class Options(BaseModel):
    seed: int | None = Field(None, ge=0, le=2_147_483_647)
    texture: bool = True
    target_faces: int = Field(100_000, ge=1_000, le=500_000)
    formats: list[str] = ["glb", "obj", "stl"]


class ImageTo3DRequest(BaseModel):
    job_id: str
    image_url: str
    callback_url: str
    options: Options
    upload_urls: dict[str, str] = {}


def _check_host(url: str):
    host = urlparse(url).hostname or ""
    if urlparse(url).scheme != "https":
        raise HTTPException(400, "Only https URLs are allowed")
    if ALLOWED_HOSTS and not any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS):
        raise HTTPException(400, f"Host not allowed: {host}")


def auth(authorization: str = Header("")):
    if not hmac.compare_digest(authorization.encode(), f"Bearer {BACKEND_TOKEN}".encode()):
        raise HTTPException(401, "Unauthorized")


def callback(req: ImageTo3DRequest, **payload):
    jobs[req.job_id].update(payload)
    body = json.dumps({"job_id": req.job_id, **payload}, separators=(",", ":"))
    sig = hmac.new(CALLBACK_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    for attempt in range(3):
        try:
            r = requests.post(req.callback_url, data=body, timeout=15,
                              headers={"Content-Type": "application/json", "X-3DIT-Signature": sig})
            if r.status_code < 500:
                return
        except requests.RequestException:
            traceback.print_exc()
        time.sleep(2 ** attempt)


def worker():
    while True:
        req = queue.get()
        try:
            callback(req, status="processing", progress=5)
            with tempfile.TemporaryDirectory() as tmp:
                img_path = os.path.join(tmp, "input")
                r = requests.get(req.image_url, timeout=60)
                r.raise_for_status()
                if len(r.content) > MAX_IMAGE_BYTES:
                    raise ValueError("Image is larger than 20 MB")
                with open(img_path, "wb") as f:
                    f.write(r.content)
                callback(req, status="processing", progress=15)

                seed = req.options.seed if req.options.seed is not None else 42
                raw = trellis_runner.run_trellis(img_path, seed, req.options.target_faces, tmp)
                callback(req, status="processing", progress=80)

                files, faces, watertight = export_all(raw["glb"], raw["print_mesh"], tmp, req.options.target_faces)
                outputs = {}
                for kind, path in files.items():
                    url = req.upload_urls.get(kind)
                    if not url:
                        continue
                    with open(path, "rb") as f:
                        up = requests.put(url, data=f, timeout=300,
                                          headers={"Content-Type": "application/octet-stream", "x-upsert": "true"})
                    outputs[kind] = up.ok
                    if not up.ok:
                        print(f"upload {kind} failed: {up.status_code} {up.text[:200]}")
                if not outputs.get("glb"):
                    raise RuntimeError("Could not upload the finished model")
                callback(req, status="done", progress=100, outputs=outputs, face_count=faces)
                print(f"job {req.job_id} done, faces={faces}, watertight={watertight}")
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            callback(req, status="failed", error=str(e)[:1000])
        finally:
            queue.task_done()


def _load():
    try:
        trellis_runner.load_pipeline()
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        state["load_error"] = str(e)[:500]


@asynccontextmanager
async def lifespan(_app):
    threading.Thread(target=_load, daemon=True).start()  # model load takes minutes
    threading.Thread(target=worker, daemon=True).start()
    yield


app = FastAPI(title="3DIT generation backend", lifespan=lifespan)


@app.get("/health")
def health():
    """Safe to call from a browser: shows whether the model is ready, never secrets."""
    return {
        "ok": trellis_runner.is_loaded(),
        "model_loaded": trellis_runner.is_loaded(),
        "loading": not trellis_runner.is_loaded() and state["load_error"] is None,
        "load_error": state["load_error"],
        "gpu": trellis_runner.gpu_info(),
        "texture_mode": trellis_runner.TEXTURE_MODE,
        "queue_length": queue.qsize(),
        "uptime_s": int(time.time() - state["started_at"]),
    }


@app.post("/v1/jobs/image-to-3d", status_code=202, dependencies=[Depends(auth)])
def create_job(req: ImageTo3DRequest):
    if not trellis_runner.is_loaded():
        raise HTTPException(503, "Model is still loading")
    for u in [req.image_url, req.callback_url, *req.upload_urls.values()]:
        _check_host(u)
    jobs[req.job_id] = {"status": "queued", "progress": 0}
    queue.put(req)
    return {"job_id": req.job_id, "status": "queued"}


@app.get("/v1/jobs/{job_id}", dependencies=[Depends(auth)])
def get_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Unknown job")
    return jobs[job_id]
