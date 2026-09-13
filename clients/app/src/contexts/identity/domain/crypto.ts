import { fromBase64, randomBytes, sha256Hex, toBase64 } from "@/shared/crypto/encoding";

const encoder = new TextEncoder();

export const generateSalt = (): string => toBase64(randomBytes(16));

export const generateDataKey = (): string => toBase64(randomBytes(32));

const PBKDF2_ITERATIONS = 600_000;

export interface DerivedKeys {
  authHash: string;
  kek: CryptoKey;
}

const deriveMasterKey = async (
  password: string,
  saltBase64: string,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(saltBase64),
      iterations,
    },
    passwordKey,
    256,
  );
  return new Uint8Array(bits);
};

const hkdf = async (
  masterKey: Uint8Array<ArrayBuffer>,
  info: string,
  lengthBytes: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const key = await crypto.subtle.importKey("raw", masterKey, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: encoder.encode(info),
    },
    key,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
};

export const deriveKeys = async (
  password: string,
  saltBase64: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<DerivedKeys> => {
  const masterKey = await deriveMasterKey(password, saltBase64, iterations);
  const authKey = await hkdf(masterKey, "bookmark-sync/auth", 32);
  const kekRaw = await hkdf(masterKey, "bookmark-sync/enc", 32);
  const kek = await crypto.subtle.importKey("raw", kekRaw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return { authHash: await sha256Hex(authKey), kek };
};

const importDataKey = (dataKeyBase64: string): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", fromBase64(dataKeyBase64), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);

const seal = async (key: CryptoKey, plaintext: BufferSource): Promise<string> => {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return toBase64(combined);
};

const open = async (key: CryptoKey, payloadBase64: string): Promise<Uint8Array<ArrayBuffer>> => {
  const combined = fromBase64(payloadBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new Uint8Array(plaintext);
};

export const wrapDataKey = async (kek: CryptoKey, dataKeyBase64: string): Promise<string> =>
  seal(kek, fromBase64(dataKeyBase64));

export const unwrapDataKey = async (kek: CryptoKey, wrappedKeyBase64: string): Promise<string> =>
  toBase64(await open(kek, wrappedKeyBase64));

export const encryptField = async (dataKeyBase64: string, plaintext: string): Promise<string> =>
  seal(await importDataKey(dataKeyBase64), encoder.encode(plaintext));

export const decryptField = async (
  dataKeyBase64: string,
  ciphertextBase64: string,
): Promise<string> =>
  new TextDecoder().decode(await open(await importDataKey(dataKeyBase64), ciphertextBase64));
