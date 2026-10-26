"""
3DIT generation backend (runs on RunPod, NOT inside Lovable).

Implements the contract the 3DIT site expects:
  GET  /health
  POST /v1/jobs/image-to-3d
  GET  /v1/jobs/{job_id}
and reports progress to the site's callback URL, signed with HMAC-SHA256.

The TRELLIS.2 call in `run_trellis` must be checked against the official
microsoft/TRELLIS.2 README for the version you install — it is marked TODO.
"""
import hashlib
import hmac
import json
import os
import tempfile
import threading
import traceback
from queue import Queue

import requests
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from mesh_tools import export_all

BACKEND_TOKEN = os.environ["GENERATION_BACKEND_TOKEN"]
CALLBACK_SECRET = os.environ["GENERATION_CALLBACK_SECRET"]

app = FastAPI(title="3DIT generation backend")
jobs: dict[str, dict] = {}
queue: "Queue[dict]" = Queue()
pipeline = None  # loaded once at startup


class Options(BaseModel):
    seed: int | None = None
    texture: bool = True
    target_faces: int = Field(100_000, ge=1_000, le=500_000)
    formats: list[str] = ["glb", "obj", "stl"]


class ImageTo3DRequest(BaseModel):
    job_id: str
    image_url: str
    callback_url: str
    options: Options
    upload_urls: dict[str, str] = {}


def auth(authorization: str = Header("")):
    if not hmac.compare_digest(authorization, f"Bearer {BACKEND_TOKEN}"):
        raise HTTPException(401, "Unauthorized")


def callback(req: ImageTo3DRequest, **payload):
    body = json.dumps({"job_id": req.job_id, **payload}, separators=(",", ":"))
    sig = hmac.new(CALLBACK_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    jobs[req.job_id].update(payload)
    try:
        requests.post(req.callback_url, data=body, timeout=15,
                      headers={"Content-Type": "application/json", "X-3DIT-Signature": sig})
    except requests.RequestException:
        traceback.print_exc()


def load_pipeline():
    global pipeline
    # TODO: verify against the TRELLIS.2 README, e.g.
    # from trellis2.pipelines import Trellis2ImageTo3DPipeline
    # pipeline = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B").cuda()
    pipeline = None


def run_trellis(image_path: str, opts: Options, out_dir: str) -> str:
    """Return the path to a raw GLB produced by TRELLIS.2."""
    if pipeline is None:
        raise RuntimeError("TRELLIS.2 pipeline is not loaded")
    # TODO: call the pipeline and export a GLB to out_dir/raw.glb
    raise NotImplementedError


def worker():
    while True:
        req: ImageTo3DRequest = queue.get()
        try:
            callback(req, status="processing", progress=5)
            with tempfile.TemporaryDirectory() as tmp:
                img = os.path.join(tmp, "input")
                with open(img, "wb") as f:
                    f.write(requests.get(req.image_url, timeout=60).content)
                callback(req, status="processing", progress=15)
                raw = run_trellis(img, req.options, tmp)
                callback(req, status="processing", progress=80)
                files, faces = export_all(raw, tmp, req.options.target_faces)
                outputs = {}
                for kind, path in files.items():
                    url = req.upload_urls.get(kind)
                    if not url:
                        continue
                    with open(path, "rb") as f:
                        r = requests.put(url, data=f, timeout=300,
                                         headers={"Content-Type": "application/octet-stream", "x-upsert": "true"})
                    outputs[kind] = r.ok
                callback(req, status="done", progress=100, outputs=outputs, face_count=faces)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            callback(req, status="failed", error=str(e)[:1000])


@app.on_event("startup")
def startup():
    load_pipeline()
    threading.Thread(target=worker, daemon=True).start()


@app.get("/health")
def health():
    import torch
    return {"ok": True, "model_loaded": pipeline is not None,
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}


@app.post("/v1/jobs/image-to-3d", status_code=202, dependencies=[Depends(auth)])
def create_job(req: ImageTo3DRequest):
    jobs[req.job_id] = {"status": "queued", "progress": 0}
    queue.put(req)
    return {"job_id": req.job_id, "status": "queued"}


@app.get("/v1/jobs/{job_id}", dependencies=[Depends(auth)])
def get_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(404, "Unknown job")
    return jobs[job_id]
