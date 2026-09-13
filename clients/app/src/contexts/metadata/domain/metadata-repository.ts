import type { FieldName } from "sync-protocol";
import type { MetadataRecord } from "./metadata";

export interface SetFieldByUrlInput {
  url: string;
  field: FieldName;
  value: string | null;
  updatedAt: number;
  deviceId: string;
}

export interface MetadataRepository {
  getDeviceId(): Promise<string>;
  listRecords(): Promise<MetadataRecord[]>;
  findByUrl(url: string): Promise<MetadataRecord | null>;
  setFieldByUrl(input: SetFieldByUrlInput): Promise<void>;
  purgeByUrl(url: string, updatedAt: number, deviceId: string): Promise<void>;
}
