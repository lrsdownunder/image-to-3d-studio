#!/usr/bin/env bash
# One-time install of the 3DIT GPU server on a RunPod pod.
# Target: Ubuntu 22.04 + CUDA 12.4 + PyTorch 2.6.0 (cu124), NVIDIA RTX A6000 48 GB.
# Image:  runpod/pytorch:0.7.0-ubuntu2204-cu1241-torch260
# Run from inside the backend folder:  bash install.sh 2>&1 | tee install.log
set -eo pipefail   # (no -u: conda and setup.sh use unset variables)
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
STEP="starting"
step() { STEP="$1"; echo; echo "==== [3DIT install] $1 ===="; }
fail() { echo; echo "XXXX [3DIT install] FAILED at: $STEP"; echo "     $1"; echo "     Copy the last 40 lines above (or install.log) to Lovable."; exit 1; }
trap 'fail "command failed on line $LINENO"' ERR

# RunPod network/global volumes refuse chmod, which breaks conda, git and compilers.
# So programs go on the container disk (/root); only model downloads use /workspace.
export HF_HOME=/workspace/hf-cache
export PIP_CACHE_DIR=/root/pip-cache
export TMPDIR=/root/tmp
mkdir -p "$HF_HOME" "$PIP_CACHE_DIR" "$TMPDIR"

step "1/9 Checking GPU, disk and volume"
command -v nvidia-smi >/dev/null || fail "No NVIDIA GPU visible. Deploy a GPU pod."
nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv
VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
[ "$VRAM_MB" -ge 23000 ] || fail "GPU has ${VRAM_MB} MB VRAM; TRELLIS.2 needs 24 GB+."
mountpoint -q /workspace || echo "WARNING: /workspace is not a separate volume - files may be lost when the pod stops."
FREE_GB=$(df -BG --output=avail /workspace | tail -1 | tr -dc 0-9)
[ "$FREE_GB" -ge 60 ] || echo "WARNING: /workspace reports ${FREE_GB} GB free (fine for elastic global volumes)."
ROOT_FREE=$(df -BG --output=avail / | tail -1 | tr -dc 0-9)
[ "$ROOT_FREE" -ge 30 ] || fail "Container disk has ${ROOT_FREE} GB free; need 30 GB+ (50 GB recommended)."

step "2/9 System packages"
command -v sudo >/dev/null || { apt-get update || true; apt-get install -y sudo; }
apt-get update || echo "WARNING: apt-get update had errors (often an expired key) - continuing."
apt-get install -y git wget build-essential libjpeg-dev

step "3/9 Miniconda"
if [ ! -d /root/miniconda3 ]; then
  wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/mc.sh
  bash /tmp/mc.sh -b -p /root/miniconda3
fi
source /root/miniconda3/etc/profile.d/conda.sh
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 2>/dev/null || true
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r 2>/dev/null || true

step "4/9 TRELLIS.2 source"
if [ ! -d /root/TRELLIS.2 ]; then
  git clone -b main https://github.com/microsoft/TRELLIS.2.git --recursive /root/TRELLIS.2
fi
cd /root/TRELLIS.2

step "5/9 Python 3.10 env + CUDA 12.4 compiler + PyTorch 2.6.0"
conda env list | grep -q '^trellis2 ' || conda create -y -n trellis2 python=3.10
conda activate trellis2
# Find a CUDA 12.4 compiler: CUDA_HOME, /usr/local/cuda-12.4, /usr/local/cuda, nvcc on PATH.
CUDA_HOME=""
for c in "${CUDA_HOME_OVERRIDE:-}" /usr/local/cuda-12.4 /usr/local/cuda "$(dirname "$(dirname "$(command -v nvcc 2>/dev/null || echo /x/x)")")"; do
  [ -n "$c" ] && [ -x "$c/bin/nvcc" ] && "$c/bin/nvcc" --version | grep -q "release 12.4" && { CUDA_HOME="$c"; break; }
done
if [ -z "$CUDA_HOME" ]; then
  echo "No system CUDA 12.4 compiler found - installing one inside the conda env."
  conda install -y -c "nvidia/label/cuda-12.4.1" cuda-nvcc cuda-cudart-dev cuda-libraries-dev cuda-cccl
  CUDA_HOME="$CONDA_PREFIX"
fi
export CUDA_HOME PATH="$CUDA_HOME/bin:$PATH"
echo "Using CUDA_HOME=$CUDA_HOME"
nvcc --version | grep -q "release 12.4" || fail "CUDA 12.4 compiler not active."
python -c "import torch,sys; sys.exit(0 if torch.__version__.startswith('2.6.0') and torch.version.cuda=='12.4' else 1)" 2>/dev/null \
  || pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
python -c "import torch; assert torch.cuda.is_available(), 'torch cannot see GPU'; print('torch', torch.__version__, 'cuda', torch.version.cuda)" \
  || fail "PyTorch cannot use the GPU (driver too old for CUDA 12.4?)."
# GPU architecture for compiled extensions: auto-detect (A6000 = 8.6), override if needed.
export TORCH_CUDA_ARCH_LIST="${TORCH_CUDA_ARCH_LIST:-$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader | head -1)}"
export MAX_JOBS="${MAX_JOBS:-8}"
echo "TORCH_CUDA_ARCH_LIST=$TORCH_CUDA_ARCH_LIST MAX_JOBS=$MAX_JOBS"

step "6/9 Commercial-safe patches"
# o_voxel eagerly imports `postprocess`, the only part needing nvdiffrast (non-commercial).
sed -i '/^\s*postprocess,\s*$/d' o-voxel/o_voxel/__init__.py
grep -q postprocess o-voxel/o_voxel/__init__.py && fail "o-voxel patch did not apply (upstream file changed)."
# pillow-simd is unmaintained and can fail to compile; fall back to normal Pillow.
sed -i 's/^\(\s*\)pip install pillow-simd$/\1pip install pillow-simd || pip install pillow/' setup.sh

step "7/9 flash-attn 2.7.3"
pip install ninja packaging wheel psutil
python -c "import flash_attn" 2>/dev/null || pip install flash-attn==2.7.3 --no-build-isolation
python -c "import flash_attn; print('flash-attn', flash_attn.__version__)" || fail "flash-attn did not install."

step "8/9 TRELLIS.2 dependencies (no nvdiffrast / nvdiffrec)"
trap - ERR   # setup.sh is sourced; check results explicitly instead
. ./setup.sh --basic --cumesh --o-voxel --flexgemm || true
trap 'fail "command failed on line $LINENO"' ERR
for m in cumesh flex_gemm o_voxel utils3d trimesh transformers; do
  python -c "import $m" || fail "Python package '$m' is missing after setup.sh."
done

step "9/9 3DIT server extras + final import check"
pip install -r "$BACKEND_DIR/requirements.txt"
python - <<'PY' || fail "Final import check failed."
import torch, fastapi
from trellis2.pipelines import Trellis2ImageTo3DPipeline
print("GPU:", torch.cuda.get_device_name(0), "| torch", torch.__version__, "| cuda", torch.version.cuda)
print("All imports OK")
PY
echo
echo "Install finished (imports OK - model not yet loaded or tested)."
echo "Next: fill in $BACKEND_DIR/.env and run: bash start.sh"
