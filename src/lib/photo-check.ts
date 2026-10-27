import { z } from "zod";

// Strict-schema friendly: every field required, objects closed.
export const photoCheckSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    verdict: z.enum(["good", "okay", "poor"]),
    summary: z.string(),
    strengths: z.array(z.string()),
    issues: z.array(z.object({ problem: z.string(), fix: z.string() }).strict()),
    print_tips: z.array(z.string()),
  })
  .strict();
export type PhotoCheck = z.infer<typeof photoCheckSchema>;
