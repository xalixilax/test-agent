import { describe, expect, it } from "vitest";
import { AuthError, AuthService } from "../src/application/auth-service";
import {
  InMemoryAccountStore,
  InMemorySessionStore,
} from "./support/in-memory";

const build = (now = () => 1_000) => {
  const accounts = new InMemoryAccountStore();
  const sessions = new InMemorySessionStore();
  const auth = new AuthService({
    accounts,
    sessions,
    inviteCode: "open-sesame",
    now,
  });
  return { auth, accounts, sessions };
};

const register = (auth: AuthService) =>
  auth.register({
    inviteCode: "open-sesame",
    salt: "salt",
    authHash: "hash",
    wrappedKey: "wrapped",
  });

describe("AuthService", () => {
  it("reports registration state and salt", async () => {
    const { auth } = build();
    await expect(auth.params()).resolves.toEqual({
      registered: false,
      salt: null,
    });
    await register(auth);
    await expect(auth.params()).resolves.toEqual({
      registered: true,
      salt: "salt",
    });
  });

  it("rejects a bad invite code and duplicate registration", async () => {
    const { auth } = build();
    await expect(
      auth.register({
        inviteCode: "wrong",
        salt: "s",
        authHash: "h",
        wrappedKey: "w",
      }),
    ).rejects.toThrow(AuthError);
    await register(auth);
    await expect(register(auth)).rejects.toThrow("already registered");
  });

  it("logs in with the right password and rejects the wrong one", async () => {
    const { auth } = build();
    await register(auth);

    await expect(auth.login({ authHash: "nope" })).rejects.toThrow(
      "Invalid password",
    );

    const session = await auth.login({ authHash: "hash" });
    expect(session.wrappedKey).toBe("wrapped");
    await expect(auth.authenticate(session.token)).resolves.toBeUndefined();
    await expect(auth.authenticate("bogus")).rejects.toThrow(
      "Invalid or expired session",
    );
  });

  it("expires sessions after the TTL", async () => {
    let now = 1_000;
    const { auth } = build(() => now);
    await register(auth);
    const session = await auth.login({ authHash: "hash" });
    now += 31 * 24 * 60 * 60 * 1000;
    await expect(auth.authenticate(session.token)).rejects.toThrow(
      "Invalid or expired session",
    );
  });

  it("invalidates the session on logout", async () => {
    const { auth } = build();
    await register(auth);
    const session = await auth.login({ authHash: "hash" });
    await auth.logout(session.token);
    await expect(auth.authenticate(session.token)).rejects.toThrow();
  });

  it("changes the password behind the session", async () => {
    const { auth, accounts } = build();
    await register(auth);
    const session = await auth.login({ authHash: "hash" });
    await auth.changePassword(
      { newSalt: "salt2", newAuthHash: "hash2", newWrappedKey: "wrapped2" },
      session.token,
    );
    expect(accounts.account).toEqual({
      salt: "salt2",
      authHash: "hash2",
      wrappedKey: "wrapped2",
    });
    await expect(auth.login({ authHash: "hash" })).rejects.toThrow();
    await expect(
      auth.login({ authHash: "hash2" }),
    ).resolves.toMatchObject({ wrappedKey: "wrapped2" });
  });
});
