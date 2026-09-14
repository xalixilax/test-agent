import type { PGlite } from "@electric-sql/pglite";
import { type FieldName } from "sync-protocol";
import { assembleRecord, type LocalField, type MetadataRecord } from "../domain/metadata";
import { normalizeUrl } from "../domain/url";
import { stableUuid } from "../domain/uuid";
import type {
  BookmarkInventoryEntry,
  DeviceNameEntry,
  MetadataRepository,
  SetFieldByUrlInput,
} from "../domain/metadata-repository";
import type {
  DecryptedChange,
  DirtyField,
  MetadataSyncStore,
} from "@/contexts/sync/application/ports";

const DEVICE_ID_KEY = "device.id";
const LEGACY_MIGRATED_KEY = "legacy.migrated";

interface FieldRow {
  uuid: string;
  field: FieldName;
  value: string | null;
  updated_at: number | string;
  device_id: string;
  deleted: number;
  dirty: number;
}

const toLocalField = (row: FieldRow): LocalField => ({
  uuid: row.uuid,
  field: row.field,
  value: row.value,
  updatedAt: Number(row.updated_at),
  deviceId: row.device_id,
  deleted: Number(row.deleted) === 1,
  dirty: Number(row.dirty) === 1,
});

const FIELD_COLUMNS = "uuid, field, value, updated_at, device_id, deleted, dirty";

export class PgliteMetadataRepository implements MetadataRepository, MetadataSyncStore {
  constructor(private readonly db: PGlite) {}

  async getDeviceId(): Promise<string> {
    const existing = await this.getSyncState(DEVICE_ID_KEY);
    if (existing) return existing;
    const deviceId = crypto.randomUUID();
    await this.setSyncState(DEVICE_ID_KEY, deviceId);
    return deviceId;
  }

  async listRecords(): Promise<MetadataRecord[]> {
    const result = await this.db.query<FieldRow>(
      `SELECT ${FIELD_COLUMNS} FROM metadata_fields ORDER BY uuid, field`,
    );
    const byUuid = new Map<string, LocalField[]>();
    for (const row of result.rows) {
      const field = toLocalField(row);
      const fields = byUuid.get(row.uuid) ?? [];
      fields.push(field);
      byUuid.set(row.uuid, fields);
    }

    const records: MetadataRecord[] = [];
    for (const fields of byUuid.values()) {
      const record = assembleRecord(fields);
      if (record && !record.deleted) records.push(record);
    }
    return records;
  }

  async findByUrl(url: string): Promise<MetadataRecord | null> {
    const record = await this.loadRecord(await stableUuid(normalizeUrl(url)));
    return record && !record.deleted ? record : null;
  }

  private async loadRecord(uuid: string): Promise<MetadataRecord | null> {
    const result = await this.db.query<FieldRow>(
      `SELECT ${FIELD_COLUMNS} FROM metadata_fields WHERE uuid = $1`,
      [uuid],
    );
    if (result.rows.length === 0) return null;
    return assembleRecord(result.rows.map(toLocalField));
  }

  async setFieldByUrl(input: SetFieldByUrlInput): Promise<void> {
    const normalized = normalizeUrl(input.url);
    const uuid = await stableUuid(normalized);

    await this.db.query(
      `INSERT INTO metadata_records (uuid, url, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (uuid) DO NOTHING`,
      [uuid, normalized, Date.now()],
    );

    await this.ensureUrlField(uuid, normalized, input.updatedAt, input.deviceId);
    await this.upsertField(
      uuid,
      input.field,
      input.value,
      input.updatedAt,
      input.deviceId,
      input.value === null,
      true,
    );
  }

