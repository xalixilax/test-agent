import {
  changePasswordRequestSchema,
  imageFetchRequestSchema,
  IMAGE_URL_TTL_SECONDS,
  loginRequestSchema,
  registerRequestSchema,
  signImagesRequestSchema,
  syncPushRequestSchema,
} from "sync-protocol";
import { ApiError } from "./application/ports";
import { AuthError, AuthService } from "./application/auth-service";
import { signImagePath, verifyImagePath } from "./application/image-signing";
import { SyncService } from "./application/sync-service";
import { ImageService } from "./application/image-service";
import { D1AccountStore, D1FieldStore, D1SessionStore } from "./infrastructure/d1-stores";
import { R2BlobStore } from "./infrastructure/r2-blob-store";

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  INVITE_CODE?: string;
  IMAGE_SIGNING_KEY?: string;
}

interface AppServices {
  auth: AuthService;
  sync: SyncService;
  images: ImageService;
}

export const createServices = (env: Env): AppServices => {
  const accounts = new D1AccountStore(env.DB);
  const sessions = new D1SessionStore(env.DB);
  const fields = new D1FieldStore(env.DB);
  const blobs = new R2BlobStore(env.IMAGES);

  return {
    auth: new AuthService({
      accounts,
      sessions,
      inviteCode: env.INVITE_CODE ?? "",
    }),
    sync: new SyncService(fields, blobs),
    images: new ImageService(blobs),
  };
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
};

export const handleRequest = async (
  request: Request,
  env: Env,
): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const { pathname } = url;
  const services = createServices(env);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2_000_000) {
    return json({ error: "Payload too large" }, 413);
  }

  try {
    if (pathname === "/health") {
      return json({ ok: true });
    }

    if (pathname === "/auth/params" && request.method === "GET") {
      return json(await services.auth.params());
    }

    if (pathname === "/auth/register" && request.method === "POST") {
      const input = registerRequestSchema.parse(await request.json());
      return json(await services.auth.register(input));
    }

    if (pathname === "/auth/login" && request.method === "POST") {
      const input = loginRequestSchema.parse(await request.json());
      return json(await services.auth.login(input));
    }

    if (pathname === "/auth/password" && request.method === "POST") {
      const token = bearerToken(request);
      if (!token) throw new AuthError(401, "Missing session token");
      const input = changePasswordRequestSchema.parse(await request.json());
      await services.auth.changePassword(input, token);
      return json({ ok: true });
    }

    if (pathname === "/auth/session" && request.method === "DELETE") {
      const token = bearerToken(request);
      if (token) await services.auth.logout(token);
      return json({ ok: true });
    }

    if (pathname === "/sync" && request.method === "GET") {
      const token = bearerToken(request);
      if (!token) throw new AuthError(401, "Missing session token");
      await services.auth.authenticate(token);
      const since = Number(url.searchParams.get("since") ?? "0");
      if (!Number.isFinite(since) || since < 0) {
        throw new ApiError(400, "Invalid since cursor");
      }
      return json(await services.sync.pull(since));
    }

    if (pathname === "/sync" && request.method === "POST") {
      const token = bearerToken(request);
      if (!token) throw new AuthError(401, "Missing session token");
      await services.auth.authenticate(token);
      const input = syncPushRequestSchema.parse(await request.json());
      return json(await services.sync.push(input.fields));
    }

    if (pathname === "/images/fetch" && request.method === "POST") {
      const token = bearerToken(request);
      if (!token) throw new AuthError(401, "Missing session token");
      await services.auth.authenticate(token);
      const input = imageFetchRequestSchema.parse(await request.json());
      return json(
        await services.images.fetchAndStore(input.uuid, input.url),
      );
    }

    if (pathname === "/images/sign" && request.method === "POST") {
      const token = bearerToken(request);
      if (!token) throw new AuthError(401, "Missing session token");
      await services.auth.authenticate(token);
      const secret = env.IMAGE_SIGNING_KEY;
      if (!secret) {
        throw new ApiError(503, "Image signing is not configured");
      }
      const input = signImagesRequestSchema.parse(await request.json());
      const exp = Math.floor(Date.now() / 1000) + IMAGE_URL_TTL_SECONDS;
      const urls = await Promise.all(
        input.items.map(async ({ uuid, key }) => ({
          uuid,
          key,
          url: `${url.origin}/images/${uuid}/${key}?exp=${exp}&sig=${await signImagePath(secret, uuid, key, exp)}`,
        })),
      );
      return json({ urls });
    }

    const imageMatch = pathname.match(/^\/images\/([^/]+)\/([^/]+)$/u);
    if (imageMatch && request.method === "GET") {
      const token = bearerToken(request);
      if (token) {
        await services.auth.authenticate(token);
      } else {
        const exp = Number(url.searchParams.get("exp") ?? "0");
        const signature = url.searchParams.get("sig") ?? "";
        const secret = env.IMAGE_SIGNING_KEY;
        if (
          !secret ||
          !(await verifyImagePath(
            secret,
            imageMatch[1],
            imageMatch[2],
            exp,
            signature,
            Math.floor(Date.now() / 1000),
          ))
        ) {
          throw new AuthError(401, "Invalid or expired image signature");
        }
      }
      const image = await services.images.serve(imageMatch[1], imageMatch[2]);
      if (!image) throw new ApiError(404, "Image not found");
      return new Response(image.bytes, {
        headers: {
          "content-type": image.contentType,
          "cache-control": "private, max-age=86400",
          ...CORS_HEADERS,
        },
      });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof ApiError || error instanceof AuthError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof SyntaxError) {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (
      error instanceof Error &&
      error.name === "ZodError"
    ) {
      return json({ error: "Invalid request payload" }, 400);
    }
    console.error("Unhandled error", error);
    return json({ error: "Internal error" }, 500);
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
