import { describe, expect, it } from "vitest";
import type { FieldEnvelope, RemoteField } from "sync-protocol";
import { SyncEngine } from "./sync-engine";
import {
  PUSH_BATCH_SIZE,
  SYNC_CURSOR_KEY,
  type Clock,
  type DecryptedChange,
  type DirtyField,
  type MetadataSyncStore,
  type SyncGateway,
} from "./ports";

class InMemoryStore implements MetadataSyncStore {
  dirty: DirtyField[] = [];
  remoteChanges: DecryptedChange[] = [];
  state = new Map<string, string>();
  pushed: DirtyField[] = [];

  async listDirtyFields() {
    return this.dirty;
  }

  async markPushed(fields: DirtyField[]) {
    this.pushed.push(...fields);
    this.dirty = this.dirty.filter(
      (field) =>
        !fields.some(
          (pushed) =>
            pushed.uuid === field.uuid &&
            pushed.field === field.field &&
            pushed.updatedAt === field.updatedAt &&
            pushed.deviceId === field.deviceId,
        ),
    );
  }

  async applyRemoteChanges(changes: DecryptedChange[]) {
    this.remoteChanges.push(...changes);
  }

  async getSyncState(key: string) {
    return this.state.get(key) ?? null;
  }

  async setSyncState(key: string, value: string) {
    this.state.set(key, value);
  }
}

class FakeGateway implements SyncGateway {
  pushedBatches: FieldEnvelope[][] = [];
  acceptedPerBatch: number[] = [];
  pullSince: number[] = [];
  pullResult: {
    changes: RemoteField[];
    seq: number;
    serverTime: number;
  } = { changes: [], seq: 0, serverTime: 0 };

  async push(fields: FieldEnvelope[]) {
    this.pushedBatches.push(fields);
    const accepted =
      this.acceptedPerBatch[this.pushedBatches.length - 1] ?? fields.length;
    return { accepted, serverTime: 1_000 };
  }

  async pull(since: number) {
    this.pullSince.push(since);
    return this.pullResult;
  }
}

const cipher = {
  encrypt: async (value: string) => `enc:${value}`,
  decrypt: async (value: string) => {
    if (value.startsWith("bad")) throw new Error("cannot decrypt");
    return value.replace(/^enc:/u, "");
  },
};

const clock: Clock = {
  now: () => 123,
  observeServerTime: () => undefined,
};

const dirtyUrl: DirtyField = {
  uuid: "u1",
  field: "url",
  value: "https://a.com/",
  updatedAt: 100,
  deviceId: "device-a",
  deleted: false,
};

const dirtyTombstone: DirtyField = {
  uuid: "u1",
  field: "__deleted",
  value: null,
  updatedAt: 200,
  deviceId: "device-a",
  deleted: true,
};

