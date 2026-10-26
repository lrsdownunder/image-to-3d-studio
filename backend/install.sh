#!/usr/bin/env bash
# One-time install on a RunPod pod (PyTorch / CUDA 12.4 template, Ubuntu 22.04).
# Run from inside the 3dit backend folder:  bash install.sh
set -euo pipefail
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
cd /workspace

# 1. Miniconda (TRELLIS.2 recommends conda)
if [ ! -d /workspace/miniconda3 ]; then
  wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/mc.sh
  bash /tmp/mc.sh -b -p /workspace/miniconda3
fi
source /workspace/miniconda3/etc/profile.d/conda.sh

# 2. TRELLIS.2 source
if [ ! -d /workspace/TRELLIS.2 ]; then
  git clone -b main https://github.com/microsoft/TRELLIS.2.git --recursive /workspace/TRELLIS.2
fi
cd /workspace/TRELLIS.2
export CUDA_HOME=${CUDA_HOME:-/usr/local/cuda-12.4}

# 3. Official dependency script. nvdiffrast / nvdiffrec are deliberately NOT installed:
#    they are NVIDIA non-commercial licences. Add them only for evaluation (TEXTURE_MODE=pbr).
#    o-voxel imports nvdiffrast at module level, so it is installed but only imported in pbr mode.
. ./setup.sh --new-env --basic --flash-attn --cumesh --o-voxel --flexgemm

# 4. 3DIT server extras
conda activate trellis2
pip install -r "$BACKEND_DIR/requirements.txt"
echo "Install finished. Next: fill in $BACKEND_DIR/.env and run start.sh"
