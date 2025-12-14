ALTER TABLE "bookmarks" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "is_folder" integer DEFAULT 0 NOT NULL;