import { describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { handleRequest } from "../src/index";

const envWith = (success: boolean): { env: Env; keys: string[] } => {
  const keys: string[] = [];
  const env = {
    AUTH_RATE_LIMITER: {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success };
      },
    },
  } as unknown as Env;
  return { env, keys };
};

const login = (ip: string): Request =>
  new Request("https://sync.example/auth/login", {
    method: "POST",
    headers: { "cf-connecting-ip": ip, "content-type": "application/json" },
    body: JSON.stringify({ authHash: "x" }),
  });

describe("handleRequest rate limiting", () => {
  it("returns 429 and keys the limiter by client IP", async () => {
    const { env, keys } = envWith(false);
    const response = await handleRequest(login("1.2.3.4"), env);
    expect(response.status).toBe(429);
    expect(keys).toEqual(["1.2.3.4"]);
  });

  it("leaves other routes unthrottled", async () => {
    const { env, keys } = envWith(false);
    const response = await handleRequest(new Request("https://sync.example/health"), env);
    expect(response.status).toBe(200);
    expect(keys).toEqual([]);
  });
});
