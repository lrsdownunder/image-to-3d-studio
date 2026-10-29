import { createFileRoute } from "@tanstack/react-router";
import { callbackSchema, outputPath } from "@/lib/backend-contract";
import { verifySignature } from "@/lib/hmac";
import { readSecret } from "@/lib/env-secret";

// Called by the GPU backend (FastAPI on RunPod). Only signed requests are accepted.
export const Route = createFileRoute("/api/public/generation-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = readSecret("GENERATION_CALLBACK_SECRET");
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const ok = await verifySignature(secret, raw, request.headers.get("x-3dit-signature"));
        if (!ok) return new Response("Invalid signature", { status: 401 });

        let body;
        try {
          body = callbackSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: job } = await supabaseAdmin
          .from("generation_jobs")
          .select("id, user_id, status, options")
          .eq("id", body.job_id)
          .maybeSingle();
        if (!job) return new Response("Unknown job", { status: 404 });
        if (job.status === "done") return Response.json({ ok: true, duplicate: true });

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
        return Response.json({ ok: true });
      },
    },
  },
});
