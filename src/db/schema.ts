import { integer, pgTable, serial, text, timestamp, real, primaryKey } from "drizzle-orm/pg-core";

export const bookmarks = pgTable("bookmarks", {
	id: serial("id").primaryKey(),
	note: text("note"),
	rating: real("rating"), // 0-5 star rating
});

export const tags = pgTable("tags", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
});

export const bookmarkTags = pgTable("bookmark_tags", {
	bookmarkId: integer("bookmark_id").notNull().references(() => bookmarks.id, { onDelete: "cascade" }),
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
