import type { InferInput, InferOutput, Procedure, WorkerRequest, WorkerResponse } from "./router";

class WorkerClient<TRouter extends Record<string, Procedure<any, any>>> {
  private requestId = 0;
  private pendingRequests = new Map<
    string,
    {
      resolve: (data: any) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(_workerUrl?: string) {
    // Transport is chrome.runtime messaging; the url is kept for API compatibility.
  }

  private handleMessage(response: WorkerResponse) {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);

    if (response.success) {
      pending.resolve(response.data);
    } else {
      pending.reject(new Error(response.error));
    }
  }

  async request<TRoute extends keyof TRouter>(
    route: TRoute,
    input: InferInput<TRouter[TRoute]>,
  ): Promise<InferOutput<TRouter[TRoute]>> {
    const id = `${++this.requestId}`;

    const request: WorkerRequest = {
      type: "worker-request",
      id,
      requestId: id,
      route: route as string,
      input,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

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
    return this.request(route, input);
  }
}

type RouteHelper<
  TRouter extends Record<string, Procedure<unknown, unknown>>,
  TRoute extends keyof TRouter,
> = {
  query: [InferInput<TRouter[TRoute]>] extends [void]
    ? (input?: undefined) => Promise<InferOutput<TRouter[TRoute]>>
    : (input: InferInput<TRouter[TRoute]>) => Promise<InferOutput<TRouter[TRoute]>>;
  mutate: [InferInput<TRouter[TRoute]>] extends [void]
    ? (input?: undefined) => Promise<InferOutput<TRouter[TRoute]>>
    : (input: InferInput<TRouter[TRoute]>) => Promise<InferOutput<TRouter[TRoute]>>;
};

export type EnhancedWorkerClient<TRouter extends Record<string, Procedure<unknown, unknown>>> =
  WorkerClient<TRouter> & {
    [K in keyof TRouter]: RouteHelper<TRouter, K>;
  };

let instance: EnhancedWorkerClient<Record<string, Procedure<unknown, unknown>>> | null = null;

export const createWorkerClient = <TRouter extends Record<string, Procedure<any, any>>>(
  workerUrl: string = "/worker.js",
): EnhancedWorkerClient<TRouter> => {
  if (!instance) {
    const baseClient = new WorkerClient<TRouter>(workerUrl);

    instance = new Proxy(baseClient, {
      get(target, prop) {
        if (prop in target) {
          return target[prop as keyof typeof target];
        }

        return {
          query: (input?: unknown) => target.request(prop as keyof TRouter, input as any),
          mutate: (input?: unknown) => target.mutate(prop as keyof TRouter, input as any),
        };
      },
    }) as EnhancedWorkerClient<Record<string, Procedure<unknown, unknown>>>;
  }

  return instance as EnhancedWorkerClient<TRouter>;
};
