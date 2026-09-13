import { MAX_IMAGE_BYTES } from "sync-protocol";
import { ApiError, type BlobStore } from "./ports";
import { sha256Hex } from "./auth-service";

const FETCH_TIMEOUT_MS = 15_000;

export class ImageService {
  constructor(
    private readonly blobs: BlobStore,
    private readonly fetchFn: typeof fetch = fetch.bind(globalThis),
  ) {}

  async fetchAndStore(
    uuid: string,
    url: string,
  ): Promise<{ key: string; contentType: string; size: number }> {
    const response = await this.fetchFn(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ApiError(400, `Image fetch failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!contentType.startsWith("image/")) {
      throw new ApiError(400, "URL did not return an image");
    }

    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_IMAGE_BYTES) {
      throw new ApiError(413, "Image is larger than 5MB");
    }

    const bytes = await readWithCap(response, MAX_IMAGE_BYTES);
    if (bytes.byteLength === 0) {
      throw new ApiError(400, "Image is empty");
    }

    const key = (await sha256Hex(url)).slice(0, 32);
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

const readWithCap = async (response: Response, cap: number): Promise<ArrayBuffer> => {
  if (!response.body) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > cap) throw new ApiError(413, "Image is larger than 5MB");
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > cap) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(413, "Image is larger than 5MB");
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
};
