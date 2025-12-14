/** biome-ignore-all lint/suspicious/noExplicitAny: I just don't care */
import type {
	InferInput,
	InferOutput,
	Procedure,
	WorkerRequest,
	WorkerResponse,
} from "./router";

// Event listener types for the client
type EventListener = (data: unknown) => void;
type ErrorListener = (error: Error) => void;

export class WorkerClient<TRouter extends Record<string, Procedure<any, any>>> {
	private requestId = 0;
	private pendingRequests = new Map<
		string,
		{
			resolve: (data: any) => void;
			reject: (error: Error) => void;
		}
	>();
	private eventListeners = new Map<string, Set<EventListener>>();
	private errorListeners = new Set<ErrorListener>();

	constructor(workerUrl: string) {
		// No longer using Web Worker - using background script instead
		// workerUrl parameter kept for API compatibility
	}

	private handleMessage(response: WorkerResponse) {
		const pending = this.pendingRequests.get(response.id);

		if (!pending) return;

		this.pendingRequests.delete(response.id);

		if (response.success) {
			pending.resolve(response.data);
		} else {
			const error = new Error(response.error || "Unknown error");
			pending.reject(error);
			this.notifyError(error);
		}
	}

	private handleError(errorMessage: string) {
		const error = new Error(`Background script error: ${errorMessage}`);
		this.notifyError(error);
	}

	private notifyError(error: Error) {
		this.errorListeners.forEach((listener) => {
			listener(error);
		});
	}

	private notifyListeners(eventKey: string, data: unknown) {
		const listeners = this.eventListeners.get(eventKey);
		if (listeners) {
			listeners.forEach((listener) => {
				listener(data);
			});
		}
	}

	async request<TRoute extends keyof TRouter>(
		route: TRoute,
		input: InferInput<TRouter[TRoute]>,
	): Promise<InferOutput<TRouter[TRoute]>> {
		const id = `${++this.requestId}`;

		const request: WorkerRequest = {
			type: 'worker-request',
			id,
			requestId: id,
			route: route as string,
			input,
		};

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, { resolve, reject });
			
			// Use chrome.runtime.sendMessage instead of worker.postMessage
			chrome.runtime.sendMessage(request, (response: WorkerResponse) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					this.pendingRequests.delete(id);
					return;
				}
				
				this.handleMessage(response);
			});
		});
	}

	async mutate<TRoute extends keyof TRouter>(
		route: TRoute,
		input: InferInput<TRouter[TRoute]>,
	): Promise<InferOutput<TRouter[TRoute]>> {
		const result = await this.request(route, input);
		this.notifyListeners(`mutation:${route as string}`, result);
		return result;
	}

	/**
	 * Cleanup the client (no worker to terminate anymore)
	 */
	terminate() {
		this.pendingRequests.clear();
		this.eventListeners.clear();
		this.errorListeners.clear();
	}
}

type RouteHelper<
	TRouter extends Record<string, Procedure<unknown, unknown>>,
	TRoute extends keyof TRouter,
> = {
	// biome-ignore lint/suspicious/noConfusingVoidType: void is used to detect procedures without input
	query: [InferInput<TRouter[TRoute]>] extends [void]
		? (input?: undefined) => Promise<InferOutput<TRouter[TRoute]>>
		: (
				input: InferInput<TRouter[TRoute]>,
			) => Promise<InferOutput<TRouter[TRoute]>>;
	// biome-ignore lint/suspicious/noConfusingVoidType: void is used to detect procedures without input
	mutate: [InferInput<TRouter[TRoute]>] extends [void]
		? (input?: undefined) => Promise<InferOutput<TRouter[TRoute]>>
		: (
				input: InferInput<TRouter[TRoute]>,
			) => Promise<InferOutput<TRouter[TRoute]>>;
};

export type EnhancedWorkerClient<
	TRouter extends Record<string, Procedure<unknown, unknown>>,
> = WorkerClient<TRouter> & {
	[K in keyof TRouter]: RouteHelper<TRouter, K>;
};

// Singleton instances per worker URL
const workerClientInstances = new Map<
	string,
	EnhancedWorkerClient<Record<string, Procedure<unknown, unknown>>>
>();

/**
 * Get or create a singleton worker client instance
 */
export const createWorkerClient = <
	TRouter extends Record<string, Procedure<any, any>>,
>(
	workerUrl: string = "/worker.js",
): EnhancedWorkerClient<TRouter> => {
	if (!workerClientInstances.has(workerUrl)) {
		const baseClient = new WorkerClient<TRouter>(workerUrl);

		// Create proxy for fluent API
		const enhancedClient = new Proxy(baseClient, {
			get(target, prop) {
				// If the property exists on the client, return it
				if (prop in target) {
					return target[prop as keyof typeof target];
				}

				// Otherwise, create a route helper
				return {
					query: (input?: unknown) =>
						target.request(prop as keyof TRouter, input as any),
					mutate: (input?: unknown) =>
						target.mutate(prop as keyof TRouter, input as any),
				};
			},
		}) as EnhancedWorkerClient<TRouter>;

		workerClientInstances.set(workerUrl, enhancedClient as any);
	}

	const instance = workerClientInstances.get(workerUrl);
	if (!instance) {
		throw new Error("Failed to create worker client instance");
	}
	return instance as EnhancedWorkerClient<TRouter>;
};
