export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  AUTH_RATE_LIMITER?: RateLimit;
  INVITE_CODE?: string;
  IMAGE_SIGNING_KEY?: string;
}
