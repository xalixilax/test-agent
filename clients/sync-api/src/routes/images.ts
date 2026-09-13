import {
  imageFetchRequestSchema,
  IMAGE_URL_TTL_SECONDS,
  signImagesRequestSchema,
} from "sync-protocol";
import { AuthError } from "../application/auth-service";
import { signImagePath, verifyImagePath } from "../application/image-signing";
import { ApiError } from "../application/ports";
import { bearerToken, CORS_HEADERS, json, type HttpContext } from "../http";

export const imageFetch = async ({ request, services }: HttpContext): Promise<Response> => {
  const input = imageFetchRequestSchema.parse(await request.json());
  return json(await services.images.fetchAndStore(input.uuid, input.url));
};

export const imageSign = async ({ request, url, env }: HttpContext): Promise<Response> => {
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
};

const isAuthorizedForImage = async (
  { request, url, services, env }: HttpContext,
  uuid: string,
  key: string,
): Promise<boolean> => {
  const token = bearerToken(request);
  if (token) {
    await services.auth.authenticate(token);
    return true;
  }
  const secret = env.IMAGE_SIGNING_KEY;
  if (!secret) return false;
  return verifyImagePath(
    secret,
    uuid,
    key,
    Number(url.searchParams.get("exp") ?? "0"),
    url.searchParams.get("sig") ?? "",
    Math.floor(Date.now() / 1000),
  );
};

export const imageServe = async (context: HttpContext): Promise<Response> => {
  const [uuid, key] = context.params;
  if (!(await isAuthorizedForImage(context, uuid, key))) {
    throw new AuthError(401, "Invalid or expired image signature");
  }
  const image = await context.services.images.serve(uuid, key);
  if (!image) throw new ApiError(404, "Image not found");
  return new Response(image.bytes, {
    headers: {
      "content-type": image.contentType,
      "cache-control": "private, max-age=86400",
      ...CORS_HEADERS,
    },
  });
};
