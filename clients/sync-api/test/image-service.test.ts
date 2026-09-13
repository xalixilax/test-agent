import { describe, expect, it } from "vitest";
import { ImageService } from "../src/application/image-service";
import { InMemoryBlobStore } from "./support/in-memory";

const responseFor = (
  body: BodyInit | null,
  contentType = "image/png",
  status = 200,
): Response =>
  new Response(body, { status, headers: { "content-type": contentType } });

const serviceWith = (response: Response) => {
  const blobs = new InMemoryBlobStore();
  const service = new ImageService(blobs, async () => response);
  return { service, blobs };
};

describe("ImageService", () => {
  it("stores fetched images under a hashed key", async () => {
    const { service, blobs } = serviceWith(
      responseFor(new Uint8Array([1, 2, 3])),
    );
    const result = await service.fetchAndStore(
      "u1",
      "https://a.com/og.png",
    );
    expect(result.contentType).toBe("image/png");
    expect(result.size).toBe(3);
    expect(blobs.objects.has(`images/u1/${result.key}`)).toBe(true);

    const served = await service.serve("u1", result.key);
    expect(served?.bytes.byteLength).toBe(3);
  });

  it("rejects non-image responses", async () => {
    const { service } = serviceWith(
      responseFor("<html></html>", "text/html"),
    );
    await expect(
      service.fetchAndStore("u1", "https://a.com"),
    ).rejects.toThrow("did not return an image");
  });

  it("rejects failed fetches", async () => {
    const { service } = serviceWith(responseFor(null, "image/png", 404));
    await expect(
      service.fetchAndStore("u1", "https://a.com/missing.png"),
    ).rejects.toThrow("status 404");
  });

  it("rejects images over 5MB", async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    const { service } = serviceWith(responseFor(big));
    await expect(
      service.fetchAndStore("u1", "https://a.com/big.png"),
    ).rejects.toThrow("larger than 5MB");
  });
});
