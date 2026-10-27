#!/usr/bin/env bash
# GPU smoke test. Stop the server first (it shares the GPU). Usage: bash smoke_test.sh [photo]
set -eo pipefail
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
[ -f "$BACKEND_DIR/.env" ] || { echo "Missing .env - see README step 5."; exit 1; }
source /workspace/miniconda3/etc/profile.d/conda.sh
conda activate trellis2
set -a; source "$BACKEND_DIR/.env"; set +a
export PYTHONPATH="/workspace/TRELLIS.2:${PYTHONPATH:-}"
export HF_HOME=/workspace/hf-cache HF_HUB_CACHE=/workspace/hf-cache/hub TORCH_HOME=/workspace/torch-cache
cd "$BACKEND_DIR"
python smoke_test.py "$@" 2>&1 | tee smoke_test.log
