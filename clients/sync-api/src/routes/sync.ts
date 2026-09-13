import { syncPushRequestSchema } from "sync-protocol";
import { ApiError } from "../application/ports";
import { json, type HttpContext } from "../http";

export const syncPull = async ({ url, services }: HttpContext): Promise<Response> => {
  const since = Number(url.searchParams.get("since") ?? "0");
  if (!Number.isFinite(since) || since < 0) {
    throw new ApiError(400, "Invalid since cursor");
  }
  return json(await services.sync.pull(since));
};

export const syncPush = async ({ request, services }: HttpContext): Promise<Response> => {
  const input = syncPushRequestSchema.parse(await request.json());
  return json(await services.sync.push(input.fields));
};
