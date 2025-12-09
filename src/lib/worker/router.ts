import type { z } from "zod";

export type ProcedureType = "query" | "mutation";

export interface Procedure<TInput = unknown, TOutput = unknown> {
	type: ProcedureType;
	input?: z.ZodType<TInput>;
	handler: (input: TInput) => Promise<TOutput>;
}

export interface Router {
	[key: string]: Procedure<any, any>;
}

export const query = <TInput = void, TOutput = unknown>(config: {
	input?: z.ZodType<TInput>;
	handler: (input: TInput) => Promise<TOutput>;
}): Procedure<TInput, TOutput> => ({
	type: "query",
	input: config.input,
	handler: config.handler,
});

export const mutation = <TInput = void, TOutput = unknown>(config: {
	input?: z.ZodType<TInput>;
	handler: (input: TInput) => Promise<TOutput>;
}): Procedure<TInput, TOutput> => ({
	type: "mutation",
	input: config.input,
	handler: config.handler,
});

export const createRouter = <T extends Router>(routes: T): T => routes;

export type InferInput<T> =
	T extends Procedure<infer TInput, unknown> ? TInput : never;
export type InferOutput<T> =
	T extends Procedure<unknown, infer TOutput> ? TOutput : never;

export interface WorkerRequest<
	TRoute extends string = string,
	TInput = unknown,
> {
	id: string;
	route: TRoute;
	input: TInput;
}

export interface WorkerResponse<TOutput = unknown> {
	id: string;
	success: boolean;
	data?: TOutput;
	error?: string;
}

export const createWorkerHandler = <T extends Router>(router: T) => {
	return async (request: WorkerRequest): Promise<WorkerResponse> => {
		const { id, route, input } = request;

		try {
			const procedure = router[route];
			if (!procedure) {
				throw new Error(`Route "${route}" not found`);
			}

			const validatedInput = procedure.input
				? procedure.input.parse(input)
				: input;
			const data = await procedure.handler(validatedInput);

			return { id, success: true, data };
		} catch (error) {
			return {
				id,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	};
};
