import type { FieldName } from "sync-protocol";

export interface LocalField {
  uuid: string;
  field: FieldName;
  value: string | null;
  updatedAt: number;
  deviceId: string;
  deleted: boolean;
  dirty: boolean;
}

export interface MetadataRecord {
  uuid: string;
  url: string;
  note?: string;
  rating?: number;
  tags: string[];
  screenshotUrl?: string;
  imageKey?: string;
  deleted: boolean;
  updatedAt: number;
}

export interface MetadataRecordView extends MetadataRecord {
  imageUrl?: string;
}

export const RATING_MIN = 0;
export const RATING_MAX = 5;

export const parseRating = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return undefined;
  }
  return rating;
};

export const serializeRating = (rating: number): string => {
  if (!Number.isFinite(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    throw new Error(`Rating must be between ${RATING_MIN} and ${RATING_MAX}`);
  }
  return String(rating);
};

export const parseTags = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const tags = parsed
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
    return [...new Set(tags)].sort();
  } catch {
    return [];
  }
};

export const serializeTags = (tags: string[]): string =>
  JSON.stringify(
    [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort(),
  );

const isRecordDeleted = (fields: LocalField[]): boolean => {
  const tombstone = fields.find(
    (field) => field.field === "__deleted" && field.deleted,
  );
  if (!tombstone) return false;
  return fields.every(
    (field) =>
      field.field === "__deleted" || field.updatedAt <= tombstone.updatedAt,
  );
};

export const recordUrl = (fields: LocalField[]): string | null =>
  fields.find((field) => field.field === "url")?.value ?? null;

export const assembleRecord = (fields: LocalField[]): MetadataRecord | null => {
  const url = recordUrl(fields);
  if (!url) return null;

  const record: MetadataRecord = {
    uuid: fields[0].uuid,
    url,
    tags: [],
    deleted: isRecordDeleted(fields),
    updatedAt: fields.reduce(
      (max, field) => Math.max(max, field.updatedAt),
      0,
    ),
  };

  for (const field of fields) {
    if (field.deleted) continue;
    switch (field.field) {
      case "note":
        record.note = field.value ?? undefined;
        break;
      case "rating":
        record.rating = parseRating(field.value);
        break;
      case "tags":
        record.tags = parseTags(field.value);
        break;
      case "screenshot_url":
        record.screenshotUrl = field.value ?? undefined;
        break;
      case "image_key":
        record.imageKey = field.value ?? undefined;
        break;
      default:
        break;
    }
  }

  return record;
};
