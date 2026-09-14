import { describe, expect, it } from "vitest";
import { detectDeviceName } from "./device-name";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

describe("detectDeviceName", () => {
  it("detects Edge and the platform", () => {
    expect(detectDeviceName({ userAgent: EDGE_WINDOWS })).toBe("Edge (Windows)");
  });

  it("detects Brave even though its user agent looks like Chrome", () => {
    expect(detectDeviceName({ userAgent: CHROME_MAC, brave: true })).toBe("Brave (macOS)");
  });

  it("falls back to the Chromium brand", () => {
    expect(detectDeviceName({ userAgent: CHROME_MAC })).toBe("Chrome (macOS)");
    expect(detectDeviceName({ userAgent: "unknown" })).toBe("Chrome");
  });
});
