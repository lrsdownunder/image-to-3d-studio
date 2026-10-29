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

        const { applyJobUpdate } = await import("@/lib/job-update.server");
        const r = await applyJobUpdate(body);
        if (r === "unknown") return new Response("Unknown job", { status: 404 });
        return Response.json({ ok: true, duplicate: r === "duplicate" });
      },
    },
  },
});