describe("SyncEngine", () => {
  it("skips everything when sync is disabled", async () => {
    const store = new InMemoryStore();
    const gateway = new FakeGateway();
    const engine = new SyncEngine({
      store,
      gateway,
      cipher,
      clock,
      isEnabled: async () => false,
    });
    await expect(engine.syncNow()).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      skipped: true,
      errors: 0,
    });
    expect(gateway.pushedBatches).toHaveLength(0);
  });

  it("pushes encrypted dirty fields before pulling", async () => {
    const store = new InMemoryStore();
    store.dirty = [dirtyUrl, dirtyTombstone];
    const gateway = new FakeGateway();
    gateway.pullResult = {
      changes: [
        {
          uuid: "u2",
          field: "note",
          ciphertext: "enc:remote note",
          updatedAt: 300,
          deviceId: "device-b",
          deleted: false,
          seq: 7,
        },
      ],
      seq: 7,
      serverTime: 2_000,
    };

    const engine = new SyncEngine({
      store,
      gateway,
      cipher,
      clock,
      isEnabled: async () => true,
    });
    const result = await engine.syncNow();

    expect(gateway.pushedBatches[0]).toEqual([
      {
        uuid: "u1",
        field: "url",
        ciphertext: "enc:https://a.com/",
        updatedAt: 100,
        deviceId: "device-a",
        deleted: false,
      },
      {
        uuid: "u1",
        field: "__deleted",
        ciphertext: "",
        updatedAt: 200,
        deviceId: "device-a",
        deleted: true,
      },
    ]);
    expect(store.pushed).toHaveLength(2);
    expect(store.remoteChanges).toEqual([
      {
        uuid: "u2",
        field: "note",
        value: "remote note",
        updatedAt: 300,
        deviceId: "device-b",
        deleted: false,
        seq: 7,
      },
    ]);
    expect(await store.getSyncState(SYNC_CURSOR_KEY)).toBe("7");
    expect(result).toEqual({
      pushed: 2,
      pulled: 1,
      skipped: false,
      errors: 0,
    });
  });

  it("does not push when there is nothing dirty", async () => {
    const store = new InMemoryStore();
    const gateway = new FakeGateway();
    const engine = new SyncEngine({
      store,
      gateway,
      cipher,
      clock,
      isEnabled: async () => true,
    });
    await engine.syncNow();
    expect(gateway.pushedBatches).toHaveLength(0);
  });

  it("chunks large dirty sets into multiple pushes", async () => {
    const store = new InMemoryStore();
    store.dirty = Array.from(
      { length: PUSH_BATCH_SIZE + 1 },
      (_, index): DirtyField => ({
        uuid: `u${index}`,
        field: "note",
        value: `note ${index}`,
        updatedAt: index,
        deviceId: "device-a",
        deleted: false,
      }),
    );
    const gateway = new FakeGateway();
    const engine = new SyncEngine({
      store,
      gateway,
      cipher,
      clock,
      isEnabled: async () => true,
    });
    const result = await engine.syncNow();
    expect(gateway.pushedBatches).toHaveLength(2);
    expect(gateway.pushedBatches[1]).toHaveLength(1);
    expect(result.pushed).toBe(PUSH_BATCH_SIZE + 1);
  });

  it("rewinds the cursor and re-pulls when the server rejects writes", async () => {
    const store = new InMemoryStore();
    store.dirty = [dirtyUrl];
    store.state.set(SYNC_CURSOR_KEY, "42");

    const gateway = new FakeGateway();
    gateway.acceptedPerBatch = [0];
    gateway.pullResult = { changes: [], seq: 50, serverTime: 3_000 };

    const engine = new SyncEngine({
      store,
      gateway,
      cipher,
      clock,
      isEnabled: async () => true,
    });
    await engine.syncNow();

    expect(gateway.pullSince).toEqual([0]);
    expect(await store.getSyncState(SYNC_CURSOR_KEY)).toBe("50");
  });

  it("counts undecryptable changes, skips them and still advances the cursor", async () => {
    const store = new InMemoryStore();
    const gateway = new FakeGateway();
    gateway.pullResult = {
      changes: [
        {
          uuid: "u1",
          field: "note",
          ciphertext: "bad-ciphertext",
          updatedAt: 1,
          deviceId: "device-b",
          deleted: false,
          seq: 3,
        },
        {
          uuid: "u2",
          field: "note",
          ciphertext: "enc:ok",
          updatedAt: 2,
          deviceId: "device-b",
          deleted: false,
          seq: 4,
        },
      ],
      seq: 4,
      serverTime: 1_000,
    };

    const engine = new SyncEngine({
      store,
      gateway,
      cipher,
      clock,
      isEnabled: async () => true,
    });
    const result = await engine.syncNow();

    expect(result.errors).toBe(1);
    expect(result.pulled).toBe(1);
    expect(await store.getSyncState(SYNC_CURSOR_KEY)).toBe("4");
    expect(store.remoteChanges).toHaveLength(1);
  });
});
