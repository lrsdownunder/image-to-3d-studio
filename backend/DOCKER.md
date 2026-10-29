# Majoto 3D GPU server as a ready-made image (no reinstalling)

Status: written but NOT yet built or tested on a GPU.

## Why
The pod's container disk resets when a pod is replaced; only `/workspace` survives.
This image has every program preinstalled, so a fresh pod only needs `/workspace` (models + `.env`).

## Note: RunPod pods cannot build images
Pods are themselves containers and have no Docker inside, so GitHub builds the image for free.

## One-time steps
1. Make sure the latest project code is on GitHub (Lovable syncs it).
2. GitHub repo -> **Actions** -> "Build Majoto 3D GPU server image" -> **Run workflow**. Takes ~1-2 hours.
   If it fails, copy the red step's last lines to Lovable.
3. GitHub profile -> **Packages** -> `majoto-backend` -> Package settings -> **Change visibility -> Public**
   (simplest; image has no secrets). Private also works but RunPod then needs a GitHub token as "registry credentials".
4. Move your secrets file onto the persistent volume (once, in the JupyterLab terminal of a running pod):
   `cp /root/3dit-backend/.env /workspace/.env` (or create it from `.env.example`).
5. RunPod -> your pod -> **Edit Pod / template** -> Container Image:
   `ghcr.io/<your-github-username-lowercase>/majoto-backend:latest`
   Keep: container disk 50 GB, volume mounted at `/workspace`, HTTP port 8000, port 8888.
6. Start the pod. First start downloads the image (a few minutes); the server starts by itself.
7. Check: `https://<pod-id>-8000.proxy.runpod.net/health` -> `model_loaded: true`, or the green badge on the Create page.

## Updating
Change backend code -> GitHub rebuilds automatically -> restart the pod.
