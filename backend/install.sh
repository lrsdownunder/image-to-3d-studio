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

# 3. Commercial-safe patch: o_voxel/__init__.py eagerly imports `postprocess`, the only
#    o-voxel module that needs NVIDIA nvdiffrast (non-commercial licence). We remove that
#    eager import so the shape decoder can use o_voxel.convert without nvdiffrast installed.
#    (o-voxel is part of the MIT-licensed TRELLIS.2 repo, so this change is allowed.)
sed -i '/^\s*postprocess,\s*$/d' o-voxel/o_voxel/__init__.py
grep -q postprocess o-voxel/o_voxel/__init__.py && { echo "Patch failed - check o-voxel/o_voxel/__init__.py"; exit 1; }

# 4. Official dependency script WITHOUT --nvdiffrast / --nvdiffrec (NVIDIA non-commercial).
#    Add those two flags only on a separate evaluation machine if you want TEXTURE_MODE=pbr.
. ./setup.sh --new-env --basic --flash-attn --cumesh --o-voxel --flexgemm

# 5. 3DIT server extras
conda activate trellis2
pip install -r "$BACKEND_DIR/requirements.txt"
echo "Install finished. Next: fill in $BACKEND_DIR/.env and run start.sh"
