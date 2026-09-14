import { z } from "zod";

export const FIELD_NAMES = [
  "url",
  "title",
  "note",
  "rating",
  "tags",
  "screenshot_url",
  "image_key",
  "holders",
  "move",
  "device_name",
  "__deleted",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export interface VersionStamp {
  updatedAt: number;
  deviceId: string;
}

export const isNewer = (incoming: VersionStamp, existing: VersionStamp | null): boolean =>
  existing === null ||
  incoming.updatedAt > existing.updatedAt ||
  (incoming.updatedAt === existing.updatedAt && incoming.deviceId > existing.deviceId);

export const fieldEnvelopeSchema = z.object({
  uuid: z.string().min(1),
  field: z.enum(FIELD_NAMES),
  ciphertext: z.string(),
  updatedAt: z.number().int().nonnegative(),
  deviceId: z.string().min(1),
  deleted: z.boolean(),
});

export type FieldEnvelope = z.infer<typeof fieldEnvelopeSchema>;

export const remoteFieldSchema = fieldEnvelopeSchema.extend({
  seq: z.number().int().nonnegative(),
});

export type RemoteField = z.infer<typeof remoteFieldSchema>;

export const registerRequestSchema = z.object({
  inviteCode: z.string().min(1).max(256),
  salt: z.string().min(1).max(128),
  authHash: z.string().min(1).max(128),
  wrappedKey: z.string().min(1).max(512),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  authHash: z.string().min(1).max(128),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  wrappedKey: z.string().min(1),
  serverTime: z.number().int(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const authParamsResponseSchema = z.object({
  registered: z.boolean(),
  salt: z.string().nullable(),
});

export type AuthParamsResponse = z.infer<typeof authParamsResponseSchema>;

export const changePasswordRequestSchema = z.object({
  newSalt: z.string().min(1).max(128),
  newAuthHash: z.string().min(1).max(128),
  newWrappedKey: z.string().min(1).max(512),
});

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const syncPushRequestSchema = z.object({
  fields: z.array(fieldEnvelopeSchema).max(2000),
});

export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export const syncPushResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  serverTime: z.number().int(),
});

export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

export const syncPullResponseSchema = z.object({
  changes: z.array(remoteFieldSchema).max(5000),
  seq: z.number().int().nonnegative(),
  serverTime: z.number().int(),
});

export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;

export const UUID_PATTERN = /^[0-9a-f-]{8,64}$/u;

export const imageStoreResponseSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export type ImageStoreResponse = z.infer<typeof imageStoreResponseSchema>;

export const imageUploadQuerySchema = z.object({
  uuid: z.string().regex(UUID_PATTERN),
});

export const signImagesRequestSchema = z.object({
  items: z
    .array(
      z.object({
        uuid: z.string().regex(UUID_PATTERN),
        key: z.string().regex(/^[0-9a-f]{1,64}$/u),
      }),
    )
    .max(500),
});

export type SignImagesRequest = z.infer<typeof signImagesRequestSchema>;

export const signImagesResponseSchema = z.object({
  urls: z.array(
    z.object({
      uuid: z.string(),
      key: z.string(),
      url: z.string(),
    }),
  ),
});

export type SignImagesResponse = z.infer<typeof signImagesResponseSchema>;

export const IMAGE_URL_TTL_SECONDS = 60 * 60;

export const errorResponseSchema = z.object({
  error: z.string(),
});

export const okResponseSchema = z.object({
  ok: z.boolean(),
});

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
