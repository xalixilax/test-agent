import { hmacLikeEqual, toHex } from "./auth-service";

const encoder = new TextEncoder();

const importSigningKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

export const signImagePath = async (
  secret: string,
  uuid: string,
  key: string,
  exp: number,
): Promise<string> => {
  const cryptoKey = await importSigningKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(`${uuid}/${key}/${exp}`),
    ),
  );
  return toHex(signature);
};

export const verifyImagePath = async (
  secret: string,
  uuid: string,
  key: string,
  exp: number,
  signature: string,
  nowSeconds: number,
): Promise<boolean> => {
  if (!Number.isFinite(exp) || exp < nowSeconds) return false;
  return hmacLikeEqual(await signImagePath(secret, uuid, key, exp), signature);
};
