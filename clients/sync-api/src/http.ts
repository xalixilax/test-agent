import type { AuthService } from "./application/auth-service";
import type { ImageService } from "./application/image-service";
import type { SyncService } from "./application/sync-service";
import type { Env } from "./env";

export interface AppServices {
  auth: AuthService;
  sync: SyncService;
  images: ImageService;
}

export interface HttpContext {
  request: Request;
  url: URL;
  services: AppServices;
  env: Env;
  params: string[];
}

export interface RouteDefinition {
  method: string;
  path: RegExp;
  auth: boolean;
  handler: (context: HttpContext) => Promise<Response>;
}

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });

export const bearerToken = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
};
