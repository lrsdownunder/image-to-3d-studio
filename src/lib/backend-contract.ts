// Shared contract between the 3DIT site and the self-hosted GPU backend
// (FastAPI + TRELLIS.2 on RunPod). Keep in sync with backend/README.md.
import { z } from "zod";

export const OUTPUT_FORMATS = ["glb", "obj", "stl"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const jobOptionsSchema = z.object({
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
  texture: z.boolean().default(true),
  target_faces: z.number().int().min(1_000).max(500_000).default(100_000),
});
export type JobOptions = z.infer<typeof jobOptionsSchema>;

/** Body the site POSTs to `${GENERATION_BACKEND_URL}/v1/jobs/image-to-3d`. */
export type ImageTo3DRequest = {
  job_id: string;
  image_url: string;
  callback_url: string;
  options: JobOptions & { formats: OutputFormat[] };
  /** Signed upload URLs the worker PUTs results to (no Cloud keys on the GPU). */
  upload_urls: Partial<Record<OutputFormat | "thumbnail", string>>;
};

/** Body the backend POSTs to the callback, signed with X-3DIT-Signature. */
export const callbackSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(["queued", "processing", "done", "failed"]),
  progress: z.number().int().min(0).max(100).optional(),
  error: z.string().max(2000).optional(),
  face_count: z.number().int().min(0).optional(),
  outputs: z
    .object({
      glb: z.boolean().optional(),
      obj: z.boolean().optional(),
      stl: z.boolean().optional(),
      thumbnail: z.boolean().optional(),
    })
    .optional(),
});
export type CallbackBody = z.infer<typeof callbackSchema>;

export function outputPath(userId: string, jobId: string, kind: OutputFormat | "thumbnail") {
  return `${userId}/${jobId}/${kind === "thumbnail" ? "thumbnail.png" : `model.${kind}`}`;
}

export const BACKEND_NOT_CONNECTED =
  "Generation backend not connected yet. The TRELLIS.2 server on RunPod still needs to be deployed.";
