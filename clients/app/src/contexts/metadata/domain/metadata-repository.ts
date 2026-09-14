import type { FieldName } from "sync-protocol";
import type { MetadataRecord } from "./metadata";

export interface SetFieldByUrlInput {
  url: string;
  field: FieldName;
  value: string | null;
  updatedAt: number;
  deviceId: string;
}

export interface BookmarkInventoryEntry {
  chromeId: string;
  url: string;
  title: string;
}

export interface DeviceNameEntry {
  deviceId: string;
  name: string;
}

export interface MetadataRepository {
  getDeviceId(): Promise<string>;
  listRecords(): Promise<MetadataRecord[]>;
  findByUrl(url: string): Promise<MetadataRecord | null>;
  setFieldByUrl(input: SetFieldByUrlInput): Promise<void>;
  purgeByUrl(url: string, updatedAt: number, deviceId: string): Promise<void>;
  listBookmarkInventory(): Promise<BookmarkInventoryEntry[]>;
  upsertBookmarkInventory(entry: BookmarkInventoryEntry): Promise<void>;
  deleteBookmarkInventory(chromeIds: string[]): Promise<void>;
  listDeviceNames(): Promise<DeviceNameEntry[]>;
  setDeviceName(name: string, updatedAt: number): Promise<void>;
}
