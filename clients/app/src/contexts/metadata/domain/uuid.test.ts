import { describe, expect, it } from "vitest";
import { stableUuid } from "./uuid";

describe("stableUuid", () => {
  it("is deterministic for the same value", async () => {
    await expect(stableUuid("https://a.com/")).resolves.toBe(
      await stableUuid("https://a.com/"),
    );
  });

  it("differs across values", async () => {
    await expect(stableUuid("https://a.com/")).resolves.not.toBe(
      await stableUuid("https://b.com/"),
    );
  });

  it("is shaped like a uuid", async () => {
    const uuid = await stableUuid("https://a.com/");
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
  });
});
