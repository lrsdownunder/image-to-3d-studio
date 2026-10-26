// HMAC-SHA256 helpers used to verify callbacks from the GPU generation backend.
// Web Crypto only, so this runs on the Worker runtime.

export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignature(
  secret: string,
  body: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const expected = await hmacSha256Hex(secret, body);
  return timingSafeEqualHex(expected, signature.trim().toLowerCase());
}
