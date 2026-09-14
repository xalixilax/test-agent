# sync-api

Cloudflare Worker that stores encrypted bookmark metadata (D1) and archived
Open Graph images (R2) for the Bookmark Manager extension.

## One-time setup

```bash
pnpm --filter sync-api exec wrangler login
pnpm --filter sync-api exec wrangler d1 create bookmark-sync
# paste the printed database_id into wrangler.jsonc
pnpm --filter sync-api exec wrangler r2 bucket create bookmark-sync-images
pnpm --filter sync-api exec wrangler d1 migrations apply bookmark-sync --remote
pnpm --filter sync-api exec wrangler secret put INVITE_CODE
pnpm --filter sync-api exec wrangler secret put IMAGE_SIGNING_KEY
pnpm --filter sync-api deploy
```

Then set the deployed URL in `clients/app/src/shared/config.ts`
(`SYNC_API_URL`) and rebuild the extension.

## Local development

Create `clients/sync-api/.dev.vars`:

```
INVITE_CODE=dev-invite
IMAGE_SIGNING_KEY=dev-signing-key
```

Then:

```bash
pnpm --filter sync-api exec wrangler d1 migrations apply bookmark-sync --local
pnpm --filter sync-api dev
```

## Model

- One account per deployment; registration needs `INVITE_CODE`.
- The password never leaves the extension: it derives an auth verifier and a
  key-encryption key locally. The server only stores the verifier, the salt and
  the wrapped data key, and only ever sees per-field ciphertext.
- Per-field last-write-wins is enforced server-side on plaintext
  `(updated_at, device_id)` stamps without decrypting payloads.
- `POST /sync` tombstones (`field = "__deleted"`) also purge that record's R2
  objects.
- Images: a site's Open Graph image is stored as a plain link in the record
  (`screenshot_url`), so it is served by the site itself. When a page has no
  OG image, the extension captures a page screenshot, uploads the bytes, and
  stores the R2 key (`image_key`); the Worker serves it back through the
  authenticated `/images/:uuid/:key` route with signed URLs.
  Screenshots are not end-to-end encrypted, but the bucket is private.
