# 3DIT Roadmap

- [x] Technical plan for self-hosted pipeline (TRELLIS.2 on RunPod, FastAPI, no Meshy)
- [x] Phase 1: Design, landing page, sign in, upload page, 3D viewer, library
- [x] Phase 1: Database tables + private storage + job API contract
- [x] Phase 1: Server code that hands jobs to the GPU backend + signed callback (inactive until secrets exist)
- [x] Phase 2: real TRELLIS.2 loading + running code, licence review, install guide, health check
- [x] Install scripts + README for Ubuntu 22.04 / CUDA 12.4 / A6000
- [x] RunPod smoke-test command (model load, background removal, one full job)
- [x] AI photo check on Create page (printability + tips)
- [ ] Phase 2 (outside Lovable): deploy `backend/` on RunPod — blocked on user (Hugging Face DINOv3 access, RunPod account)
- [ ] Phase 2: add backend secrets and run a real end-to-end test — blocked on Phase 2 deploy
- [ ] Phase 3: Blender clean-up, print sizing in mm
- [ ] Phase 4: Text-to-image-to-3D with a self-hosted, commercially licensed image model
