CREATE TABLE "bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"rating" integer,
	"note" text,
	"tags" text
);
