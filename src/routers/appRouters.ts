import { eq } from "drizzle-orm";
import { z } from "zod";
import { type User, users } from "../db/schema";
import { createRouter, mutation, query } from "../lib/worker/router";

// Input schemas
const addUserSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z
		.string()
		.min(1, "Email is required")
		.email("Please enter a valid email address"),
	age: z.number().int().positive("Age must be a positive number"),
	city: z.string().optional(),
});

const updateUserSchema = z.object({
	id: z.number().int().positive(),
	name: z.string().min(1).optional(),
	email: z.string().email("Please enter a valid email address").optional(),
	age: z.number().int().positive().optional(),
	city: z.string().optional(),
});

const deleteUserSchema = z.object({
	id: z.number().int().positive(),
});

export const createAppRouter = (context: {
	db: any;
	log: (...args: string[]) => void;
	error: (...args: string[]) => void;
}) => {
	return createRouter({
		getUsers: query({
			handler: async (): Promise<User[]> => {
				return await context.db.select().from(users).orderBy(users.id);
			},
		}),

		addUser: mutation({
			input: addUserSchema,
			handler: async (input): Promise<User> => {
				const [newUser] = await context.db
					.insert(users)
					.values(input)
					.returning();
				return newUser;
			},
		}),

		updateUser: mutation({
			input: updateUserSchema,
			handler: async (input): Promise<User> => {
				const { id, ...updateData } = input;

				if (Object.keys(updateData).length === 0) {
					throw new Error("No fields to update");
				}

				const [updatedUser] = await context.db
					.update(users)
					.set(updateData)
					.where(eq(users.id, id))
					.returning();

				return updatedUser;
			},
		}),

		deleteUser: mutation({
			input: deleteUserSchema,
			handler: async (input): Promise<{ id: number }> => {
				await context.db.delete(users).where(eq(users.id, input.id));
				return { id: input.id };
			},
		}),
	});
};

// Export the router type for the client
export type AppRouter = ReturnType<typeof createAppRouter>;
