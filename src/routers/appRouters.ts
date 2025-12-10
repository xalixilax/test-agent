import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { type Bookmark, bookmarks, type Tag, tags, type BookmarkTag, bookmarkTags } from "../db/schema";
import { createRouter, mutation, query } from "../lib/worker/router";

// Input schemas

// Bookmark schemas
const addBookmarkSchema = z.object({
	title: z.string().min(1, "Title is required"),
	url: z.string().url("Valid URL is required"),
	note: z.string().optional(),
	rating: z.number().min(0).max(5).optional(),
	screenshot: z.string().optional(),
});

const updateBookmarkSchema = z.object({
	id: z.number().int().positive(),
	title: z.string().min(1, "Title is required").optional(),
	url: z.string().url("Valid URL is required").optional(),
	note: z.string().optional().nullable(),
	rating: z.number().min(0).max(5).optional().nullable(),
	screenshot: z.string().optional().nullable(),
});

const deleteBookmarkSchema = z.object({
	id: z.number().int().positive(),
});

// Tag schemas
const addTagSchema = z.object({
	name: z.string().min(1, "Tag name is required"),
});

const updateTagSchema = z.object({
	id: z.number().int().positive(),
	name: z.string().min(1, "Tag name is required"),
});

const deleteTagSchema = z.object({
	id: z.number().int().positive(),
});

// BookmarkTag schemas
const addBookmarkTagSchema = z.object({
	bookmarkId: z.number().int().positive(),
	tagId: z.number().int().positive(),
});

const deleteBookmarkTagSchema = z.object({
	bookmarkId: z.number().int().positive(),
	tagId: z.number().int().positive(),
});

// Chrome bookmark sync schema
const syncChromeBookmarksSchema = z.object({
	bookmarks: z.array(z.object({
		chromeBookmarkId: z.string(),
		title: z.string(),
		url: z.string(),
		screenshot: z.string().optional(),
	})),
});

