import type { AccountStore, SessionStore } from "./ports";

export const hmacLikeEqual = (a: string, b: string): boolean => {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
};

const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export { toHex };

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
};

const randomToken = (): string => toHex(crypto.getRandomValues(new Uint8Array(32)));

export interface AuthServiceDeps {
  accounts: AccountStore;
  sessions: SessionStore;
  inviteCode: string;
  now?: () => number;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  private readonly now: () => number;

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? Date.now;
  }

  async params(): Promise<{ registered: boolean; salt: string | null }> {
    const account = await this.deps.accounts.get();
    return {
      registered: account !== null,
      salt: account?.salt ?? null,
    };
  }

  async register(input: {
    inviteCode: string;
    salt: string;
    authHash: string;
    wrappedKey: string;
  }): Promise<{ token: string; wrappedKey: string; serverTime: number }> {
    if (!hmacLikeEqual(input.inviteCode, this.deps.inviteCode)) {
      throw new AuthError(403, "Invalid invite code");
    }
    const existing = await this.deps.accounts.get();
    if (existing) throw new AuthError(409, "Account already registered");
    try {
      await this.deps.accounts.create({
        salt: input.salt,
        authHash: input.authHash,
        wrappedKey: input.wrappedKey,
      });
    } catch {
      throw new AuthError(409, "Account already registered");
    }
    return this.createSession(input.wrappedKey);
  }

  async login(input: {
    authHash: string;
  }): Promise<{ token: string; wrappedKey: string; serverTime: number }> {
    const account = await this.deps.accounts.get();
    if (!account) throw new AuthError(404, "No account registered");
    if (!hmacLikeEqual(input.authHash, account.authHash)) {
      throw new AuthError(401, "Invalid password");
    }
    await this.deps.sessions.deleteExpired(this.now());
    return this.createSession(account.wrappedKey);
  }

  async changePassword(
    input: { newSalt: string; newAuthHash: string; newWrappedKey: string },
    token: string,
  ): Promise<void> {
    await this.authenticate(token);
    const account = await this.deps.accounts.get();
    if (!account) throw new AuthError(404, "No account registered");
    await this.deps.accounts.update({
      salt: input.newSalt,
      authHash: input.newAuthHash,
      wrappedKey: input.newWrappedKey,
    });
    await this.deps.sessions.deleteOthers(await sha256Hex(token));
  }

  async logout(token: string): Promise<void> {
    await this.deps.sessions.delete(await sha256Hex(token));
  }

  async authenticate(token: string): Promise<void> {
    const session = await this.deps.sessions.find(await sha256Hex(token), this.now());
    if (!session) throw new AuthError(401, "Invalid or expired session");
  }

  private async createSession(
    wrappedKey: string,
  ): Promise<{ token: string; wrappedKey: string; serverTime: number }> {
    const token = randomToken();
    const now = this.now();
    await this.deps.sessions.create(await sha256Hex(token), now + SESSION_TTL_MS, now);
    return { token, wrappedKey, serverTime: now };
  }
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
