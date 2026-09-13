import { decryptField, encryptField } from "@/contexts/identity/domain/crypto";
import type { FieldCipher } from "../application/ports";

export class DataKeyCipher implements FieldCipher {
  constructor(private readonly getDataKey: () => Promise<string | null>) {}

  private async requireKey(): Promise<string> {
    const dataKey = await this.getDataKey();
    if (!dataKey) throw new Error("Sync is locked: no local data key");
    return dataKey;
  }

  async encrypt(plaintext: string): Promise<string> {
    return encryptField(await this.requireKey(), plaintext);
  }

  async decrypt(ciphertext: string): Promise<string> {
    return decryptField(await this.requireKey(), ciphertext);
  }
}
