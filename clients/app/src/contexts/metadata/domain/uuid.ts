import { sha256Hex } from "@/shared/crypto/encoding";

export const stableUuid = async (value: string): Promise<string> => {
  const hash = await sha256Hex(value);
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
};
