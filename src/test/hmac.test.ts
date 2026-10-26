import { describe, expect, it } from "vitest";
import { hmacSha256Hex, verifySignature } from "@/lib/hmac";
import { outputPath } from "@/lib/backend-contract";

describe("backend callback signature", () => {
  it("accepts a correctly signed body", async () => {
    const body = '{"job_id":"x","status":"done"}';
    const sig = await hmacSha256Hex("secret", body);
    expect(await verifySignature("secret", body, sig)).toBe(true);
  });
  it("rejects a tampered body", async () => {
    const sig = await hmacSha256Hex("secret", '{"status":"done"}');
    expect(await verifySignature("secret", '{"status":"failed"}', sig)).toBe(false);
  });
  it("rejects a missing signature", async () => {
    expect(await verifySignature("secret", "{}", null)).toBe(false);
  });
});

describe("output files", () => {
  it("are stored inside the owner's folder", () => {
    expect(outputPath("u1", "j1", "stl")).toBe("u1/j1/model.stl");
  });
});
