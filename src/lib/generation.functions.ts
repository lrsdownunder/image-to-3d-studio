import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { readSecret } from "@/lib/env-secret";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BACKEND_NOT_CONNECTED,
  callbackSchema,
  OUTPUT_FORMATS,
  jobOptionsSchema,
  outputPath,
  type ImageTo3DRequest,
} from "@/lib/backend-contract";

export type BackendHealth = {
  configured: boolean;
  reachable: boolean;
  modelLoaded: boolean;
  loading: boolean;
  gpu: string | null;
  error: string | null;
  /** null = not checked; true/false = the GPU accepted/rejected 3DIT's key. Never reveals the key. */
  tokenAccepted: boolean | null;
};

/** Tells the UI whether the GPU backend is configured and healthy (never reveals secrets). */
export const getBackendStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<BackendHealth> => {
    const url = readSecret("GENERATION_BACKEND_URL");
    const token = readSecret("GENERATION_BACKEND_TOKEN");
    const configured = Boolean(url && token && readSecret("GENERATION_CALLBACK_SECRET"));
    const base: BackendHealth = {
      configured,
      reachable: false,
      modelLoaded: false,
      loading: false,
      gpu: null,
      error: null,
      tokenAccepted: null,
    };
    if (!configured || !url || !token) return base;
    const root = url.replace(/\/+$/, "");
    try {
      const res = await fetch(`${root}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { ...base, error: `Health check returned ${res.status}` };
      const h = (await res.json()) as {
        model_loaded?: boolean;
        loading?: boolean;
        load_error?: string | null;
        gpu?: { name?: string | null };
      };
      // Harmless authenticated request: 401 = key rejected, anything else (e.g. 404) = key accepted.
      let tokenAccepted: boolean | null = null;
      try {
        const k = await fetch(`${root}/v1/jobs/__keycheck`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        tokenAccepted = k.status !== 401;
        console.log(`[3DIT] key check: status ${k.status}`);
      } catch {
        tokenAccepted = null;
      }
      return {
        configured,
        reachable: true,
        modelLoaded: Boolean(h.model_loaded),
        loading: Boolean(h.loading),
        gpu: h.gpu?.name ?? null,
        error: h.load_error ?? null,
        tokenAccepted,
      };
    } catch {
      return { ...base, error: "AI server did not respond" };
    }
  });

const createJobInput = z.object({
  inputPath: z.string().min(3).max(300),
  title: z.string().max(120).optional(),
  options: jobOptionsSchema.partial().optional(),
});

export const createImageTo3DJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createJobInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.inputPath.startsWith(`${userId}/`)) throw new Error("Invalid image path");

    const options = jobOptionsSchema.parse(data.options ?? {});
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: job, error } = await supabaseAdmin
      .from("generation_jobs")
      .insert({
        user_id: userId,
        kind: "image_to_3d",
        input_image_path: data.inputPath,
        options: { ...options, title: data.title ?? null },
      })
      .select("id")
      .single();
    if (error || !job) throw new Error(`Could not save job: ${error?.message}`);

    const backendUrl = readSecret("GENERATION_BACKEND_URL");
    const backendToken = readSecret("GENERATION_BACKEND_TOKEN");
    const callbackSecret = readSecret("GENERATION_CALLBACK_SECRET");

    if (!backendUrl || !backendToken || !callbackSecret) {
      await supabaseAdmin
        .from("generation_jobs")
        .update({ status: "failed", error: BACKEND_NOT_CONNECTED })
        .eq("id", job.id);
      return { jobId: job.id, configured: false as const };
    }

    const { data: signedInput, error: signErr } = await supabaseAdmin.storage
      .from("inputs")
      .createSignedUrl(data.inputPath, 60 * 60);
    if (signErr || !signedInput) throw new Error("Could not prepare image link");

    const upload_urls: ImageTo3DRequest["upload_urls"] = {};
    for (const kind of [...OUTPUT_FORMATS, "thumbnail"] as const) {
      const { data: up } = await supabaseAdmin.storage
        .from("models")
        .createSignedUploadUrl(outputPath(userId, job.id, kind));
      if (up) upload_urls[kind] = up.signedUrl;
    }

    const origin = new URL(getRequest().url).origin;
    const body: ImageTo3DRequest = {
      job_id: job.id,
      image_url: signedInput.signedUrl,
      callback_url: `${origin}/api/public/generation-callback`,
      options: { ...options, formats: [...OUTPUT_FORMATS] },
      upload_urls,
    };

    const res = await fetch(`${backendUrl.replace(/\/+$/, "")}/v1/jobs/image-to-3d`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${backendToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 500);
      await supabaseAdmin
        .from("generation_jobs")
        .update({ status: "failed", error: `Backend error ${res.status}: ${text}` })
        .eq("id", job.id);
      return { jobId: job.id, configured: true as const };
    }
    const accepted = (await res.json().catch(() => ({}))) as { job_id?: string };
    await supabaseAdmin
      .from("generation_jobs")
      .update({ backend_job_id: accepted.job_id ?? job.id })
      .eq("id", job.id);
    return { jobId: job.id, configured: true as const };
  });

/**
 * Asks the GPU for a job's progress and saves it. Needed when the GPU's callbacks can't reach
 * the site (e.g. the private preview link blocks them). Only the job's owner may sync it.
 */
export const syncJobFromBackend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("generation_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) return { ok: false as const };
    if (job.status === "done" || job.status === "failed") return { ok: true as const };

    const url = readSecret("GENERATION_BACKEND_URL");
    const token = readSecret("GENERATION_BACKEND_TOKEN");
    if (!url || !token) return { ok: false as const };
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/v1/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false as const };
      const raw = Object.fromEntries(
        Object.entries((await res.json()) as Record<string, unknown>).filter(([, v]) => v != null),
      );
      const parsed = callbackSchema.safeParse({ ...raw, job_id: job.id });
      if (!parsed.success) return { ok: false as const };
      const { applyJobUpdate } = await import("@/lib/job-update.server");
      await applyJobUpdate(parsed.data);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });
