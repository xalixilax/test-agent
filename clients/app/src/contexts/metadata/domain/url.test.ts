import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("lowercases the host and strips fragments", () => {
    expect(normalizeUrl("HTTPS://Example.COM/Path/?q=1#section")).toBe(
      "https://example.com/Path?q=1",
    );
  });

  it("keeps query strings as part of identity", () => {
    expect(normalizeUrl("https://a.com/page?a=1")).not.toBe(
      normalizeUrl("https://a.com/page?a=2"),
    );
  });

  it("treats a bare origin and a root slash as the same page", () => {
    expect(normalizeUrl("https://a.com")).toBe(normalizeUrl("https://a.com/"));
  });

  it("returns trimmed input for invalid urls", () => {
    expect(normalizeUrl("  not a url  ")).toBe("not a url");
  });
});
