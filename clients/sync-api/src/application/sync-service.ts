import { isNewer, type FieldEnvelope, type RemoteField } from "sync-protocol";
import { ApiError, type BlobStore, type FieldStore } from "./ports";

export class SyncService {
  constructor(
    private readonly fields: FieldStore,
    private readonly blobs: BlobStore,
    private readonly now: () => number = Date.now,
  ) {}

  async pull(
    since: number,
  ): Promise<{ changes: RemoteField[]; seq: number; serverTime: number }> {
    const changes = await this.fields.listSince(since, 5000);
    const seq = changes.length > 0 ? changes[changes.length - 1].seq : since;
    return { changes, seq, serverTime: this.now() };
  }

  async push(envelopes: FieldEnvelope[]): Promise<{
    accepted: number;
    serverTime: number;
  }> {
    if (envelopes.length > 2000) {
      throw new ApiError(400, "Too many fields in one push");
    }

    let accepted = 0;
    for (const incoming of envelopes) {
      const existing = await this.fields.get(incoming.uuid, incoming.field);
      if (
        existing &&
        !isNewer(incoming, {
          updatedAt: existing.updatedAt,
          deviceId: existing.deviceId,
        })
      ) {
        continue;
      }
      await this.fields.put(incoming);
      accepted += 1;

      const purgesImages =
        (incoming.field === "__deleted" || incoming.field === "image_key") &&
        incoming.deleted;
      if (purgesImages) {
        await this.blobs.deletePrefix(`images/${incoming.uuid}/`);
      }
    }

    return { accepted, serverTime: this.now() };
  }
}
