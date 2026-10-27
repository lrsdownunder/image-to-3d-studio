// Server-only: asks the Lovable AI Gateway to judge a photo for image-to-3D + 3D printing.
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { photoCheckSchema, type PhotoCheck } from "@/lib/photo-check";

const MODEL = "openai/gpt-6-astra";

const INSTRUCTIONS = `You review photos that a user wants to turn into a 3D-printable model with an
image-to-3D AI (single photo in, textured mesh out). Judge ONLY what you can see.
Consider: one clear main object; plain, uncluttered background; even lighting without harsh
shadows or glare; whole object in frame and in focus; a 3/4 view that shows depth; no
transparent, mirror-like or very thin parts; and printability (thin features that would snap,
big overhangs, tiny details below ~0.4 mm at desk-toy size, floating parts).
Write in plain, friendly English for beginners. Keep each item to one short sentence.
score: 0-100 overall suitability. verdict: "good" (>=75), "okay" (45-74), "poor" (<45).`;

export class PhotoCheckError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function runPhotoCheck(imageUrl: string, signal?: AbortSignal): Promise<PhotoCheck> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new PhotoCheckError("The AI photo check isn't set up yet.", 500);

  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  let failure: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Assess this photo for 3D generation and 3D printing." },
          { type: "image", image: new URL(imageUrl) },
        ],
      },
    ],
    output: Output.object({ schema: photoCheckSchema }),
    maxRetries: 0,
    ...(signal ? { abortSignal: signal } : {}),
    onError: ({ error }) => {
      failure = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  try {
    return await result.output;
  } catch (err) {
    const e = (failure ?? err) as { statusCode?: number; message?: string };
    console.error("photo check failed", e?.statusCode, e?.message);
    const status = e?.statusCode ?? 500;
    if (status === 429) throw new PhotoCheckError("The AI is busy right now. Please try again in a minute.", 429);
    if (status === 402) throw new PhotoCheckError("AI credits have run out for this workspace.", 402);
    if (status === 403) throw new PhotoCheckError("The AI photo check isn't available right now.", 403);
    throw new PhotoCheckError("The AI couldn't check this photo. Please try again.", status);
  }
}
