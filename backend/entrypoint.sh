#!/usr/bin/env bash
# Container start: load /workspace/.env and run the Majoto 3D AI server on port 8000.
# If .env is missing, keep the pod alive (JupyterLab still works) so you can create it.
set -uo pipefail
ENV_FILE="${MAJOTO_ENV_FILE:-/workspace/.env}"
mkdir -p /workspace/hf-cache/hub /workspace/torch-cache

# Keep RunPod's normal start (JupyterLab / SSH) running in the background if present.
[ -x /start.sh ] && (/start.sh >/workspace/runpod-start.log 2>&1 &)

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Create it from /opt/majoto-backend/.env.example, then restart the pod."
  exec sleep infinity
fi
set -a; source "$ENV_FILE"; set +a
for v in GENERATION_BACKEND_TOKEN GENERATION_CALLBACK_SECRET HF_TOKEN; do
  case "${!v:-}" in ""|change-me*|hf_xxx) echo "Please set $v in $ENV_FILE"; exec sleep infinity;; esac
done

source /opt/conda/etc/profile.d/conda.sh
conda activate trellis2
cd /opt/majoto-backend
# One worker: the model lives in GPU memory and jobs run one at a time.
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
