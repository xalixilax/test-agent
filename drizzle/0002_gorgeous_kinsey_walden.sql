ALTER TABLE "bookmarks" ADD COLUMN "chrome_bookmark_id" text;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_chrome_bookmark_id_unique" UNIQUE("chrome_bookmark_id");