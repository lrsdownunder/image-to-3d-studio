# 3DIT Roadmap

- [x] Technical plan for self-hosted pipeline (TRELLIS.2 on RunPod, FastAPI, no Meshy)
- [x] Phase 1: Design, landing page, sign in, upload page, 3D viewer, library
- [x] Phase 1: Database tables + private storage + job API contract
- [x] Phase 1: Server code that hands jobs to the GPU backend + signed callback (inactive until secrets exist)
- [x] Phase 2: real TRELLIS.2 loading + running code, licence review, install guide, health check
- [x] Install scripts + README for Ubuntu 22.04 / CUDA 12.4 / A6000
- [x] RunPod smoke-test command (model load, background removal, one full job)
- [x] AI photo check on Create page (printability + tips)
- [x] Phase 2: deployed `backend/` on RunPod (RTX A6000 48GB, CUDA 12.4 image, 100GB persistent volume)
- [x] Phase 2: smoke test ALL PASSED on real GPU — model load, background removal, full image->3D job, GLB/OBJ/STL written
- [x] Phase 2: start FastAPI server on port 8000 and connect the 3DIT website to it (pod running + backend secrets)
- [x] Phase 2: real end-to-end test from the website (football photo -> real model in library, 98,483 faces)
- [ ] Phase 2: quality pass — sharper geometry/colour than the first football (pipeline type, texture mode, face target)
- [x] Hole-closing in backend export (voxel remesh + pymeshfix) — coded and tested locally on a synthetic holed mesh; needs a real GPU job to confirm
- [ ] Phase 2: pull updated backend on RunPod (`git pull` + `pip install -r requirements.txt`) and generate one test model to verify closed bottoms
- [ ] Phase 3: Blender clean-up, print sizing in mm
- [ ] Phase 4: Text-to-image-to-3D with a self-hosted, commercially licensed image model
- [ ] Build & test preinstalled GPU server image (GitHub builds it; not yet run)
