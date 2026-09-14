import { describe, expect, it } from "vitest";
import { dataUrlToBytes } from "./og-image-discovery";

describe("dataUrlToBytes", () => {
  it("decodes an image data URL", () => {
    const decoded = dataUrlToBytes("data:image/jpeg;base64,AQID");
    expect(decoded?.contentType).toBe("image/jpeg");
    expect(new Uint8Array(decoded!.bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects anything that is not an image data URL", () => {
    expect(dataUrlToBytes("data:text/html;base64,PGh0bWw+")).toBeNull();
    expect(dataUrlToBytes("not-a-data-url")).toBeNull();
  });
});
