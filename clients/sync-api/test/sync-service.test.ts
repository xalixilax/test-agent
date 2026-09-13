import { describe, expect, it } from "vitest";
import type { FieldEnvelope } from "sync-protocol";
import { SyncService } from "../src/application/sync-service";
import { InMemoryBlobStore, InMemoryFieldStore } from "./support/in-memory";

const envelope = (overrides: Partial<FieldEnvelope> = {}): FieldEnvelope => ({
  uuid: "u1",
  field: "note",
  ciphertext: "cipher",
  updatedAt: 100,
  deviceId: "a",
  deleted: false,
  ...overrides,
});

const build = () => {
  const fields = new InMemoryFieldStore();
  const blobs = new InMemoryBlobStore();
  const sync = new SyncService(fields, blobs, () => 5_000);
  return { sync, fields, blobs };
};

describe("SyncService", () => {
  it("accepts newer writes and reports the cursor", async () => {
    const { sync, fields } = build();
    const result = await sync.push([
      envelope({ updatedAt: 100 }),
      envelope({ field: "rating", ciphertext: "4", updatedAt: 90 }),
    ]);
    expect(result).toEqual({ accepted: 2, serverTime: 5_000 });
    expect(fields.fields.size).toBe(2);

    const pull = await sync.pull(0);
    expect(pull.changes).toHaveLength(2);
    expect(pull.changes[0]).toMatchObject({ seq: 1, field: "note" });
    expect(pull.seq).toBe(2);
    await expect(sync.pull(2)).resolves.toMatchObject({ changes: [], seq: 2 });
  });

  it("rejects stale writes in favour of stored ones", async () => {
    const { sync, fields } = build();
    await sync.push([envelope({ updatedAt: 200, deviceId: "b" })]);
    const result = await sync.push([
      envelope({ updatedAt: 100, deviceId: "a" }),
      envelope({ updatedAt: 200, deviceId: "a" }),
    ]);
    expect(result.accepted).toBe(0);
    expect(fields.changes).toHaveLength(1);
  });

  it("breaks ties by device id", async () => {
    const { sync } = build();
    await sync.push([envelope({ updatedAt: 100, deviceId: "b" })]);
    const result = await sync.push([envelope({ updatedAt: 100, deviceId: "a" })]);
    expect(result.accepted).toBe(0);
  });

  it("deletes archived images when a record tombstone is accepted", async () => {
    const { sync, blobs } = build();
    await blobs.put("images/u1/abc", new ArrayBuffer(4), "image/png");
    await blobs.put("images/u2/def", new ArrayBuffer(4), "image/png");

    await sync.push([envelope({ field: "__deleted", deleted: true, updatedAt: 300 })]);

    expect(blobs.objects.has("images/u1/abc")).toBe(false);
    expect(blobs.objects.has("images/u2/def")).toBe(true);
  });

  it("deletes archived images when the image key is cleared", async () => {
    const { sync, blobs } = build();
    await blobs.put("images/u1/abc", new ArrayBuffer(4), "image/png");

    await sync.push([
      envelope({
        field: "image_key",
        ciphertext: "",
        deleted: true,
        updatedAt: 400,
      }),
    ]);

    expect(blobs.objects.has("images/u1/abc")).toBe(false);
  });
});
