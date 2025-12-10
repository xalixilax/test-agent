import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const bookmarks = pgTable("bookmarks", {
	id: text("id").primaryKey(),
	url: text("url").notNull(),
	title: text("title").notNull(),
	rating: integer("rating"),
	note: text("note"),
	tags: text("tags"),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
