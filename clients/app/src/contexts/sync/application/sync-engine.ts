import type { FieldEnvelope } from "sync-protocol";
import {
  PUSH_BATCH_SIZE,
  SYNC_CURSOR_KEY,
  type DecryptedChange,
  type DirtyField,
  type SyncEngineDeps,
  type SyncResult,
} from "./ports";

export class SyncEngine {
  constructor(private readonly deps: SyncEngineDeps) {}

  async syncNow(): Promise<SyncResult> {
    if (!(await this.deps.isEnabled())) {
      return { pushed: 0, pulled: 0, skipped: true, errors: 0 };
    }

    const pushed = await this.pushDirtyFields();
    const pulled = await this.pullRemoteChanges();
    return { pushed, pulled: pulled.applied, skipped: false, errors: pulled.errors };
  }

  private async pushDirtyFields(): Promise<number> {
    const { store, gateway, clock } = this.deps;
    const dirty = await store.listDirtyFields();
    if (dirty.length === 0) return 0;

    let pushed = 0;
    let rejected = 0;

    for (let i = 0; i < dirty.length; i += PUSH_BATCH_SIZE) {
      const batch = dirty.slice(i, i + PUSH_BATCH_SIZE);
      const envelopes = await this.toEnvelopes(batch);
      const response = await gateway.push(envelopes);
      clock.observeServerTime(response.serverTime);
      await store.markPushed(batch);
      pushed += response.accepted;
      rejected += envelopes.length - response.accepted;
    }

    // The server holds newer stamps for rejected fields. Rewinding the cursor
    // replays those rows so LWW reconciles the losing local values.
    if (rejected > 0) {
      await store.setSyncState(SYNC_CURSOR_KEY, "0");
    }
    return pushed;
  }

  private async toEnvelopes(fields: DirtyField[]): Promise<FieldEnvelope[]> {
    const envelopes: FieldEnvelope[] = [];
    for (const field of fields) {
      envelopes.push({
        uuid: field.uuid,
        field: field.field,
        ciphertext:
          field.deleted || field.value === null ? "" : await this.deps.cipher.encrypt(field.value),
        updatedAt: field.updatedAt,
        deviceId: field.deviceId,
        deleted: field.deleted,
      });
    }
    return envelopes;
  }

  private async pullRemoteChanges(): Promise<{
    applied: number;
    errors: number;
  }> {
    const { store, gateway, cipher, clock } = this.deps;
    const cursor = Number((await store.getSyncState(SYNC_CURSOR_KEY)) ?? "0");
    const pull = await gateway.pull(cursor);
    clock.observeServerTime(pull.serverTime);

    const changes: DecryptedChange[] = [];
    let errors = 0;
    for (const change of pull.changes) {
      try {
        changes.push({
          uuid: change.uuid,
          field: change.field,
          value:
            change.deleted || !change.ciphertext ? null : await cipher.decrypt(change.ciphertext),
          updatedAt: change.updatedAt,
          deviceId: change.deviceId,
          deleted: change.deleted,
          seq: change.seq,
        });
      } catch {
        errors += 1;
      }
    }

    if (changes.length > 0) {
      await store.applyRemoteChanges(changes);
    }
    await store.setSyncState(SYNC_CURSOR_KEY, String(pull.seq));

    return { applied: changes.length, errors };
  }
}
