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

export const useTags = (
	options?: Omit<
		UseQueryOptions<InferOutput<AppRouter["getTags"]>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["getTags"],
		queryFn: () => client.getTags.query(),
		retry: 3,
		retryDelay: 1000,
		...options,
	});
};

export const useAddTag = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["addTag"]>,
			Error,
			InferInput<AppRouter["addTag"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: InferInput<AppRouter["addTag"]>) =>
			client.addTag.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useUpdateTag = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["updateTag"]>,
			Error,
			InferInput<AppRouter["updateTag"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.updateTag.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useDeleteTag = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["deleteTag"]>,
			Error,
			InferInput<AppRouter["deleteTag"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.deleteTag.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getTags"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};
