import type { z } from "zod";
import {
  authParamsResponseSchema,
  errorResponseSchema,
  imageStoreResponseSchema,
  loginResponseSchema,
  okResponseSchema,
  signImagesResponseSchema,
  syncPullResponseSchema,
  syncPushResponseSchema,
  type AuthParamsResponse,
  type ChangePasswordRequest,
  type FieldEnvelope,
  type ImageStoreResponse,
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
}

const errorMessage = (body: unknown, status: number): string => {
  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.error : `Sync API error ${status}`;
};

export class HttpSyncApiClient implements AuthGateway, SyncGateway, ImageGateway {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string | null>;

  constructor(options: HttpSyncApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, "");
    this.getToken = options.getToken;
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

    const response = await fetch(url.toString(), {
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
      body: input,
    });
  }

  async login(input: LoginRequest): Promise<LoginResponse> {
    return this.request("/auth/login", loginResponseSchema, {
      method: "POST",
      token: null,
      body: input,
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
      body: { fields },
    });
    return response;
  }

  async uploadImage(input: {
    uuid: string;
    bytes: ArrayBuffer;
    contentType: string;
  }): Promise<ImageStoreResponse> {
    const headers = new Headers({ "content-type": input.contentType });
    const token = await this.getToken();
    if (token) headers.set("authorization", `Bearer ${token}`);

    const response = await fetch(`${this.baseUrl}/images/upload?uuid=${input.uuid}`, {
      method: "POST",
      headers,
      body: input.bytes,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(errorMessage(body, response.status));
    }
    return imageStoreResponseSchema.parse(body);
  }

  async signImageUrls(input: SignImagesRequest["items"]): Promise<Map<string, string>> {
    if (input.length === 0) return new Map();
    const response = await this.request("/images/sign", signImagesResponseSchema, {
      method: "POST",
      body: { items: input },
    });
    return new Map(response.urls.map((item) => [`${item.uuid}/${item.key}`, item.url]));
  }
}
