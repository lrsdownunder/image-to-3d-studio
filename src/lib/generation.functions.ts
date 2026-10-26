import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BACKEND_NOT_CONNECTED,
  OUTPUT_FORMATS,
  jobOptionsSchema,
  outputPath,
  type ImageTo3DRequest,
} from "@/lib/backend-contract";

/** Tells the UI whether the GPU backend has been configured (never reveals values). */
export const getBackendStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const configured = Boolean(
      process.env["GENERATION_BACKEND_URL"] &&
        process.env["GENERATION_BACKEND_TOKEN"] &&
        process.env["GENERATION_CALLBACK_SECRET"],
    );
    return { configured };
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

    const backendUrl = process.env["GENERATION_BACKEND_URL"];
    const backendToken = process.env["GENERATION_BACKEND_TOKEN"];
    const callbackSecret = process.env["GENERATION_CALLBACK_SECRET"];

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