export const createAppRouter = (context: {
	db: any;
	log: (...args: string[]) => void;
	error: (...args: string[]) => void;
}) => {
	return createRouter({
		// Bookmark queries and mutations
		getBookmarks: query({
			handler: async (): Promise<Bookmark[]> => {
				return await context.db.select().from(bookmarks).orderBy(bookmarks.id);
			},
		}),

		getBookmarksWithTags: query({
			handler: async () => {
				// Get all bookmarks
				const allBookmarks = await context.db.select().from(bookmarks).orderBy(bookmarks.id);
				
				// Get all bookmark-tag relationships
				const allBookmarkTags = await context.db
					.select({
						bookmarkId: bookmarkTags.bookmarkId,
						tagId: bookmarkTags.tagId,
						tagName: tags.name,
					})
					.from(bookmarkTags)
					.leftJoin(tags, eq(bookmarkTags.tagId, tags.id));

				// Combine bookmarks with their tags
				return allBookmarks.map((bookmark: Bookmark) => ({
					...bookmark,
					tags: allBookmarkTags
						.filter((bt: any) => bt.bookmarkId === bookmark.id)
						.map((bt: any) => ({ id: bt.tagId, name: bt.tagName || '' })),
				}));
			},
		}),

		addBookmark: mutation({
			input: addBookmarkSchema,
			handler: async (input): Promise<Bookmark> => {
				const [newBookmark] = await context.db
					.insert(bookmarks)
					.values(input)
					.returning();
				return newBookmark;
			},
		}),

		updateBookmark: mutation({
			input: updateBookmarkSchema,
			handler: async (input): Promise<Bookmark> => {
				const { id, ...updateData } = input;

				if (Object.keys(updateData).length === 0) {
					throw new Error("No fields to update");
				}

				const [updatedBookmark] = await context.db
					.update(bookmarks)
					.set(updateData)
					.where(eq(bookmarks.id, id))
					.returning();

				return updatedBookmark;
			},
		}),

		deleteBookmark: mutation({
			input: deleteBookmarkSchema,
			handler: async (input): Promise<{ id: number }> => {
				await context.db.delete(bookmarks).where(eq(bookmarks.id, input.id));
				return { id: input.id };
			},
		}),

		// Tag queries and mutations
		getTags: query({
			handler: async (): Promise<Tag[]> => {
				return await context.db.select().from(tags).orderBy(tags.id);
			},
		}),

		addTag: mutation({
			input: addTagSchema,
			handler: async (input): Promise<Tag> => {
				const [newTag] = await context.db
					.insert(tags)
					.values(input)
					.returning();
				return newTag;
			},
		}),

		updateTag: mutation({
			input: updateTagSchema,
			handler: async (input): Promise<Tag> => {
				const { id, ...updateData } = input;

				if (Object.keys(updateData).length === 0) {
					throw new Error("No fields to update");
				}

				const [updatedTag] = await context.db
					.update(tags)
					.set(updateData)
					.where(eq(tags.id, id))
					.returning();

				return updatedTag;
			},
		}),

		deleteTag: mutation({
			input: deleteTagSchema,
			handler: async (input): Promise<{ id: number }> => {
				await context.db.delete(tags).where(eq(tags.id, input.id));
				return { id: input.id };
			},
		}),

		// BookmarkTag mutations
		addBookmarkTag: mutation({
			input: addBookmarkTagSchema,
			handler: async (input): Promise<BookmarkTag> => {
				const [newBookmarkTag] = await context.db
					.insert(bookmarkTags)
					.values(input)
					.returning();
				return newBookmarkTag;
			},
		}),

		deleteBookmarkTag: mutation({
			input: deleteBookmarkTagSchema,
			handler: async (input): Promise<{ bookmarkId: number; tagId: number }> => {
				await context.db
					.delete(bookmarkTags)
					.where(
						and(
							eq(bookmarkTags.bookmarkId, input.bookmarkId),
							eq(bookmarkTags.tagId, input.tagId)
						)
					);
				return { bookmarkId: input.bookmarkId, tagId: input.tagId };
			},
		}),

		// Chrome bookmarks sync
		syncChromeBookmarks: mutation({
			input: syncChromeBookmarksSchema,
			handler: async (input): Promise<{ synced: number; updated: number }> => {
				let synced = 0;
				let updated = 0;

				for (const chromeBookmark of input.bookmarks) {
					// Check if bookmark already exists by Chrome bookmark ID
					const existing = await context.db
						.select()
						.from(bookmarks)
						.where(eq(bookmarks.chromeBookmarkId, chromeBookmark.chromeBookmarkId))
						.limit(1);

					if (existing.length > 0) {
						// Update existing bookmark if title, URL, or screenshot changed
						const existingBookmark = existing[0];
						const hasChanges = 
							existingBookmark.title !== chromeBookmark.title || 
							existingBookmark.url !== chromeBookmark.url ||
							(chromeBookmark.screenshot && existingBookmark.screenshot !== chromeBookmark.screenshot);
						
						if (hasChanges) {
							await context.db
								.update(bookmarks)
								.set({
									title: chromeBookmark.title,
									url: chromeBookmark.url,
									screenshot: chromeBookmark.screenshot || existingBookmark.screenshot,
								})
								.where(eq(bookmarks.chromeBookmarkId, chromeBookmark.chromeBookmarkId));
							updated++;
						}
					} else {
						// Insert new bookmark
						await context.db
							.insert(bookmarks)
							.values({
								chromeBookmarkId: chromeBookmark.chromeBookmarkId,
								title: chromeBookmark.title,
								url: chromeBookmark.url,
								screenshot: chromeBookmark.screenshot,
							});
						synced++;
					}
				}

				return { synced, updated };
			},
		}),
	});
};

// Export the router type for the client
export type AppRouter = ReturnType<typeof createAppRouter>;
