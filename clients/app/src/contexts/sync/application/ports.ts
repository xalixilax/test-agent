import type { FieldEnvelope, FieldName, RemoteField } from "sync-protocol";
import type { MetadataRepository } from "@/contexts/metadata/domain/metadata-repository";

export interface DirtyField {
  uuid: string;
  field: FieldName;
  value: string | null;
  updatedAt: number;
  deviceId: string;
  deleted: boolean;
}

export interface DecryptedChange {
  uuid: string;
  field: FieldName;
  value: string | null;
  updatedAt: number;
  deviceId: string;
  deleted: boolean;
  seq: number;
}

export interface MetadataSyncStore {
  listDirtyFields(): Promise<DirtyField[]>;
  markPushed(fields: DirtyField[]): Promise<void>;
  applyRemoteChanges(changes: DecryptedChange[]): Promise<void>;
  getSyncState(key: string): Promise<string | null>;
  setSyncState(key: string, value: string): Promise<void>;
}

export interface SyncGateway {
  pull(since: number): Promise<{ changes: RemoteField[]; seq: number; serverTime: number }>;
  push(fields: FieldEnvelope[]): Promise<{ accepted: number; serverTime: number }>;
}

export interface FieldCipher {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

export interface Clock {
  now(): number;
  observeServerTime(serverTime: number): void;
}

export interface ImageGateway {
  uploadImage(input: {
    uuid: string;
    bytes: ArrayBuffer;
    contentType: string;
  }): Promise<{ key: string; contentType: string; size: number }>;
}

export interface SyncEngineDeps {
  store: MetadataSyncStore;
  gateway: SyncGateway;
  cipher: FieldCipher;
  clock: Clock;
  isEnabled(): Promise<boolean>;
}

export interface BookmarkSnapshot {
  id: string;
  url: string;
  title: string;
}

export interface BookmarkGateway {
  list(): Promise<BookmarkSnapshot[]>;
  findByUrl(url: string): Promise<BookmarkSnapshot[]>;
  create(input: { url: string; title: string }): Promise<BookmarkSnapshot>;
  remove(id: string): Promise<void>;
}

export interface MoveCoordinatorDeps {
  repository: MetadataRepository;
  bookmarks: BookmarkGateway;
  clock: Clock;
  onChange?: () => void;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  skipped: boolean;
  errors: number;
}

export const SYNC_CURSOR_KEY = "sync.cursor";
export const PUSH_BATCH_SIZE = 500;
