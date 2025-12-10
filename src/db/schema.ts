import { integer, pgTable, serial, text, timestamp, real, primaryKey, pgSchema } from "drizzle-orm/pg-core";

const customSchema = pgSchema('custom')

export const bookmarks = pgTable("bookmarks", {
	id: serial("id").primaryKey(),
	chromeBookmarkId: text("chrome_bookmark_id").unique(),
	title: text("title").notNull(),
	url: text("url").notNull(),
	note: text("note"),
	rating: real("rating"), // 0-5 star rating
	dateAdded: timestamp("date_added").defaultNow(),
	screenshot: text("screenshot"), // base64 or URL to screenshot
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
