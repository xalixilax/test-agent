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

export const useUsers = (
	options?: Omit<
		UseQueryOptions<InferOutput<AppRouter["getUsers"]>, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["getUsers"],
		queryFn: () => client.getUsers.query(),
		retry: 3,
		retryDelay: 1000,
		...options,
	});
};

export const useAddUser = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["addUser"]>,
			Error,
			InferInput<AppRouter["addUser"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: InferInput<AppRouter["addUser"]>) =>
			client.addUser.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getUsers"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useUpdateUser = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["updateUser"]>,
			Error,
			InferInput<AppRouter["updateUser"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.updateUser.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getUsers"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};

export const useDeleteUser = (
	options?: Omit<
		UseMutationOptions<
			InferOutput<AppRouter["deleteUser"]>,
			Error,
			InferInput<AppRouter["deleteUser"]>
		>,
		"mutationFn"
	>,
) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input) => client.deleteUser.mutate(input),
		onSuccess: (...args) => {
			void queryClient.invalidateQueries({ queryKey: ["getUsers"] });
			options?.onSuccess?.(...args);
		},
		...options,
	});
};
