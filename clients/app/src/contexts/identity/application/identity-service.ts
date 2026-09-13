import {
  deriveKeys,
  generateDataKey,
  generateSalt,
  unwrapDataKey,
  wrapDataKey,
} from "../domain/crypto";
import type { AuthGateway, SessionStore, StoredSession } from "./ports";

export interface IdentityStatus {
  registered: boolean;
  loggedIn: boolean;
  reachable: boolean;
}

export class IdentityService {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly store: SessionStore,
  ) {}

  async status(): Promise<IdentityStatus> {
    if (await this.store.get()) {
      return { registered: true, loggedIn: true, reachable: true };
    }
    try {
      const params = await this.gateway.params();
      return {
        registered: params.registered,
        loggedIn: false,
        reachable: true,
      };
    } catch {
      return { registered: false, loggedIn: false, reachable: false };
    }
  }

  async register(password: string, inviteCode: string): Promise<void> {
    const salt = generateSalt();
    const { authHash, kek } = await deriveKeys(password, salt);
    const dataKey = generateDataKey();
    const wrappedKey = await wrapDataKey(kek, dataKey);
    const response = await this.gateway.register({
      inviteCode,
      salt,
      authHash,
      wrappedKey,
    });
    await this.store.set({ token: response.token, dataKey });
  }

  async login(password: string): Promise<void> {
    const params = await this.gateway.params();
    if (!params.registered || !params.salt) {
      throw new Error("No sync account exists on the server yet");
    }
    const { authHash, kek } = await deriveKeys(password, params.salt);
    const response = await this.gateway.login({ authHash });
    const dataKey = await unwrapDataKey(kek, response.wrappedKey);
    await this.store.set({ token: response.token, dataKey });
  }

  async changePassword(newPassword: string): Promise<void> {
    const session = await this.requireSession();
    const salt = generateSalt();
    const { authHash, kek } = await deriveKeys(newPassword, salt);
    const wrappedKey = await wrapDataKey(kek, session.dataKey);
    await this.gateway.changePassword({
      token: session.token,
      newSalt: salt,
      newAuthHash: authHash,
      newWrappedKey: wrappedKey,
    });
  }

  async logout(): Promise<void> {
    const session = await this.store.get();
    await this.store.clear();
    if (session) {
      await this.gateway.logout(session.token).catch(() => undefined);
    }
  }

  private async requireSession(): Promise<StoredSession> {
    const session = await this.store.get();
    if (!session) throw new Error("Not logged in");
    return session;
  }
}
