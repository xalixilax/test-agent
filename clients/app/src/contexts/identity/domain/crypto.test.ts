import { describe, expect, it } from "vitest";
import {
  decryptField,
  deriveKeys,
  encryptField,
  generateDataKey,
  generateSalt,
  unwrapDataKey,
  wrapDataKey,
} from "./crypto";

const ITERATIONS = 1_000;

describe("identity crypto", () => {
  it("derives the same auth hash and KEK from the same password and salt", async () => {
    const salt = generateSalt();
    const first = await deriveKeys("correct horse", salt, ITERATIONS);
    const second = await deriveKeys("correct horse", salt, ITERATIONS);
    expect(first.authHash).toBe(second.authHash);
  });

  it("derives different auth hashes for different passwords", async () => {
    const salt = generateSalt();
    const first = await deriveKeys("password-a", salt, ITERATIONS);
    const second = await deriveKeys("password-b", salt, ITERATIONS);
    expect(first.authHash).not.toBe(second.authHash);
  });

  it("wraps and unwraps the data key with the password-derived KEK", async () => {
    const salt = generateSalt();
    const dataKey = generateDataKey();
    const { kek } = await deriveKeys("secret", salt, ITERATIONS);
    const wrapped = await wrapDataKey(kek, dataKey);

    const { kek: sameKek } = await deriveKeys("secret", salt, ITERATIONS);
    await expect(unwrapDataKey(sameKek, wrapped)).resolves.toBe(dataKey);

    const { kek: wrongKek } = await deriveKeys("wrong", salt, ITERATIONS);
    await expect(unwrapDataKey(wrongKek, wrapped)).rejects.toThrow();
  });

  it("encrypts and decrypts fields with the data key only", async () => {
    const dataKey = generateDataKey();
    const ciphertext = await encryptField(dataKey, "a private note");
    expect(ciphertext).not.toContain("private");
    await expect(decryptField(dataKey, ciphertext)).resolves.toBe("a private note");

    const otherKey = generateDataKey();
    await expect(decryptField(otherKey, ciphertext)).rejects.toThrow();
  });
});
