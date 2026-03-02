import { integer, pgTable, serial, text, real, primaryKey, pgSchema } from "drizzle-orm/pg-core";

const customSchema = pgSchema('custom')

// DO NOT ADD URL, TITLE, ISFOLDER, PARENTID HERE - these are stored in Chrome's own bookmark storage
export const bookmarks = pgTable("bookmarks", {
	chromeBookmarkId: text("chrome_bookmark_id").primaryKey(),
	note: text("note"),
	rating: real("rating"), // 0-5 star rating
	screenshot: text("screenshot"), // base64 or URL to screenshot
});

export const tags = pgTable("tags", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
});

export const bookmarkTags = pgTable("bookmark_tags", {
	bookmarkId: text("bookmark_id").notNull().references(() => bookmarks.chromeBookmarkId, { onDelete: "cascade" }),
	tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ([
	primaryKey({ columns: [table.bookmarkId, table.tagId] }),
]));

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type BookmarkTag = typeof bookmarkTags.$inferSelect;
export type NewBookmarkTag = typeof bookmarkTags.$inferInsert;
