import type { z } from "zod";
import {
  authParamsResponseSchema,
  errorResponseSchema,
  imageFetchRequestSchema,
  imageFetchResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  okResponseSchema,
  registerRequestSchema,
  signImagesRequestSchema,
  signImagesResponseSchema,
  syncPullResponseSchema,
  syncPushRequestSchema,
  syncPushResponseSchema,
  type AuthParamsResponse,
  type ChangePasswordRequest,
  type FieldEnvelope,
  type ImageFetchRequest,
  type ImageFetchResponse,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RemoteField,
  type SignImagesRequest,
  type SyncPushResponse,
} from "sync-protocol";
import type { AuthGateway } from "@/contexts/identity/application/ports";
import type { ImageGateway, SyncGateway } from "../application/ports";

export interface HttpSyncApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch;
}

const errorMessage = (body: unknown, status: number): string => {
  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.error : `Sync API error ${status}`;
};

export class HttpSyncApiClient implements AuthGateway, SyncGateway, ImageGateway {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string | null>;
  private readonly fetchFn: typeof fetch;

  constructor(options: HttpSyncApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, "");
    this.getToken = options.getToken;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: string;
      body?: unknown;
      token?: string | null;
      query?: Record<string, string>;
    } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers({ "content-type": "application/json" });
    const token = options.token !== undefined ? options.token : await this.getToken();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await this.fetchFn(url.toString(), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(errorMessage(body, response.status));
    }
    return schema.parse(body);
  }

  async params(): Promise<AuthParamsResponse> {
    return this.request("/auth/params", authParamsResponseSchema, {
      token: null,
    });
  }

  async register(input: RegisterRequest): Promise<LoginResponse> {
    return this.request("/auth/register", loginResponseSchema, {
      method: "POST",
      token: null,
      body: registerRequestSchema.parse(input),
    });
  }

  async login(input: LoginRequest): Promise<LoginResponse> {
    return this.request("/auth/login", loginResponseSchema, {
      method: "POST",
      token: null,
      body: loginRequestSchema.parse(input),
    });
  }

  async changePassword(input: ChangePasswordRequest & { token: string }): Promise<void> {
    await this.request("/auth/password", okResponseSchema, {
      method: "POST",
      token: input.token,
      body: {
        newSalt: input.newSalt,
        newAuthHash: input.newAuthHash,
        newWrappedKey: input.newWrappedKey,
      },
    });
  }

  async logout(token: string): Promise<void> {
    await this.request("/auth/session", okResponseSchema, {
      method: "DELETE",
      token,
    });
  }

  async pull(since: number): Promise<{ changes: RemoteField[]; seq: number; serverTime: number }> {
    return this.request("/sync", syncPullResponseSchema, {
      query: { since: String(since) },
    });
  }

  async push(fields: FieldEnvelope[]): Promise<{ accepted: number; serverTime: number }> {
    const response: SyncPushResponse = await this.request("/sync", syncPushResponseSchema, {
      method: "POST",
      body: syncPushRequestSchema.parse({ fields }),
    });
    return response;
  }

  async fetchAndStore(input: ImageFetchRequest): Promise<ImageFetchResponse> {
    return this.request("/images/fetch", imageFetchResponseSchema, {
      method: "POST",
      body: imageFetchRequestSchema.parse(input),
    });
  }

  async signImageUrls(input: SignImagesRequest["items"]): Promise<Map<string, string>> {
    if (input.length === 0) return new Map();
    const response = await this.request("/images/sign", signImagesResponseSchema, {
      method: "POST",
      body: signImagesRequestSchema.parse({ items: input }),
    });
    return new Map(response.urls.map((item) => [`${item.uuid}/${item.key}`, item.url]));
  }
}
