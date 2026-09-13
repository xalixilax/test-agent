import { describe, expect, it } from "vitest";
import { signImagePath, verifyImagePath } from "../src/application/image-signing";

const SECRET = "test-signing-secret";
const NOW = 1_000_000;

describe("image signing", () => {
  it("verifies a freshly signed path", async () => {
    const exp = NOW + 3600;
    const signature = await signImagePath(SECRET, "u1", "abc", exp);
    await expect(verifyImagePath(SECRET, "u1", "abc", exp, signature, NOW)).resolves.toBe(true);
  });

  it("rejects expired signatures", async () => {
    const exp = NOW - 1;
    const signature = await signImagePath(SECRET, "u1", "abc", exp);
    await expect(verifyImagePath(SECRET, "u1", "abc", exp, signature, NOW)).resolves.toBe(false);
  });

  it("rejects wrong keys, signatures and secrets", async () => {
    const exp = NOW + 3600;
    const signature = await signImagePath(SECRET, "u1", "abc", exp);
    await expect(verifyImagePath(SECRET, "u2", "abc", exp, signature, NOW)).resolves.toBe(false);
    await expect(verifyImagePath(SECRET, "u1", "abc", exp, "0".repeat(64), NOW)).resolves.toBe(
      false,
    );
    await expect(verifyImagePath("other-secret", "u1", "abc", exp, signature, NOW)).resolves.toBe(
      false,
    );
  });
});
