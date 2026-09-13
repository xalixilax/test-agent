import type { RemoteField } from "sync-protocol";
import type {
  Account,
  AccountStore,
  FieldStore,
  SessionStore,
  StoredField,
} from "../application/ports";

interface AccountRow {
  salt: string;
  auth_hash: string;
  wrapped_key: string;
}

export class D1AccountStore implements AccountStore {
  constructor(private readonly db: D1Database) {}

  async get(): Promise<Account | null> {
    const row = await this.db
      .prepare("SELECT salt, auth_hash, wrapped_key FROM accounts WHERE id = 1")
      .first<AccountRow>();
    return row
      ? {
          salt: row.salt,
          authHash: row.auth_hash,
          wrappedKey: row.wrapped_key,
        }
      : null;
  }

  async create(account: Account): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO accounts (id, salt, auth_hash, wrapped_key, created_at)
         VALUES (1, ?, ?, ?, ?)`,
      )
      .bind(account.salt, account.authHash, account.wrappedKey, Date.now())
      .run();
  }

  async update(account: Account): Promise<void> {
    await this.db
      .prepare("UPDATE accounts SET salt = ?, auth_hash = ?, wrapped_key = ? WHERE id = 1")
      .bind(account.salt, account.authHash, account.wrappedKey)
      .run();
  }
}

export class D1SessionStore implements SessionStore {
  constructor(private readonly db: D1Database) {}

  async create(tokenHash: string, expiresAt: number, createdAt: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)")
      .bind(tokenHash, createdAt, expiresAt)
      .run();
  }

  async find(tokenHash: string, now: number): Promise<{ expiresAt: number } | null> {
    const row = await this.db
      .prepare("SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?")
      .bind(tokenHash, now)
      .first<{ expires_at: number }>();
    return row ? { expiresAt: row.expires_at } : null;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }

  async deleteExpired(now: number): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
  }
}

interface FieldRow {
  uuid: string;
  field: string;
  ciphertext: string;
  updated_at: number;
  device_id: string;
  deleted: number;
}

const toStoredField = (row: FieldRow): StoredField => ({
  uuid: row.uuid,
  field: row.field as StoredField["field"],
  ciphertext: row.ciphertext,
  updatedAt: row.updated_at,
  deviceId: row.device_id,
  deleted: row.deleted === 1,
});

export class D1FieldStore implements FieldStore {
  constructor(private readonly db: D1Database) {}

  async get(uuid: string, field: string): Promise<StoredField | null> {
    const row = await this.db
      .prepare(
        `SELECT uuid, field, ciphertext, updated_at, device_id, deleted
         FROM fields WHERE uuid = ? AND field = ?`,
      )
      .bind(uuid, field)
      .first<FieldRow>();
    return row ? toStoredField(row) : null;
  }

  async put(field: StoredField): Promise<void> {
    // ponytail: `changes` grows forever and is replayed by fresh devices.
    // Add pruning with a min-cursor table if it ever gets big.
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO fields (uuid, field, ciphertext, updated_at, device_id, deleted)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (uuid, field) DO UPDATE SET
             ciphertext = excluded.ciphertext,
             updated_at = excluded.updated_at,
             device_id = excluded.device_id,
             deleted = excluded.deleted`,
        )
        .bind(
          field.uuid,
          field.field,
          field.ciphertext,
          field.updatedAt,
          field.deviceId,
          field.deleted ? 1 : 0,
        ),
      this.db
        .prepare(
          `INSERT INTO changes (uuid, field, ciphertext, updated_at, device_id, deleted)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          field.uuid,
          field.field,
          field.ciphertext,
          field.updatedAt,
          field.deviceId,
          field.deleted ? 1 : 0,
        ),
    ]);
  }

  async listSince(seq: number, limit: number): Promise<RemoteField[]> {
    const rows = await this.db
      .prepare(
        `SELECT id, uuid, field, ciphertext, updated_at, device_id, deleted
         FROM changes WHERE id > ? ORDER BY id LIMIT ?`,
      )
      .bind(seq, limit)
      .all<FieldRow & { id: number }>();

    return rows.results.map((row) => ({
      seq: row.id,
      uuid: row.uuid,
      field: row.field as RemoteField["field"],
      ciphertext: row.ciphertext,
      updatedAt: row.updated_at,
      deviceId: row.device_id,
      deleted: row.deleted === 1,
    }));
  }
}
