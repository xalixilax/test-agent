import { AuthError, AuthService } from "./application/auth-service";
import { ImageService } from "./application/image-service";
import { ApiError } from "./application/ports";
import { SyncService } from "./application/sync-service";
import type { Env } from "./env";
import {
  bearerToken,
  CORS_HEADERS,
  json,
  type AppServices,
  type HttpContext,
  type RouteDefinition,
} from "./http";
import { D1AccountStore, D1FieldStore, D1SessionStore } from "./infrastructure/d1-stores";
import { R2BlobStore } from "./infrastructure/r2-blob-store";
import { authChangePassword, authLogin, authLogout, authParams, authRegister } from "./routes/auth";
import { imageFetch, imageServe, imageSign } from "./routes/images";
import { syncPull, syncPush } from "./routes/sync";

export type { Env } from "./env";

const MAX_PAYLOAD_BYTES = 2_000_000;

const ROUTES: RouteDefinition[] = [
  {
    method: "GET",
    path: /^\/health$/u,
    auth: false,
    handler: async () => json({ ok: true }),
  },
  { method: "GET", path: /^\/auth\/params$/u, auth: false, handler: authParams },
  {
    method: "POST",
    path: /^\/auth\/register$/u,
    auth: false,
    handler: authRegister,
  },
  { method: "POST", path: /^\/auth\/login$/u, auth: false, handler: authLogin },
  {
    method: "POST",
    path: /^\/auth\/password$/u,
    auth: true,
    handler: authChangePassword,
  },
  {
    method: "DELETE",
    path: /^\/auth\/session$/u,
    auth: false,
    handler: authLogout,
  },
  { method: "GET", path: /^\/sync$/u, auth: true, handler: syncPull },
  { method: "POST", path: /^\/sync$/u, auth: true, handler: syncPush },
  {
    method: "POST",
    path: /^\/images\/fetch$/u,
    auth: true,
    handler: imageFetch,
  },
  {
    method: "POST",
    path: /^\/images\/sign$/u,
    auth: true,
    handler: imageSign,
  },
  {
    method: "GET",
    path: /^\/images\/([^/]+)\/([^/]+)$/u,
    auth: false,
    handler: imageServe,
  },
];

const createServices = (env: Env): AppServices => {
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

const matchRoute = (
  method: string,
  pathname: string,
): { route: RouteDefinition; params: string[] } | null => {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const match = route.path.exec(pathname);
    if (match) return { route, params: match.slice(1) };
  }
  return null;
};

const errorResponse = (error: unknown): Response => {
  if (error instanceof ApiError || error instanceof AuthError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof SyntaxError) {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (error instanceof Error && error.name === "ZodError") {
    return json({ error: "Invalid request payload" }, 400);
  }
  console.error("Unhandled error", error);
  return json({ error: "Internal error" }, 500);
};

export const handleRequest = async (request: Request, env: Env): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  const url = new URL(request.url);
  const matched = matchRoute(request.method, url.pathname);
  if (!matched) return json({ error: "Not found" }, 404);

  const services = createServices(env);
  const context: HttpContext = {
    request,
    url,
    services,
    env,
    params: matched.params,
  };

  try {
    if (matched.route.auth) {
      const token = bearerToken(request);
      if (!token) throw new AuthError(401, "Missing session token");
      await services.auth.authenticate(token);
    }
    return await matched.route.handler(context);
  } catch (error) {
    return errorResponse(error);
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
