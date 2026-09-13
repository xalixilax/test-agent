import type { RemoteField } from "sync-protocol";
import type {
  Account,
  AccountStore,
  BlobStore,
  FieldStore,
  SessionStore,
  StoredField,
} from "../../src/application/ports";

export class InMemoryAccountStore implements AccountStore {
  account: Account | null = null;

  async get() {
    return this.account;
  }

  async create(account: Account) {
    if (this.account) throw new Error("already exists");
    this.account = account;
  }

  async update(account: Account) {
    this.account = account;
  }
}

export class InMemorySessionStore implements SessionStore {
  sessions = new Map<string, { expiresAt: number; createdAt: number }>();

  async create(tokenHash: string, expiresAt: number, createdAt: number) {
    this.sessions.set(tokenHash, { expiresAt, createdAt });
  }

  async find(tokenHash: string, now: number) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return null;
    return { expiresAt: session.expiresAt };
  }

  async delete(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async deleteExpired(now: number) {
    for (const [tokenHash, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(tokenHash);
    }
  }
}

const keyOf = (uuid: string, field: string) => `${uuid}|${field}`;

export class InMemoryFieldStore implements FieldStore {
  fields = new Map<string, StoredField>();
  changes: RemoteField[] = [];
  private seq = 0;

  async get(uuid: string, field: string) {
    return this.fields.get(keyOf(uuid, field)) ?? null;
  }

  async put(field: StoredField) {
    this.fields.set(keyOf(field.uuid, field.field), field);
    this.seq += 1;
    this.changes.push({ ...field, seq: this.seq });
  }

  async listSince(since: number, limit: number) {
    return this.changes
      .filter((change) => change.seq > since)
      .slice(0, limit);
  }
}

export class InMemoryBlobStore implements BlobStore {
  objects = new Map<string, { bytes: ArrayBuffer; contentType: string }>();

  async put(key: string, bytes: ArrayBuffer, contentType: string) {
    this.objects.set(key, { bytes, contentType });
  }

  async get(key: string) {
    return this.objects.get(key) ?? null;
  }

  async deletePrefix(prefix: string) {
    for (const key of [...this.objects.keys()]) {
      if (key.startsWith(prefix)) this.objects.delete(key);
    }
  }
}
