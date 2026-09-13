export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  INVITE_CODE?: string;
  IMAGE_SIGNING_KEY?: string;
}
