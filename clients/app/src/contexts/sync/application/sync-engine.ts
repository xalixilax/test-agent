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
    const { store, gateway, cipher, clock } = this.deps;
    if (!(await this.deps.isEnabled())) {
      return { pushed: 0, pulled: 0, skipped: true, errors: 0 };
    }

    const dirty = await store.listDirtyFields();
    let pushed = 0;

    if (dirty.length > 0) {
      let rejected = 0;
      for (let i = 0; i < dirty.length; i += PUSH_BATCH_SIZE) {
        const batch = dirty.slice(i, i + PUSH_BATCH_SIZE);
        const envelopes: FieldEnvelope[] = [];
        for (const field of batch) {
          envelopes.push({
            uuid: field.uuid,
            field: field.field,
            ciphertext:
              field.deleted || field.value === null
                ? ""
                : await cipher.encrypt(field.value),
            updatedAt: field.updatedAt,
            deviceId: field.deviceId,
            deleted: field.deleted,
          });
        }

        const response = await gateway.push(envelopes);
        clock.observeServerTime(response.serverTime);
        await store.markPushed(batch);
        pushed += response.accepted;
        rejected += envelopes.length - response.accepted;
      }

      // The server holds newer stamps for rejected fields. Rewinding the
      // cursor replays those rows so LWW reconciles the losing local values.
      if (rejected > 0) {
        await store.setSyncState(SYNC_CURSOR_KEY, "0");
      }
    }

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
            change.deleted || !change.ciphertext
              ? null
              : await cipher.decrypt(change.ciphertext),
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

    return { pushed, pulled: changes.length, skipped: false, errors };
  }
}
