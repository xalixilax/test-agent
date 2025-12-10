import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { type Bookmark, bookmarks, type Tag, tags, type BookmarkTag, bookmarkTags } from "../db/schema";
import { createRouter, mutation, query } from "../lib/worker/router";

// Input schemas

// Bookmark schemas
const addBookmarkSchema = z.object({
	note: z.string().optional(),
	rating: z.number().min(0).max(5).optional(),
});

const updateBookmarkSchema = z.object({
	id: z.number().int().positive(),
	note: z.string().optional(),
	rating: z.number().min(0).max(5).optional(),
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
	});
};

// Export the router type for the client
export type AppRouter = ReturnType<typeof createAppRouter>;
