#!/usr/bin/env bash
# Start the 3DIT AI server on port 8000.  Usage:  bash start.sh
set -euo pipefail
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
source /workspace/miniconda3/etc/profile.d/conda.sh
conda activate trellis2
set -a; source "$BACKEND_DIR/.env"; set +a
export PYTHONPATH="/workspace/TRELLIS.2:${PYTHONPATH:-}"
export HF_HOME=/workspace/hf-cache
cd "$BACKEND_DIR"
# One worker only: the model lives in GPU memory and jobs run one at a time.
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
