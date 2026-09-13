import {
  changePasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
} from "sync-protocol";
import { AuthError } from "../application/auth-service";
import { bearerToken, json, type HttpContext } from "../http";

export const authParams = async ({ services }: HttpContext): Promise<Response> =>
  json(await services.auth.params());

export const authRegister = async ({ request, services }: HttpContext): Promise<Response> => {
  const input = registerRequestSchema.parse(await request.json());
  return json(await services.auth.register(input));
};

export const authLogin = async ({ request, services }: HttpContext): Promise<Response> => {
  const input = loginRequestSchema.parse(await request.json());
  return json(await services.auth.login(input));
};

export const authChangePassword = async ({ request, services }: HttpContext): Promise<Response> => {
  const token = bearerToken(request);
  if (!token) throw new AuthError(401, "Missing session token");
  const input = changePasswordRequestSchema.parse(await request.json());
  await services.auth.changePassword(input, token);
  return json({ ok: true });
};

export const authLogout = async ({ request, services }: HttpContext): Promise<Response> => {
  const token = bearerToken(request);
  if (token) await services.auth.logout(token);
  return json({ ok: true });
};
