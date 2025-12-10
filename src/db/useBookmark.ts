import {
	type UseMutationOptions,
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { InferInput, InferOutput } from "../lib/worker/router";
import { createWorkerClient } from "../lib/worker/client";
import type { AppRouter } from "../routers/appRouters";

const client = createWorkerClient<AppRouter>();

export const useBookmarks = (
	options?: Omit<
		UseQueryOptions<InferOutput<AppRouter["getBookmarks"]>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["getBookmarks"],
		queryFn: () => client.getBookmarks.query(),
		retry: 3,
		retryDelay: 1000,
		...options,
	});
};

export const useBookmarksWithTags = (
	options?: Omit<
		UseQueryOptions<InferOutput<AppRouter["getBookmarksWithTags"]>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["getBookmarksWithTags"],
		queryFn: () => client.getBookmarksWithTags.query(),
		retry: 3,
		retryDelay: 1000,
		...options,
	});
};

export const useAddBookmark = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["addBookmark"]>,
			Error,
			InferInput<AppRouter["addBookmark"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: InferInput<AppRouter["addBookmark"]>) =>
			client.addBookmark.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getBookmarks"] });
			void queryClient.invalidateQueries({ queryKey: ["getBookmarksWithTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useUpdateBookmark = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["updateBookmark"]>,
			Error,
			InferInput<AppRouter["updateBookmark"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.updateBookmark.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getBookmarks"] });
			void queryClient.invalidateQueries({ queryKey: ["getBookmarksWithTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useDeleteBookmark = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["deleteBookmark"]>,
			Error,
			InferInput<AppRouter["deleteBookmark"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.deleteBookmark.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getBookmarks"] });
			void queryClient.invalidateQueries({ queryKey: ["getBookmarksWithTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useSyncChromeBookmarks = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["syncChromeBookmarks"]>,
			Error,
			InferInput<AppRouter["syncChromeBookmarks"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.syncChromeBookmarks.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getBookmarks"] });
			void queryClient.invalidateQueries({ queryKey: ["getBookmarksWithTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};
