import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PhotoCheck } from "@/lib/photo-check";

const input = z.object({ inputPath: z.string().min(3).max(300) });

/** AI review of an uploaded photo: is it a good source for a 3D-printable model? */
export const checkPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({ data, context }): Promise<{ result: PhotoCheck | null; error: string | null }> => {
    if (!data.inputPath.startsWith(`${context.userId}/`)) return { result: null, error: "Invalid image" };
    const { data: signed, error } = await context.supabase.storage
      .from("inputs")
      .createSignedUrl(data.inputPath, 10 * 60);
    if (error || !signed) return { result: null, error: "Could not read your photo" };
    const { runPhotoCheck, PhotoCheckError } = await import("@/lib/photo-check.server");
    try {
      return { result: await runPhotoCheck(signed.signedUrl), error: null };
    } catch (e) {
      return { result: null, error: e instanceof PhotoCheckError ? e.message : "The AI couldn't check this photo." };
    }
  });