  // Ensures the record's identity field exists so records can be assembled.
  // A deleted url field is resurrected when new local metadata arrives.
  private async ensureUrlField(
    uuid: string,
    url: string,
    updatedAt: number,
    deviceId: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO metadata_fields (uuid, field, value, updated_at, device_id, deleted, dirty)
       VALUES ($1, 'url', $2, $3, $4, 0, 1)
       ON CONFLICT (uuid, field) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at,
         device_id = EXCLUDED.device_id,
         deleted = 0,
         dirty = 1
       WHERE metadata_fields.deleted = 1`,
      [uuid, url, updatedAt, deviceId],
    );
  }

  async purgeByUrl(url: string, updatedAt: number, deviceId: string): Promise<void> {
    const uuid = await stableUuid(normalizeUrl(url));
    await this.db.query("UPDATE metadata_records SET deleted = 1 WHERE uuid = $1", [uuid]);
    await this.upsertField(uuid, "__deleted", "1", updatedAt, deviceId, true, true);
  }

  private async upsertField(
    uuid: string,
    field: FieldName,
    value: string | null,
    updatedAt: number,
    deviceId: string,
    deleted: boolean,
    dirty: boolean,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO metadata_fields (uuid, field, value, updated_at, device_id, deleted, dirty)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (uuid, field) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at,
         device_id = EXCLUDED.device_id,
         deleted = EXCLUDED.deleted,
         dirty = EXCLUDED.dirty`,
      [uuid, field, value, updatedAt, deviceId, deleted ? 1 : 0, dirty ? 1 : 0],
    );
  }

  async listDirtyFields(): Promise<DirtyField[]> {
    const result = await this.db.query<FieldRow>(
      `SELECT ${FIELD_COLUMNS} FROM metadata_fields WHERE dirty = 1`,
    );
    return result.rows.map((row) => ({
      uuid: row.uuid,
      field: row.field,
      value: row.value,
      updatedAt: Number(row.updated_at),
      deviceId: row.device_id,
      deleted: Number(row.deleted) === 1,
    }));
  }

  async countDirtyFields(): Promise<number> {
    const result = await this.db.query<{ count: number | string }>(
      "SELECT COUNT(*) AS count FROM metadata_fields WHERE dirty = 1",
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async markPushed(fields: DirtyField[]): Promise<void> {
    // Version-conditional so edits made while a push was in flight stay dirty.
    for (const field of fields) {
      await this.db.query(
        `UPDATE metadata_fields SET dirty = 0
         WHERE uuid = $1 AND field = $2 AND updated_at = $3 AND device_id = $4`,
        [field.uuid, field.field, field.updatedAt, field.deviceId],
      );
    }
  }

  async applyRemoteChanges(changes: DecryptedChange[]): Promise<void> {
    for (const change of changes) {
      const applied = await this.upsertRemoteField(change);
      if (!applied || change.field !== "url" || !change.value) continue;

      const normalized = normalizeUrl(change.value);
      await this.db.query(
        `INSERT INTO metadata_records (uuid, url, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (uuid) DO UPDATE SET url = EXCLUDED.url, deleted = 0`,
        [change.uuid, normalized, Date.now()],
      );
    }
  }

  // LWW predicate lives inside the upsert so a stale remote row can never
  // clobber a newer local edit between the read and the write.
  private async upsertRemoteField(change: DecryptedChange): Promise<boolean> {
    const result = await this.db.query<{ uuid: string }>(
      `INSERT INTO metadata_fields (uuid, field, value, updated_at, device_id, deleted, dirty)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       ON CONFLICT (uuid, field) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = EXCLUDED.updated_at,
         device_id = EXCLUDED.device_id,
         deleted = EXCLUDED.deleted,
         dirty = 0
       WHERE EXCLUDED.updated_at > metadata_fields.updated_at
          OR (EXCLUDED.updated_at = metadata_fields.updated_at
              AND EXCLUDED.device_id > metadata_fields.device_id)
       RETURNING uuid`,
      [
        change.uuid,
        change.field,
        change.value,
        change.updatedAt,
        change.deviceId,
        change.deleted ? 1 : 0,
      ],
    );
    return result.rows.length > 0;
  }

  async listBookmarkInventory(): Promise<BookmarkInventoryEntry[]> {
    const result = await this.db.query<{ chrome_id: string; url: string; title: string }>(
      "SELECT chrome_id, url, title FROM bookmark_inventory",
    );
    return result.rows.map((row) => ({
      chromeId: row.chrome_id,
      url: row.url,
      title: row.title,
    }));
  }

  async upsertBookmarkInventory(entry: BookmarkInventoryEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO bookmark_inventory (chrome_id, url, title)
       VALUES ($1, $2, $3)
       ON CONFLICT (chrome_id) DO UPDATE SET url = EXCLUDED.url, title = EXCLUDED.title`,
      [entry.chromeId, entry.url, entry.title],
    );
  }

  async deleteBookmarkInventory(chromeIds: string[]): Promise<void> {
    for (const chromeId of chromeIds) {
      await this.db.query("DELETE FROM bookmark_inventory WHERE chrome_id = $1", [chromeId]);
    }
  }

  async listDeviceNames(): Promise<DeviceNameEntry[]> {
    const result = await this.db.query<{ uuid: string; value: string | null }>(
      `SELECT uuid, value FROM metadata_fields
       WHERE field = 'device_name' AND deleted = 0 AND value IS NOT NULL`,
    );
    return result.rows
      .filter((row): row is { uuid: string; value: string } => row.value !== null)
      .map((row) => ({ deviceId: row.uuid, name: row.value }));
  }

  async setDeviceName(name: string, updatedAt: number): Promise<void> {
    const deviceId = await this.getDeviceId();
    await this.upsertField(deviceId, "device_name", name, updatedAt, deviceId, false, true);
  }

  async getSyncState(key: string): Promise<string | null> {
    const result = await this.db.query<{ value: string }>(
      "SELECT value FROM sync_state WHERE key = $1",
      [key],
    );
    return result.rows[0]?.value ?? null;
  }

  async setSyncState(key: string, value: string): Promise<void> {
    await this.db.query(
      `INSERT INTO sync_state (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
  }

  async wasLegacyMigrated(): Promise<boolean> {
    return (await this.getSyncState(LEGACY_MIGRATED_KEY)) === "1";
  }

  async markLegacyMigrated(): Promise<void> {
    await this.setSyncState(LEGACY_MIGRATED_KEY, "1");
  }
}
