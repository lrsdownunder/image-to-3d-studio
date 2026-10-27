#!/usr/bin/env bash
# Start the 3DIT AI server on port 8000.  Usage:  bash start.sh
set -euo pipefail
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
[ -f "$BACKEND_DIR/.env" ] || { echo "Missing $BACKEND_DIR/.env - copy .env.example and fill it in."; exit 1; }
[ -f /root/miniconda3/etc/profile.d/conda.sh ] || { echo "Programs not installed on this pod (container disk resets when a pod is replaced). Run: bash install.sh"; exit 1; }
source /root/miniconda3/etc/profile.d/conda.sh
conda activate trellis2
set -a; source "$BACKEND_DIR/.env"; set +a
for v in GENERATION_BACKEND_TOKEN GENERATION_CALLBACK_SECRET HF_TOKEN; do
  case "${!v:-}" in ""|change-me*|hf_xxx) echo "Please set $v in .env"; exit 1;; esac
done
export PYTHONPATH="/root/TRELLIS.2:${PYTHONPATH:-}"
# All model downloads/caches on the persistent volume.
export HF_HOME=/workspace/hf-cache
export HF_HUB_CACHE=/workspace/hf-cache/hub
export TORCH_HOME=/workspace/torch-cache
mkdir -p "$HF_HOME" "$TORCH_HOME"
cd "$BACKEND_DIR"
# One worker only: the model lives in GPU memory and jobs run one at a time.
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
