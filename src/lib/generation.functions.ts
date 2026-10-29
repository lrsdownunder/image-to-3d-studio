import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { readSecret } from "@/lib/env-secret";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BACKEND_NOT_CONNECTED,
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
};

/** Tells the UI whether the GPU backend is configured and healthy (never reveals secrets). */
export const getBackendStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<BackendHealth> => {
    const url = readSecret("GENERATION_BACKEND_URL");
    const configured = Boolean(
      url && readSecret("GENERATION_BACKEND_TOKEN") && readSecret("GENERATION_CALLBACK_SECRET"),
    );
    const base = { configured, reachable: false, modelLoaded: false, loading: false, gpu: null, error: null };
    if (!configured || !url) return base;
    try {
      const res = await fetch(`${url.replace(/\/+$/, "")}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { ...base, error: `Health check returned ${res.status}` };
      const h = (await res.json()) as {
        model_loaded?: boolean;
        loading?: boolean;
        load_error?: string | null;
        gpu?: { name?: string | null };
      };
      return {
        configured,
        reachable: true,
        modelLoaded: Boolean(h.model_loaded),
        loading: Boolean(h.loading),
        gpu: h.gpu?.name ?? null,
        error: h.load_error ?? null,
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
