import { describe, expect, it } from "vitest";
import { isNewer } from "sync-protocol";

describe("last-write-wins ordering", () => {
  it("accepts anything when there is no existing version", () => {
    expect(isNewer({ updatedAt: 1, deviceId: "a" }, null)).toBe(true);
  });

  it("uses the higher timestamp", () => {
    expect(isNewer({ updatedAt: 200, deviceId: "a" }, { updatedAt: 100, deviceId: "z" })).toBe(
      true,
    );
    expect(isNewer({ updatedAt: 100, deviceId: "a" }, { updatedAt: 200, deviceId: "z" })).toBe(
      false,
    );
  });

  it("breaks timestamp ties by device id deterministically", () => {
    expect(isNewer({ updatedAt: 100, deviceId: "b" }, { updatedAt: 100, deviceId: "a" })).toBe(
      true,
    );
    expect(isNewer({ updatedAt: 100, deviceId: "b" }, { updatedAt: 100, deviceId: "b" })).toBe(
      false,
    );
  });
});
