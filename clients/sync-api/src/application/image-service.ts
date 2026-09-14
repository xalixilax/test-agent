import { MAX_IMAGE_BYTES } from "sync-protocol";
import { ApiError, type BlobStore } from "./ports";

export class ImageService {
  constructor(private readonly blobs: BlobStore) {}

  // fallow-ignore-next-line unused-class-member -- called from routes/images.ts through the injected services object
  async uploadImage(
    uuid: string,
    bytes: ArrayBuffer,
    contentType: string,
  ): Promise<{ key: string; contentType: string; size: number }> {
    if (!contentType.startsWith("image/")) {
      throw new ApiError(400, "Upload did not contain an image");
    }
    if (bytes.byteLength === 0) {
      throw new ApiError(400, "Image is empty");
    }
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ApiError(413, "Image is larger than 5MB");
    }

    const key = crypto.randomUUID().replaceAll("-", "");
    await this.blobs.put(`images/${uuid}/${key}`, bytes, contentType);
    return { key, contentType, size: bytes.byteLength };
  }

  async serve(
    uuid: string,
    key: string,
  ): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
    return this.blobs.get(`images/${uuid}/${key}`);
  }
}
