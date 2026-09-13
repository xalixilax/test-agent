import type { BlobStore } from "../application/ports";

export class R2BlobStore implements BlobStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType },
    });
  }

  async get(key: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      bytes: await object.arrayBuffer(),
      contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }

  async deletePrefix(prefix: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const listing = await this.bucket.list({ prefix, cursor });
      if (listing.objects.length > 0) {
        await this.bucket.delete(listing.objects.map((object) => object.key));
      }
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);
  }
}
