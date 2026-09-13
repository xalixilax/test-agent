import type { PGlite } from "@electric-sql/pglite";
import type { MetadataService } from "../application/metadata-service";
import type { PgliteMetadataRepository } from "./pglite-metadata-repository";

interface LegacyScreenshot {
  dataUrl: string;
  timestamp: number;
  url: string;
}

export interface LegacyMigrationDeps {
  db: PGlite;
  repository: PgliteMetadataRepository;
  metadata: MetadataService;
  resolveBookmarkUrl(chromeBookmarkId: string): Promise<string | null>;
}

const isDataUrl = (url: string): boolean => url.startsWith("data:");

export const migrateLegacyMetadata = async ({
  db,
  repository,
  metadata,
  resolveBookmarkUrl,
}: LegacyMigrationDeps): Promise<boolean> => {
  if (await repository.wasLegacyMigrated()) return false;

  let migrated = 0;

  const tableCheck = await db.query<{ reg: string | null }>(
    "SELECT to_regclass('public.bookmarks') AS reg",
  );

  if (tableCheck.rows[0]?.reg) {
    const bookmarks = await db.query<{
      chrome_bookmark_id: string;
      note: string | null;
      rating: number | null;
      screenshot: string | null;
    }>(
      "SELECT chrome_bookmark_id, note, rating, screenshot FROM bookmarks",
    );

    let skipped = 0;
    for (const row of bookmarks.rows) {
      const url = await resolveBookmarkUrl(row.chrome_bookmark_id);
      if (!url) {
        skipped += 1;
        continue;
      }
      if (row.note) await metadata.setNote(url, row.note);
      if (row.rating !== null) await metadata.setRating(url, row.rating);
      if (row.screenshot && !isDataUrl(row.screenshot)) {
        await metadata.setScreenshotUrl(url, row.screenshot);
      }
      migrated += 1;
    }

    const tagRows = await db.query<{
      chrome_bookmark_id: string;
      name: string;
    }>(
      `SELECT bookmark_tags.bookmark_id AS chrome_bookmark_id, tags.name AS name
       FROM bookmark_tags
       JOIN tags ON tags.id = bookmark_tags.tag_id`,
    );

    const tagsByBookmark = new Map<string, string[]>();
    for (const row of tagRows.rows) {
      const tags = tagsByBookmark.get(row.chrome_bookmark_id) ?? [];
      tags.push(row.name);
      tagsByBookmark.set(row.chrome_bookmark_id, tags);
    }

    for (const [chromeBookmarkId, tags] of tagsByBookmark) {
      const url = await resolveBookmarkUrl(chromeBookmarkId);
      if (!url) continue;
      await metadata.setTags(url, tags);
    }

    await db.exec(
      "DROP TABLE IF EXISTS bookmark_tags; DROP TABLE IF EXISTS tags; DROP TABLE IF EXISTS bookmarks;",
    );

    if (skipped > 0) {
      console.warn(
        `[legacy-migration] skipped ${skipped} metadata row(s) whose Chrome bookmark no longer exists`,
      );
    }
  }

  const stored = await chrome.storage.local.get("screenshots");
  const screenshots = stored.screenshots as
    | Record<string, LegacyScreenshot>
    | undefined;

  if (screenshots) {
    for (const [chromeBookmarkId, screenshot] of Object.entries(screenshots)) {
      // ponytail: legacy data: URLs are skipped, only remote OG URLs migrate.
      if (!screenshot.dataUrl || isDataUrl(screenshot.dataUrl)) continue;
      const url =
        (await resolveBookmarkUrl(chromeBookmarkId)) ?? screenshot.url;
      if (!url) continue;
      await metadata.setScreenshotUrl(url, screenshot.dataUrl);
      migrated += 1;
    }
    await chrome.storage.local.remove("screenshots");
  }

  await repository.markLegacyMigrated();
  return migrated > 0;
};
