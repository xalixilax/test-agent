import type { FieldEnvelope, RemoteField } from "sync-protocol";

export interface Account {
  salt: string;
  authHash: string;
  wrappedKey: string;
}

export interface AccountStore {
  get(): Promise<Account | null>;
  create(account: Account): Promise<void>;
  update(account: Account): Promise<void>;
}

export interface SessionStore {
  create(tokenHash: string, expiresAt: number, createdAt: number): Promise<void>;
  find(tokenHash: string, now: number): Promise<{ expiresAt: number } | null>;
  delete(tokenHash: string): Promise<void>;
  deleteExpired(now: number): Promise<void>;
}

export interface StoredField extends FieldEnvelope {}

export interface FieldStore {
  get(uuid: string, field: string): Promise<StoredField | null>;
  put(field: StoredField): Promise<void>;
  listSince(seq: number, limit: number): Promise<RemoteField[]>;
}

export interface BlobStore {
  put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null>;
  deletePrefix(prefix: string): Promise<void>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
