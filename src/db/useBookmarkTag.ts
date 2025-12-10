import {
	type UseMutationOptions,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import type { InferInput, InferOutput } from "../lib/worker/router";
import { createWorkerClient } from "../lib/worker/client";
import type { AppRouter } from "../routers/appRouters";

const client = createWorkerClient<AppRouter>();

export const useAddBookmarkTag = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["addBookmarkTag"]>,
			Error,
			InferInput<AppRouter["addBookmarkTag"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: InferInput<AppRouter["addBookmarkTag"]>) =>
			client.addBookmarkTag.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getBookmarks"] });
			void queryClient.invalidateQueries({ queryKey: ["getTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useDeleteBookmarkTag = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["deleteBookmarkTag"]>,
			Error,
			InferInput<AppRouter["deleteBookmarkTag"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.deleteBookmarkTag.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getBookmarks"] });
			void queryClient.invalidateQueries({ queryKey: ["getTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};
