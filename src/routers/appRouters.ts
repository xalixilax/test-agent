import { eq } from "drizzle-orm";
import { z } from "zod";
import { type Bookmark, bookmarks } from "../db/schema";
import { createRouter, mutation, query } from "../lib/worker/router";

// Input schemas
const addBookmarkSchema = z.object({
	id: z.string().min(1, "ID is required"),
	url: z.string().min(1, "URL is required").url("Please enter a valid URL"),
	title: z.string().min(1, "Title is required"),
	rating: z.number().int().min(1).max(5).optional(),
	note: z.string().optional(),
	tags: z.string().optional(),
});

const updateBookmarkSchema = z.object({
	id: z.string().min(1, "ID is required"),
	url: z.string().url("Please enter a valid URL").optional(),
	title: z.string().min(1).optional(),
	rating: z.number().int().min(1).max(5).optional(),
	note: z.string().optional(),
	tags: z.string().optional(),
});

const deleteBookmarkSchema = z.object({
	id: z.string().min(1, "ID is required"),
});

const getBookmarkSchema = z.object({
	id: z.string().min(1, "ID is required"),
});

export const createAppRouter = (context: {
	db: any;
	log: (...args: string[]) => void;
	error: (...args: string[]) => void;
}) => {
	return createRouter({
		getBookmarks: query({
			handler: async (): Promise<Bookmark[]> => {
				return await context.db.select().from(bookmarks);
			},
		}),

		getBookmark: query({
			input: getBookmarkSchema,
			handler: async (input): Promise<Bookmark | null> => {
				const [bookmark] = await context.db
					.select()
					.from(bookmarks)
					.where(eq(bookmarks.id, input.id));
				return bookmark || null;
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
			handler: async (input): Promise<{ id: string }> => {
				await context.db.delete(bookmarks).where(eq(bookmarks.id, input.id));
				return { id: input.id };
			},
		}),
	});
};
};

// Export the router type for the client
export type AppRouter = ReturnType<typeof createAppRouter>;
