import {
  fromBase64,
  randomBytes,
  sha256Hex,
  toBase64,
} from "@/shared/crypto/encoding";

const encoder = new TextEncoder();

export const generateSalt = (): string => toBase64(randomBytes(16));

export const generateDataKey = (): string => toBase64(randomBytes(32));

export const PBKDF2_ITERATIONS = 600_000;

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
  const key = await crypto.subtle.importKey("raw", masterKey, "HKDF", false, [
    "deriveBits",
  ]);
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

export const wrapDataKey = async (
  kek: CryptoKey,
  dataKeyBase64: string,
): Promise<string> => {
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      kek,
      fromBase64(dataKeyBase64),
    ),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return toBase64(combined);
};

export const unwrapDataKey = async (
  kek: CryptoKey,
  wrappedKeyBase64: string,
): Promise<string> => {
  const combined = fromBase64(wrappedKeyBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    kek,
    ciphertext,
  );
  return toBase64(new Uint8Array(plaintext));
};

export const encryptField = async (
  dataKeyBase64: string,
  plaintext: string,
): Promise<string> => {
  const key = await importDataKey(dataKeyBase64);
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plaintext),
    ),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return toBase64(combined);
};

export const decryptField = async (
  dataKeyBase64: string,
  ciphertextBase64: string,
): Promise<string> => {
  const key = await importDataKey(dataKeyBase64);
  const combined = fromBase64(ciphertextBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
};
