import { eq, and, isNull, desc } from "drizzle-orm";
import { z } from "zod";
import { type Bookmark, bookmarks, type Tag, tags, type BookmarkTag, bookmarkTags } from "../db/schema";
import { createRouter, mutation, query } from "../lib/worker/router";
import type { drizzle } from "drizzle-orm/pglite";

// Input schemas

// Bookmark schemas
const addBookmarkSchema = z.object({
	chromeBookmarkId: z.string().min(1, "Chrome bookmark ID is required"),
	title: z.string().min(1, "Title is required").optional(),
	url: z.string().url("Valid URL is required").optional(),
	note: z.string().optional(),
	rating: z.number().min(0).max(5).optional(),
	screenshot: z.string().optional(),
});

const updateBookmarkSchema = z.object({
	chromeBookmarkId: z.string().min(1, "Chrome bookmark ID is required"),
	title: z.string().min(1, "Title is required").optional(),
	url: z.string().url("Valid URL is required").optional(),
	note: z.string().optional().nullable(),
	rating: z.number().min(0).max(5).optional().nullable(),
	screenshot: z.string().optional().nullable(),
});

const deleteBookmarkSchema = z.object({
	chromeBookmarkId: z.string().min(1, "Chrome bookmark ID is required"),
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
	bookmarkId: z.string().min(1, "Chrome bookmark ID is required"),
	tagId: z.number().int().positive(),
});

const deleteBookmarkTagSchema = z.object({
	bookmarkId: z.string().min(1, "Chrome bookmark ID is required"),
	tagId: z.number().int().positive(),
});

// Chrome bookmark sync schema
const syncChromeBookmarksSchema = z.object({
	bookmarks: z.array(z.object({
		chromeBookmarkId: z.string(),
		chromeParentId: z.string().optional(),
		title: z.string(),
		url: z.string().optional(),
		screenshot: z.string().optional(),
		isFolder: z.number().int(),
	})),
});

export const createAppRouter = (context: {
	db: ReturnType<typeof drizzle>;
	log: (...args: string[]) => void;
	error: (...args: string[]) => void;
}) => {
	return createRouter({
		// Bookmark queries and mutations
		getBookmarks: query({
			handler: async (): Promise<Bookmark[]> => {
				return await context.db.select().from(bookmarks).orderBy(bookmarks.chromeBookmarkId);
			},
		}),

		getBookmarkById: query({
			input: z.object({
				chromeBookmarkId: z.string().min(1),
			}),
			handler: async (input) => {
				const results = await context.db
					.select({
						bookmark: bookmarks,
						tagId: bookmarkTags.tagId,
						tagName: tags.name,
					})
					.from(bookmarks)
					.leftJoin(bookmarkTags, eq(bookmarks.chromeBookmarkId, bookmarkTags.bookmarkId))
					.leftJoin(tags, eq(bookmarkTags.tagId, tags.id))
					.where(eq(bookmarks.chromeBookmarkId, input.chromeBookmarkId));

				if (results.length === 0) {
					throw new Error(`Bookmark with chromeBookmarkId ${input.chromeBookmarkId} not found`);
				}

				const bookmark = results[0].bookmark;
				const tagsData = results
					.filter((r: typeof results[0]) => r.tagId !== null)
					.map((r: typeof results[0]) => ({
						id: r.tagId!,
						name: r.tagName || ''
					}));

				return {
					...bookmark,
					tags: tagsData,
				};
			},
		}),

		getBookmarksWithTags: query({
			handler: async () => {
				// Get all bookmarks for search purposes
				const allBookmarks = await context.db.select().from(bookmarks).orderBy(bookmarks.chromeBookmarkId);

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
						.filter((bt: any) => bt.bookmarkId === bookmark.chromeBookmarkId)
						.map((bt: any) => ({ id: bt.tagId, name: bt.tagName || '' })),
				}));
			},
		}),

		getBookmarksByParent: query({
			input: z.object({
				parentId: z.string().nullable(),
			}),
			handler: async (input) => {
				// Get all bookmarks - folder filtering will be done by Chrome API
				const allBookmarks = await context.db.select().from(bookmarks).orderBy(bookmarks.chromeBookmarkId);

				// Get all bookmark-tag relationships for these bookmarks
				const bookmarkIds = allBookmarks.map((b: Bookmark) => b.chromeBookmarkId);
				const allBookmarkTags = bookmarkIds.length > 0 ? await context.db
					.select({
						bookmarkId: bookmarkTags.bookmarkId,
						tagId: bookmarkTags.tagId,
						tagName: tags.name,
					})
					.from(bookmarkTags)
					.leftJoin(tags, eq(bookmarkTags.tagId, tags.id)) : [];

				// Combine bookmarks with their tags
				return allBookmarks.map((bookmark: Bookmark) => ({
					...bookmark,
					tags: allBookmarkTags
						.filter((bt: any) => bt.bookmarkId === bookmark.chromeBookmarkId)
						.map((bt: any) => ({ id: bt.tagId, name: bt.tagName || '' })),
				}));
			},
		}), addBookmark: mutation({
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
				const { chromeBookmarkId, ...updateData } = input;

				if (Object.keys(updateData).length === 0) {
					throw new Error("No fields to update");
				}

				const [updatedBookmark] = await context.db
					.update(bookmarks)
					.set(updateData)
					.where(eq(bookmarks.chromeBookmarkId, chromeBookmarkId))
					.returning();

					console.log("Updated bookmark:", updatedBookmark); // --- IGNORE ---

				return updatedBookmark;
			},
		}),

		deleteBookmark: mutation({
			input: deleteBookmarkSchema,
			handler: async (input): Promise<{ chromeBookmarkId: string }> => {
				await context.db.delete(bookmarks).where(eq(bookmarks.chromeBookmarkId, input.chromeBookmarkId));
				return { chromeBookmarkId: input.chromeBookmarkId };
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
			handler: async (input): Promise<{ bookmarkId: string; tagId: number }> => {
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
						// Update existing bookmark
						const existingBookmark = existing[0];
						const hasChanges =
							(chromeBookmark.screenshot && existingBookmark.screenshot !== chromeBookmark.screenshot);

						if (hasChanges) {
							await context.db
								.update(bookmarks)
								.set({
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
								screenshot: chromeBookmark.screenshot || null,
							})
							.returning();

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
