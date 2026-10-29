# Majoto 3D GPU server image (TRELLIS.2 + FastAPI), preinstalled so pods start without reinstalling.
# Built by GitHub Actions (.github/workflows/backend-image.yml) -> ghcr.io/<you>/majoto-backend
# Models, caches and the .env file stay on the RunPod persistent volume (/workspace).
FROM runpod/pytorch:0.7.0-ubuntu2204-cu1241-torch260

ENV DEBIAN_FRONTEND=noninteractive \
    CUDA_HOME=/usr/local/cuda \
    TORCH_CUDA_ARCH_LIST="8.6;8.9" \
    MAX_JOBS=4 \
    FORCE_CUDA=1

RUN apt-get update || true; \
    apt-get install -y --no-install-recommends git wget build-essential libjpeg-dev ninja-build \
    && rm -rf /var/lib/apt/lists/*

# Python 3.10 conda env (matches install.sh, which is the tested recipe)
RUN wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/mc.sh \
    && bash /tmp/mc.sh -b -p /opt/conda && rm /tmp/mc.sh \
    && /opt/conda/bin/conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main || true; \
    /opt/conda/bin/conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r || true; \
    /opt/conda/bin/conda create -y -n trellis2 python=3.10 && /opt/conda/bin/conda clean -afy
SHELL ["/opt/conda/bin/conda", "run", "--no-capture-output", "-n", "trellis2", "/bin/bash", "-c"]

RUN pip install --no-cache-dir torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124 \
    && pip install --no-cache-dir ninja packaging wheel psutil

# Prebuilt flash-attn wheel (avoids a multi-hour compile on GitHub's small machines)
RUN pip install --no-cache-dir \
    https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.3/flash_attn-2.7.3+cu12torch2.6cxx11abiFALSE-cp310-cp310-linux_x86_64.whl

# TRELLIS.2 source + commercial-safe patches (same as install.sh)
RUN git clone -b main --recursive https://github.com/microsoft/TRELLIS.2.git /opt/TRELLIS.2 \
    && cd /opt/TRELLIS.2 \
    && sed -i '/^\s*postprocess,\s*$/d' o-voxel/o_voxel/__init__.py \
    && ! grep -q postprocess o-voxel/o_voxel/__init__.py \
    && sed -i 's/^\(\s*\)pip install pillow-simd$/\1pip install pillow-simd || pip install pillow/' setup.sh

# CUDA extensions compile without a GPU because TORCH_CUDA_ARCH_LIST is fixed above (A6000 = 8.6).
RUN cd /opt/TRELLIS.2 && (. ./setup.sh --basic --cumesh --o-voxel --flexgemm || true) \
    && for m in cumesh flex_gemm o_voxel utils3d trimesh transformers flash_attn; do python -c "import $m" || exit 1; done

COPY requirements.txt /opt/majoto-backend/requirements.txt
RUN pip install --no-cache-dir -r /opt/majoto-backend/requirements.txt
COPY *.py *.sh .env.example /opt/majoto-backend/
RUN chmod +x /opt/majoto-backend/entrypoint.sh

ENV PYTHONPATH=/opt/TRELLIS.2 \
    HF_HOME=/workspace/hf-cache \
    HF_HUB_CACHE=/workspace/hf-cache/hub \
    TORCH_HOME=/workspace/torch-cache
WORKDIR /opt/majoto-backend
EXPOSE 8000
SHELL ["/bin/bash", "-c"]
ENTRYPOINT ["/opt/majoto-backend/entrypoint.sh"]
