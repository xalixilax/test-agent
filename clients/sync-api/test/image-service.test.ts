import { describe, expect, it } from "vitest";
import { ImageService } from "../src/application/image-service";
import { InMemoryBlobStore } from "./support/in-memory";

const serviceWith = () => {
  const blobs = new InMemoryBlobStore();
  return { service: new ImageService(blobs), blobs };
};

describe("ImageService", () => {
  it("stores uploaded screenshots under a generated key", async () => {
    const { service, blobs } = serviceWith();
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const result = await service.uploadImage("u1", bytes, "image/jpeg");

    expect(result.contentType).toBe("image/jpeg");
    expect(result.size).toBe(3);
    expect(blobs.objects.has(`images/u1/${result.key}`)).toBe(true);

    const served = await service.serve("u1", result.key);
    expect(served?.bytes.byteLength).toBe(3);
  });

  it("rejects non-image uploads", async () => {
    const { service } = serviceWith();
    await expect(service.uploadImage("u1", new ArrayBuffer(4), "text/html")).rejects.toThrow(
      "did not contain an image",
    );
  });

  it("rejects empty uploads", async () => {
    const { service } = serviceWith();
    await expect(service.uploadImage("u1", new ArrayBuffer(0), "image/png")).rejects.toThrow(
      "empty",
    );
  });

  it("rejects images over 5MB", async () => {
    const { service } = serviceWith();
    const big = new ArrayBuffer(5 * 1024 * 1024 + 1);
    await expect(service.uploadImage("u1", big, "image/png")).rejects.toThrow("larger than 5MB");
  });
});
