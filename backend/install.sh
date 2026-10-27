#!/usr/bin/env bash
# One-time install of the 3DIT GPU server on a RunPod pod.
# Recommended template: Ubuntu 22.04 + CUDA 12.4. It should also work on other
# templates (e.g. Ubuntu 24.04 + CUDA 12.8) because we install our OWN CUDA 12.4
# compiler inside the conda environment, matching TRELLIS.2's torch 2.6.0+cu124.
# Run from inside the backend folder:  bash install.sh
set -eo pipefail   # (no -u: conda and setup.sh use unset variables)
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
cd /workspace
command -v nvidia-smi >/dev/null || { echo "No NVIDIA GPU visible - stop."; exit 1; }
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv
# setup.sh calls sudo; RunPod pods run as root without it
command -v sudo >/dev/null || { apt-get update && apt-get install -y sudo; }
apt-get update && apt-get install -y git wget build-essential libjpeg-dev

# 1. Miniconda (TRELLIS.2 recommends conda)
if [ ! -d /workspace/miniconda3 ]; then
  wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/mc.sh
  bash /tmp/mc.sh -b -p /workspace/miniconda3
fi
source /workspace/miniconda3/etc/profile.d/conda.sh
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 2>/dev/null || true
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r 2>/dev/null || true

# 2. TRELLIS.2 source
if [ ! -d /workspace/TRELLIS.2 ]; then
  git clone -b main https://github.com/microsoft/TRELLIS.2.git --recursive /workspace/TRELLIS.2
fi
cd /workspace/TRELLIS.2

# 3. Our own Python 3.10 env with a CUDA 12.4 compiler, so the template's system CUDA
#    version (12.8 etc.) no longer matters. torch 2.6.0+cu124 = what TRELLIS.2 pins.
if ! conda env list | grep -q '^trellis2 '; then
  conda create -y -n trellis2 python=3.10
fi
conda activate trellis2
conda install -y -c "nvidia/label/cuda-12.4.1" cuda-nvcc cuda-cudart-dev cuda-libraries-dev cuda-cccl
export CUDA_HOME="$CONDA_PREFIX"
export PATH="$CUDA_HOME/bin:$PATH"
nvcc --version | grep -q "release 12.4" || { echo "CUDA 12.4 compiler not active - stop."; exit 1; }
pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
# Build GPU extensions for Ampere (A6000/A100 = 8.0/8.6) + Ada/Hopper; faster, fewer errors.
export TORCH_CUDA_ARCH_LIST="${TORCH_CUDA_ARCH_LIST:-8.0;8.6;8.9;9.0}"
export MAX_JOBS="${MAX_JOBS:-8}"

# 4. Commercial-safe patch: drop o_voxel's eager import of `postprocess` (the only part
#    needing NVIDIA nvdiffrast, a non-commercial licence).
sed -i '/^\s*postprocess,\s*$/d' o-voxel/o_voxel/__init__.py
grep -q postprocess o-voxel/o_voxel/__init__.py && { echo "Patch failed - check o-voxel/o_voxel/__init__.py"; exit 1; }

# 5. pillow-simd is unmaintained and fails to compile on newer compilers (Ubuntu 24.04).
#    Plain Pillow works identically, just slightly slower.
sed -i 's/^\(\s*\)pip install pillow-simd/\1pip install pillow-simd || pip install pillow/' setup.sh

# 6. flash-attn: install ourselves with --no-build-isolation so it picks up the prebuilt
#    wheel for torch 2.6 + CUDA 12 instead of a 45-minute source build.
pip install ninja packaging wheel
pip install flash-attn==2.7.3 --no-build-isolation
python -c "import flash_attn; print('flash-attn', flash_attn.__version__)"

# 7. Official dependency script (env already made; no --nvdiffrast / --nvdiffrec).
. ./setup.sh --basic --cumesh --o-voxel --flexgemm

# 8. 3DIT server extras + import check
pip install -r "$BACKEND_DIR/requirements.txt"
python - <<'PY'
import torch, flash_attn, cumesh, flex_gemm, o_voxel, trimesh, fastapi
print("torch", torch.__version__, "cuda", torch.version.cuda, "gpu", torch.cuda.get_device_name(0))
from trellis2.pipelines import Trellis2ImageTo3DPipeline
print("All imports OK")
PY
echo "Install finished. Next: fill in $BACKEND_DIR/.env and run start.sh"
