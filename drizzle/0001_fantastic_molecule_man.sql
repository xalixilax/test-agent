ALTER TABLE "bookmarks" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "url" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "date_added" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "screenshot" text;