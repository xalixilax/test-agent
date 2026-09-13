import type { SessionStore, StoredSession } from "../application/ports";

const SESSION_KEY = "sync.session";

// ponytail: the unwrapped data key lives in chrome.storage.local, same local
// threat surface as the plaintext PGlite metadata. Server-side stays E2E.
export class ChromeSessionStore implements SessionStore {
  async get(): Promise<StoredSession | null> {
    const result = await chrome.storage.local.get(SESSION_KEY);
    return (result[SESSION_KEY] as StoredSession | undefined) ?? null;
  }

  async set(session: StoredSession): Promise<void> {
    await chrome.storage.local.set({ [SESSION_KEY]: session });
  }

  async clear(): Promise<void> {
    await chrome.storage.local.remove(SESSION_KEY);
  }
}
