import { outputPath, type CallbackBody } from "@/lib/backend-contract";

/** Applies a status update from the GPU backend (via callback or polling). Server-only, uses service role. */
export async function applyJobUpdate(body: CallbackBody): Promise<"ok" | "unknown" | "duplicate"> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: job } = await supabaseAdmin
    .from("generation_jobs")
    .select("id, user_id, status, options")
    .eq("id", body.job_id)
    .maybeSingle();
  if (!job) return "unknown";
  if (job.status === "done" || job.status === "failed") return "duplicate";

  await supabaseAdmin
    .from("generation_jobs")
    .update({
      status: body.status,
      progress: body.status === "done" ? 100 : (body.progress ?? 0),
      error: body.error ?? null,
    })
    .eq("id", job.id);

  if (body.status === "done") {
    const o = body.outputs ?? {};
    const title = (job.options as { title?: string | null })?.title || "Untitled model";
    await supabaseAdmin.from("models").insert({
      user_id: job.user_id,
      job_id: job.id,
      title,
      glb_path: o.glb ? outputPath(job.user_id, job.id, "glb") : null,
      obj_path: o.obj ? outputPath(job.user_id, job.id, "obj") : null,
      stl_path: o.stl ? outputPath(job.user_id, job.id, "stl") : null,
      thumbnail_path: o.thumbnail ? outputPath(job.user_id, job.id, "thumbnail") : null,
      face_count: body.face_count ?? null,
    });
  }
  return "ok";
}
